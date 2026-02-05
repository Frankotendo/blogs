
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from './lib/clients';
import { shareHub, hashPin } from './lib/utils';
import { AppSettings, Driver, HubMission, NodeStatus, PortalMode, RegistrationRequest, RideNode, SearchConfig, TopupRequest, Transaction, UniUser } from './types';

// Components
import { GlobalVoiceOrb } from './components/VoiceOrb';
import { HubGateway } from './components/Auth';
import { PassengerPortal } from './components/Passenger';
import { DriverPortal } from './components/Driver';
import { AdminPortal, AdminLogin } from './components/Admin';
import { AdGate, AiHelpDesk, HelpSection, MobileNavItem, NavItem, SearchHub } from './components/Shared';

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState('monitor'); 
  
  const [session, setSession] = useState<any>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const [currentUser, setCurrentUser] = useState<UniUser | null>(() => {
    const saved = localStorage.getItem('nexryde_user_v1');
    if (saved) {
        try {
            const user = JSON.parse(saved);
            return { ...user, walletBalance: user.walletBalance ?? 0 };
        } catch (e) {
            return null;
        }
    }
    return null;
  });

  const [activeDriverId, setActiveDriverId] = useState<string | null>(() => {
    return sessionStorage.getItem('nexryde_driver_session_v1');
  });

  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    query: '',
    vehicleType: 'All',
    status: 'All',
    sortBy: 'newest',
    isSolo: null
  });

  const [authFormState, setAuthFormState] = useState({ username: '', phone: '', pin: '', mode: 'login' as 'login' | 'signup', agreedToTerms: false });
  const [createMode, setCreateMode] = useState(false);
  const [newNode, setNewNode] = useState<Partial<RideNode>>({ origin: '', destination: '', vehicleType: 'Pragia', isSolo: false });
  const triggerVoiceRef = useRef<() => void>(() => {});

  const [myRideIds, setMyRideIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('nexryde_my_rides_v1');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [showQrModal, setShowQrModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [isNewUser, setIsNewUser] = useState(() => !localStorage.getItem('nexryde_seen_welcome_v1'));
  const [isSyncing, setIsSyncing] = useState(true);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState(() => localStorage.getItem('nexryde_dismissed_announcement'));
  
  const [showAiAd, setShowAiAd] = useState(false);
  const [isAiUnlocked, setIsAiUnlocked] = useState(false);

  const [settings, setSettings] = useState<AppSettings>({
    adminMomo: "024-123-4567",
    adminMomoName: "NexRyde Admin",
    whatsappNumber: "233241234567",
    commissionPerSeat: 2.00,
    shuttleCommission: 0.5,
    farePerPragia: 5.00,
    farePerTaxi: 8.00,
    soloMultiplier: 2.5,
    aboutMeText: "Welcome to NexRyde Logistics.",
    aboutMeImages: [],
    appWallpaper: "",
    appLogo: "",
    registrationFee: 20.00,
    hub_announcement: "",
    facebookUrl: "",
    instagramUrl: "",
    tiktokUrl: "",
    adSenseClientId: "ca-pub-7812709042449387",
    adSenseSlotId: "9489307110",
    adSenseLayoutKey: "-fb+5w+4e-db+86",
    adSenseStatus: "active"
  });
  const [nodes, setNodes] = useState<RideNode[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [missions, setMissions] = useState<HubMission[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topupRequests, setTopupRequests] = useState<TopupRequest[]>([]);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);

  // DYNAMIC BRANDING ENGINE
  useEffect(() => {
    if (settings.appLogo) {
      const favicon = document.getElementById('link-favicon') as HTMLLinkElement;
      const appleIcon = document.getElementById('link-apple-icon') as HTMLLinkElement;
      if (favicon) favicon.href = settings.appLogo;
      if (appleIcon) appleIcon.href = settings.appLogo;
    }
    document.title = `NexRyde | ${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Hub`;
  }, [settings.appLogo, viewMode]);

  // PWA INSTALL LOGIC
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    }
  };

  const isVaultAccess = useMemo(() => {
    return new URLSearchParams(window.location.search).get('access') === 'vault';
  }, []);

  const fetchPublicData = async () => {
      const [ { data: sData }, { data: nData }, { data: mData } ] = await Promise.all([
          supabase.from('unihub_settings').select('*').single(),
          supabase.from('unihub_nodes').select('*').order('createdAt', { ascending: false }),
          supabase.from('unihub_missions').select('*').order('createdAt', { ascending: false }),
      ]);
      
      if (sData) {
        const mappedSettings: AppSettings = {
            ...settings, 
            ...sData, 
            id: sData.id
        };
        setSettings(mappedSettings);
      }
      if (nData) setNodes(nData);
      if (mData) setMissions(mData);
  };

  const fetchPrivateData = async () => {
      const promises: any[] = [supabase.from('unihub_drivers').select('*')];
      if (isAdminAuthenticated) {
          promises.push(supabase.from('unihub_topups').select('*').order('timestamp', { ascending: false }));
          promises.push(supabase.from('unihub_transactions').select('*').order('timestamp', { ascending: false }));
          promises.push(supabase.from('unihub_registrations').select('*').order('timestamp', { ascending: false }));
      } else if (currentUser) {
          promises.push(supabase.from('unihub_users').select('*').eq('id', currentUser.id).single());
      }
      const results = await Promise.all(promises);
      const dData = results[0].data;
      if (dData) setDrivers(dData);
      if (isAdminAuthenticated) {
          setTopupRequests(results[1].data || []);
          setTransactions(results[2].data || []);
          setRegistrationRequests(results[3].data || []);
      } else if (currentUser && results[1].data) {
          const uData = results[1].data;
          const balance = uData.walletBalance ?? uData.wallet_balance ?? 0;
          const updatedUser = { ...currentUser, walletBalance: Number(balance) };
          setCurrentUser(updatedUser);
          localStorage.setItem('nexryde_user_v1', JSON.stringify(updatedUser));
      }
  };

  const fetchData = async () => {
    setIsSyncing(true);
    try {
        await fetchPublicData();
        if (currentUser || isAdminAuthenticated) await fetchPrivateData();
    } catch (err) { console.error("Fetch error:", err); } 
    finally { setIsSyncing(false); }
  };

  useEffect(() => {
    const verifyIdentity = async () => {
        if (!currentUser) return;
        const { data, error } = await supabase.from('unihub_users').select('id').eq('id', currentUser.id).maybeSingle();
        if (error || !data) {
            localStorage.removeItem('nexryde_user_v1');
            setCurrentUser(null);
        }
    };
    verifyIdentity();
  }, []);

  useEffect(() => {
    localStorage.setItem('nexryde_my_rides_v1', JSON.stringify(myRideIds));
  }, [myRideIds]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAdminAuthenticated(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAdminAuthenticated(!!session);
      fetchData();
    });
    fetchData();
    const publicChannels = [
      supabase.channel('public:unihub_settings').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_settings' }, () => fetchPublicData()).subscribe(),
      supabase.channel('public:unihub_nodes').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_nodes' }, () => { fetchPublicData(); if(currentUser) fetchPrivateData(); }).subscribe(),
      supabase.channel('public:unihub_missions').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_missions' }, () => fetchPublicData()).subscribe(),
      supabase.channel('public:unihub_drivers').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_drivers' }, () => { if(currentUser || isAdminAuthenticated) fetchPrivateData(); }).subscribe(),
    ];
    return () => {
      publicChannels.forEach(ch => supabase.removeChannel(ch));
      subscription.unsubscribe();
    };
  }, [isAdminAuthenticated, currentUser?.id]);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);
  const isDriverLoading = !!(activeDriverId && !activeDriver && isSyncing);
  const onlineDriverCount = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);
  const activeNodeCount = useMemo(() => nodes.filter(n => n.status !== 'completed').length, [nodes]);
  const hubRevenue = useMemo(() => transactions.filter(tx => tx.type === 'commission' || tx.type === 'registration').reduce((a, b) => a + b.amount, 0), [transactions]);
  const pendingRequestsCount = useMemo(() => topupRequests.filter(r => r.status === 'pending').length + registrationRequests.filter(r => r.status === 'pending').length, [topupRequests, registrationRequests]);

  const handleGlobalUserAuth = async (username: string, phone: string, hashedPin: string, mode: 'login' | 'signup', plainPin?: string) => {
    if (!phone || !hashedPin) { alert("Missing credentials."); return; }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.from('unihub_users').select('*').eq('phone', phone).maybeSingle();
      if (mode === 'login') {
        if (!data) { alert("Profile not found!"); setIsSyncing(false); return; }
        const user = data as UniUser;
        let isValid = (user.pin === hashedPin) || (user.pin === plainPin);
        if (!isValid) { alert("Access Denied: Incorrect PIN."); setIsSyncing(false); return; }
        const balance = user.walletBalance ?? (user as any).wallet_balance ?? 0;
        const safeUser = { ...user, walletBalance: Number(balance) };
        setCurrentUser(safeUser);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(safeUser));
      } else {
        if (data) { alert("Account already exists!"); setIsSyncing(false); return; }
        const newUser: UniUser = { id: `USER-${Date.now()}`, username, phone, pin: hashedPin, walletBalance: 0 };
        await supabase.from('unihub_users').insert([newUser]);
        setCurrentUser(newUser);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(newUser));
      }
    } catch (err: any) { alert("Auth Error: " + err.message); } 
    finally { setIsSyncing(false); }
  };

  const cancelRide = async (nodeId: string, role: 'passenger' | 'driver' | 'admin' = 'admin') => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    try {
      if (role === 'driver' && node.status === 'dispatched' && activeDriverId) {
          if (!confirm("Cancelling an active dispatch will incur a ₵2.00 Reliability Penalty. Proceed?")) return;
          const latest = drivers.find(d => d.id === activeDriverId);
          const newBal = (latest?.walletBalance ?? 0) - 2.00;
          await Promise.all([
              supabase.from('unihub_drivers').update({ walletBalance: newBal }).eq('id', activeDriverId),
              supabase.from('unihub_transactions').insert([{ id: `TX-PEN-D-${Date.now()}`, driverId: activeDriverId, amount: 2.00, type: 'commission', reference: `CANCEL-${nodeId}`, timestamp: new Date().toLocaleString() }]),
              supabase.from('unihub_nodes').update({ status: 'qualified', assignedDriverId: null }).eq('id', nodeId)
          ]);
          alert("Trip Reset. ₵2.00 Penalty Applied.");
          return;
      }
      if (role === 'passenger' && node.status === 'dispatched' && currentUser) {
          if (!confirm("Cancelling a dispatched ride incurs a ₵1.00 Time-Waste penalty. Proceed?")) return;
          const newBal = (currentUser.walletBalance ?? 0) - 1.00;
          await Promise.all([
              supabase.from('unihub_users').update({ walletBalance: newBal }).eq('id', currentUser.id),
              supabase.from('unihub_transactions').insert([{ id: `TX-PEN-P-${Date.now()}`, userId: currentUser.id, amount: 1.00, type: 'commission', reference: `CANCEL-${nodeId}`, timestamp: new Date().toLocaleString() }]),
              supabase.from('unihub_nodes').delete().eq('id', nodeId)
          ]);
          setMyRideIds(prev => prev.filter(id => id !== nodeId));
          alert("Ride Removed. ₵1.00 Penalty Applied.");
          return;
      }
      await supabase.from('unihub_nodes').delete().eq('id', nodeId);
      setMyRideIds(prev => prev.filter(id => id !== nodeId));
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => { if (confirm("Sign out?")) { localStorage.removeItem('nexryde_user_v1'); setCurrentUser(null); } };

  return (
    <div 
      className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative"
      style={settings.appWallpaper ? { backgroundImage: `url(${settings.appWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
    >
      {settings.appWallpaper && <div className="absolute inset-0 bg-[#020617]/70 pointer-events-none z-0"></div>}

      <GlobalVoiceOrb 
        mode={currentUser ? viewMode : 'public'}
        user={viewMode === 'driver' ? activeDriver : currentUser}
        contextData={{ nodes, drivers, transactions, settings, pendingRequests: pendingRequestsCount }}
        actions={{ onUpdateStatus: async (s:any) => activeDriverId && await supabase.from('unihub_drivers').update({status:s}).eq('id',activeDriverId) }}
        triggerRef={triggerVoiceRef}
      />

      {showInstallBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[3000] w-[90%] max-w-sm animate-in slide-in-from-top duration-700">
           <div className="glass-bright p-5 rounded-[2rem] border border-amber-500/30 flex items-center gap-4 shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-white/5 p-1 shrink-0">
                 <img src={settings.appLogo || "https://api.dicebear.com/7.x/shapes/svg?seed=nexryde"} className="w-full h-full object-contain" />
              </div>
              <div className="flex-1">
                 <h4 className="text-sm font-black text-white uppercase italic">Install NexRyde</h4>
                 <p className="text-[9px] text-slate-400 font-bold uppercase">Add to home screen for speed</p>
              </div>
              <button onClick={handleInstallClick} className="px-4 py-2 bg-amber-500 text-[#020617] rounded-xl font-black text-[10px] uppercase">Install</button>
              <button onClick={() => setShowInstallBanner(false)} className="text-slate-500"><i className="fas fa-times"></i></button>
           </div>
        </div>
      )}

      {!currentUser ? (
         <HubGateway onIdentify={handleGlobalUserAuth} settings={settings} formState={authFormState} setFormState={setAuthFormState} onTriggerVoice={() => triggerVoiceRef.current?.()} />
      ) : (
        <>
          {settings.hub_announcement && !dismissedAnnouncement && (
            <div className="fixed top-0 left-0 right-0 z-[2000] bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-3 flex items-start sm:items-center justify-between shadow-2xl border-b border-white/10">
               <div className="flex items-start gap-3 flex-1">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse shrink-0"><i className="fas fa-bullhorn text-white text-xs"></i></div>
                  <p className="text-[10px] sm:text-xs font-black uppercase italic text-white tracking-tight break-words">{settings.hub_announcement}</p>
               </div>
               <button onClick={() => {setDismissedAnnouncement('t'); localStorage.setItem('nexryde_dismissed_announcement', 't')}} className="ml-4 w-7 h-7 rounded-full bg-black/20 text-white text-[10px] shrink-0"><i className="fas fa-times"></i></button>
            </div>
          )}
          
          {isSyncing && <div className={`fixed ${settings.hub_announcement && !dismissedAnnouncement ? 'top-20' : 'top-4'} right-4 z-[300] bg-amber-500/20 text-amber-500 px-4 py-2 rounded-full border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-2`}>Live Syncing...</div>}

          <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <img src={settings.appLogo || "https://api.dicebear.com/7.x/shapes/svg?seed=nexryde"} className="w-12 h-12 object-contain rounded-xl bg-white/5 p-1 border border-white/10" alt="Logo" />
                <div>
                  <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">NexRyde</h1>
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Dispatch Hub</p>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride Center" onClick={() => setViewMode('passenger')} />
              <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Partner Terminal" onClick={() => setViewMode('driver')} />
              {(isVaultAccess || isAdminAuthenticated) && <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Control Vault" onClick={() => setViewMode('admin')} badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined} />}
              <NavItem active={false} icon="fa-share-nodes" label="Invite Others" onClick={shareHub} />
              <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all mt-4"><i className="fas fa-power-off text-lg w-6"></i><span className="text-sm font-bold">Sign Out</span></button>
            </div>
          </nav>

          <main className={`flex-1 overflow-y-auto p-4 lg:p-12 pb-36 lg:pb-12 no-scrollbar z-10 relative transition-all duration-500 ${settings.hub_announcement && !dismissedAnnouncement ? 'pt-24 lg:pt-28' : 'pt-4 lg:pt-12'}`}>
            <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
              {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
                <SearchHub searchConfig={searchConfig} setSearchConfig={setSearchConfig} portalMode={viewMode} />
              )}
              {viewMode === 'passenger' && (
                <PassengerPortal 
                  currentUser={currentUser} 
                  nodes={nodes} 
                  myRideIds={myRideIds} 
                  onAddNode={async (n:any) => {await supabase.from('unihub_nodes').insert([n]); setMyRideIds([...myRideIds, n.id])}} 
                  onJoin={async (id:any, n:any, p:any) => {
                      const target = nodes.find(x => x.id === id);
                      if (target) await supabase.from('unihub_nodes').update({ passengers: [...target.passengers, {id:`P-${Date.now()}`, name:n, phone:p}], status: (target.passengers.length + 1 >= target.capacityNeeded ? 'qualified' : target.status) }).eq('id', id);
                      setMyRideIds([...myRideIds, id]);
                  }} 
                  onLeave={async (id:any, p:any) => {
                      const target = nodes.find(x => x.id === id);
                      if (target) await supabase.from('unihub_nodes').update({ passengers: target.passengers.filter(x => x.phone !== p) }).eq('id', id);
                      setMyRideIds(myRideIds.filter(x => x !== id));
                  }} 
                  onForceQualify={async (id:any) => await supabase.from('unihub_nodes').update({ status: 'qualified' }).eq('id', id)}
                  onCancel={(id:any) => cancelRide(id, 'passenger')} 
                  drivers={drivers} 
                  searchConfig={searchConfig} 
                  settings={settings} 
                  createMode={createMode}
                  setCreateMode={setCreateMode}
                  newNode={newNode}
                  setNewNode={setNewNode}
                  onTriggerVoice={() => triggerVoiceRef.current?.()} 
                  onTopupSuccess={async (a:any, r:any, p:any) => await supabase.from('unihub_topups').insert([{id:`T-${Date.now()}`, userId:currentUser!.id, amount:a, momoReference:r, proofImage:p, status:'pending', timestamp:new Date().toLocaleString()}])} 
                />
              )}
              {viewMode === 'driver' && (
                <DriverPortal 
                  drivers={drivers} 
                  activeDriver={activeDriver} 
                  onLogin={(id:any, p:any) => drivers.find(d => d.id === id && d.pin === p) && (setActiveDriverId(id), sessionStorage.setItem('nexryde_driver_session_v1', id))} 
                  onLogout={() => {setActiveDriverId(null); sessionStorage.removeItem('nexryde_driver_session_v1')}} 
                  qualifiedNodes={nodes.filter(n => n.status === 'qualified')} 
                  dispatchedNodes={nodes.filter(n => n.status === 'dispatched')} 
                  missions={missions} 
                  allNodes={nodes} 
                  onJoinMission={async (m:any, d:any) => {
                      const msn = missions.find(x => x.id === m);
                      const drv = drivers.find(x => x.id === d);
                      if (msn && drv && drv.walletBalance >= msn.entryFee) {
                          await supabase.from('unihub_missions').update({ driversJoined: [...msn.driversJoined, d] }).eq('id', m);
                          await supabase.from('unihub_drivers').update({ walletBalance: drv.walletBalance - msn.entryFee }).eq('id', d);
                      }
                  }} 
                  onAccept={async (id:any, d:any) => await supabase.from('unihub_nodes').update({ status: 'dispatched', assignedDriverId: d, verificationCode: Math.floor(1000+Math.random()*9000).toString() }).eq('id', id)} 
                  onVerify={async (id:any, code:any) => {
                      const node = nodes.find(n => n.id === id);
                      if (node && (node.verificationCode === code || node.passengers.some(p => p.verificationCode === code))) {
                          await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', id);
                          alert("Verification Successful! Ride Completed.");
                      } else {
                          alert("Invalid Verification Code.");
                      }
                  }}
                  onBroadcast={async (data:any) => {
                      const node: RideNode = {
                          id: `BC-${Date.now()}`,
                          origin: data.origin,
                          destination: data.destination,
                          capacityNeeded: parseInt(data.seats),
                          passengers: [],
                          status: 'forming',
                          leaderName: activeDriver!.name,
                          leaderPhone: activeDriver!.contact,
                          farePerPerson: data.fare,
                          createdAt: new Date().toISOString(),
                          assignedDriverId: activeDriver!.id,
                          vehicleType: activeDriver!.vehicleType,
                          driverNote: data.note
                      };
                      await supabase.from('unihub_nodes').insert([node]);
                  }}
                  onCancel={(id:any) => cancelRide(id, 'driver')} 
                  searchConfig={searchConfig} 
                  settings={settings} 
                  onUpdateStatus={async (s:any) => activeDriverId && await supabase.from('unihub_drivers').update({status:s}).eq('id',activeDriverId)}
                  isLoading={isDriverLoading} 
                />
              )}
              {viewMode === 'admin' && (
                isAdminAuthenticated ? (
                  <AdminPortal 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                    nodes={nodes} 
                    drivers={drivers} 
                    missions={missions} 
                    topupRequests={topupRequests} 
                    registrationRequests={registrationRequests} 
                    settings={settings} 
                    onUpdateSettings={async (s:any) => await supabase.from('unihub_settings').update(s).eq('id', s.id)} 
                    onAddDriver={async (d:any) => await supabase.from('unihub_drivers').insert([{...d, id: `DRV-${Date.now()}`, rating: 5.0, walletBalance: 0, status: 'offline'}])}
                    onDeleteDriver={async (id:any) => await supabase.from('unihub_drivers').delete().eq('id', id)}
                    onCancelRide={(id:any) => cancelRide(id, 'admin')}
                    onSettleRide={async (id:any) => await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', id)}
                    onCreateMission={async (m:any) => await supabase.from('unihub_missions').insert([m])}
                    onDeleteMission={async (id:any) => await supabase.from('unihub_missions').delete().eq('id', id)}
                    onApproveTopup={async (id:any) => {
                        const req = topupRequests.find(r => r.id === id);
                        if (!req) return;
                        if (req.userId) {
                            const user = await supabase.from('unihub_users').select('walletBalance').eq('id', req.userId).single();
                            await supabase.from('unihub_users').update({ walletBalance: (user.data?.walletBalance || 0) + req.amount }).eq('id', req.userId);
                        } else if (req.driverId) {
                            const drv = drivers.find(d => d.id === req.driverId);
                            await supabase.from('unihub_drivers').update({ walletBalance: (drv?.walletBalance || 0) + req.amount }).eq('id', req.driverId);
                        }
                        await supabase.from('unihub_topups').update({ status: 'approved' }).eq('id', id);
                    }}
                    onRejectTopup={async (id:any) => await supabase.from('unihub_topups').update({ status: 'rejected' }).eq('id', id)}
                    onApproveRegistration={async (id:any) => {
                        const req = registrationRequests.find(r => r.id === id);
                        if (req) {
                            await supabase.from('unihub_drivers').insert([{ id: `DRV-${Date.now()}`, name: req.name, vehicleType: req.vehicleType, licensePlate: req.licensePlate, contact: req.contact, pin: req.pin, walletBalance: 0, rating: 5.0, status: 'offline', avatarUrl: req.avatarUrl }]);
                            await supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', id);
                        }
                    }}
                    onRejectRegistration={async (id:any) => await supabase.from('unihub_registrations').update({ status: 'rejected' }).eq('id', id)}
                    onLock={() => supabase.auth.signOut()}
                    onManualCredit={async (phone:any, amount:any) => {
                        const user = await supabase.from('unihub_users').select('*').eq('phone', phone).maybeSingle();
                        if (user.data) {
                            await supabase.from('unihub_users').update({ walletBalance: (user.data.walletBalance || 0) + amount }).eq('id', user.data.id);
                            alert("User Credited.");
                        } else {
                            const drv = await supabase.from('unihub_drivers').select('*').eq('contact', phone).maybeSingle();
                            if (drv.data) {
                                await supabase.from('unihub_drivers').update({ walletBalance: (drv.data.walletBalance || 0) + amount }).eq('id', drv.data.id);
                                alert("Driver Credited.");
                            } else alert("Identity not found.");
                        }
                    }}
                    hubRevenue={hubRevenue} 
                    adminEmail={session?.user?.email} 
                    pendingRequestsCount={pendingRequestsCount} 
                  />
                ) : (
                  <AdminLogin onLogin={async (e:any,p:any) => await supabase.auth.signInWithPassword({email:e, password:p})} />
                )
              )}
            </div>
          </main>
        </>
      )}
    </div>
  );
}
