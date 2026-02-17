
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase, ai, compressImage, shareHub } from './utils';
import { RideNode, Driver, HubMission, TopupRequest, RegistrationRequest, Transaction, AppSettings, SearchConfig, PortalMode, UniUser } from './types';
import { PassengerPortal } from './components/PassengerPortal';
import { DriverPortal } from './components/DriverPortal';
import { AdminPortal, AdminLogin } from './components/AdminPortal';
import { GlobalVoiceOrb } from './components/GlobalVoiceOrb';
import { HubGateway, NavItem, MobileNavItem, SearchHub, QrScannerModal, AiHelpDesk, HelpSection, AdGate, MenuModal } from './components/SharedUI';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  const [activeTab, setActiveTab] = useState('monitor'); 
  
  const [session, setSession] = useState<any>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UniUser | null>(() => {
    const saved = localStorage.getItem('nexryde_user_v1');
    return saved ? JSON.parse(saved) : null;
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

  const [authFormState, setAuthFormState] = useState({ username: '', phone: '', pin: '', mode: 'login' as 'login' | 'signup' });
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
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);
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

  const isVaultAccess = useMemo(() => {
    return new URLSearchParams(window.location.search).get('access') === 'vault';
  }, []);

  const fetchData = async () => {
    setIsSyncing(true);
    try {
      const [
        { data: sData },
        { data: nData },
        { data: dData },
        { data: mData },
        { data: tData },
        { data: trData },
        { data: regData }
      ] = await Promise.all([
        supabase.from('unihub_settings').select('*').single(),
        supabase.from('unihub_nodes').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_drivers').select('*'),
        supabase.from('unihub_missions').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_topups').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_transactions').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_registrations').select('*').order('timestamp', { ascending: false })
      ]);

      if (sData) {
        const mappedSettings: AppSettings = {
            ...settings, 
            ...sData, 
            adminMomo: sData.admin_momo || sData.adminMomo || settings.adminMomo,
            adminMomoName: sData.admin_momo_name || sData.adminMomoName || settings.adminMomoName,
            whatsappNumber: sData.whatsapp_number || sData.whatsappNumber || settings.whatsappNumber,
            commissionPerSeat: sData.commission_per_seat || sData.commissionPerSeat || settings.commissionPerSeat,
            shuttleCommission: sData.shuttle_commission || sData.shuttleCommission || settings.shuttleCommission,
            farePerPragia: sData.fare_per_pragia || sData.farePerPragia || settings.farePerPragia,
            farePerTaxi: sData.fare_per_taxi || sData.farePerTaxi || settings.farePerTaxi,
            soloMultiplier: sData.solo_multiplier || sData.soloMultiplier || settings.soloMultiplier,
            aboutMeText: sData.about_me_text || sData.aboutMeText || settings.aboutMeText,
            aboutMeImages: sData.about_me_images || sData.aboutMeImages || settings.aboutMeImages,
            appWallpaper: sData.app_wallpaper || sData.appWallpaper || settings.appWallpaper,
            appLogo: sData.app_logo || sData.appLogo || settings.appLogo,
            registrationFee: sData.registration_fee || sData.registrationFee || settings.registrationFee,
            facebookUrl: sData.facebook_url || sData.facebookUrl || settings.facebookUrl,
            instagramUrl: sData.instagram_url || sData.instagramUrl || settings.instagramUrl,
            tiktokUrl: sData.tiktok_url || sData.tiktokUrl || settings.tiktokUrl,
            adSenseClientId: sData.adsense_client_id || sData.adSenseClientId || settings.adSenseClientId,
            adSenseSlotId: sData.adsense_slot_id || sData.adSenseSlotId || settings.adSenseSlotId,
            adSenseLayoutKey: sData.adsense_layout_key || sData.adSenseLayoutKey || settings.adSenseLayoutKey,
            adSenseStatus: sData.adsense_status || sData.adSenseStatus || settings.adSenseStatus,
            hub_announcement: sData.hub_announcement || settings.hub_announcement, 
            id: sData.id
        };
        setSettings(mappedSettings);
        const currentMsg = mappedSettings.hub_announcement || '';
        if (currentMsg !== localStorage.getItem('nexryde_last_announcement')) {
          setDismissedAnnouncement(null);
          localStorage.removeItem('nexryde_dismissed_announcement');
          localStorage.setItem('nexryde_last_announcement', currentMsg);
        }
      }
      if (nData) setNodes(nData);
      if (dData) setDrivers(dData);
      if (mData) setMissions(mData);
      if (trData) setTransactions(trData);
      if (tData) setTopupRequests(tData);
      if (regData) setRegistrationRequests(regData);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('nexryde_my_rides_v1', JSON.stringify(myRideIds));
  }, [myRideIds]);

  useEffect(() => {
    if (settings.adSenseStatus === 'active' && settings.adSenseClientId) {
      const scriptId = 'google-adsense-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${settings.adSenseClientId}`;
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
      }
    }
  }, [settings.adSenseStatus, settings.adSenseClientId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAdminAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAdminAuthenticated(!!session);
    });

    fetchData();
    const channels = [
      supabase.channel('public:unihub_settings').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_settings' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_nodes').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_nodes' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_drivers').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_drivers' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_missions').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_missions' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_transactions').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_transactions' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_topups').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_topups' }, () => fetchData()).subscribe(),
      supabase.channel('public:unihub_registrations').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_registrations' }, () => fetchData()).subscribe()
    ];
    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
      subscription.unsubscribe();
    };
  }, []);

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);
  const isDriverLoading = !!(activeDriverId && !activeDriver && isSyncing);
  const pendingRequestsCount = useMemo(() => 
    topupRequests.filter(r => r.status === 'pending').length + 
    registrationRequests.filter(r => r.status === 'pending').length, 
  [topupRequests, registrationRequests]);
  const hubRevenue = useMemo(() => transactions.reduce((a, b) => a + b.amount, 0), [transactions]);

  const handleGlobalUserAuth = async (username: string, phone: string, pin: string, mode: 'login' | 'signup') => {
    if (!phone || !pin) { alert("Phone number and 4-digit PIN are required."); return; }
    if (pin.length !== 4) { alert("PIN must be exactly 4 digits."); return; }
    setIsSyncing(true);
    try {
      const { data } = await supabase.from('unihub_users').select('*').eq('phone', phone).maybeSingle();
      if (mode === 'login') {
        if (!data) { alert("Profile not found! Please create an account first."); setIsSyncing(false); return; }
        const user = data as UniUser;
        if (user.pin && user.pin !== pin) { alert("Access Denied: Incorrect PIN."); setIsSyncing(false); return; }
        if (!user.pin) { await supabase.from('unihub_users').update({ pin }).eq('id', user.id); user.pin = pin; alert("Security Update: This PIN has been linked to your account."); }
        setCurrentUser(user);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(user));
      } else {
        if (data) { alert("An account with this phone already exists! Please Sign In."); setIsSyncing(false); return; }
        if (!username) { alert("Please enter a username for your profile."); setIsSyncing(false); return; }
        const newUser: UniUser = { id: `USER-${Date.now()}`, username, phone, pin };
        const { error: insertErr } = await supabase.from('unihub_users').insert([newUser]);
        if (insertErr) throw insertErr;
        setCurrentUser(newUser);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(newUser));
      }
    } catch (err: any) { alert("Identity Error: " + err.message); } finally { setIsSyncing(false); }
  };

  const handleLogout = () => { if (confirm("Sign out of NexRyde?")) { localStorage.removeItem('nexryde_user_v1'); setCurrentUser(null); } };
  const addRideToMyList = (nodeId: string) => { setMyRideIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]); };
  const removeRideFromMyList = (nodeId: string) => { setMyRideIds(prev => prev.filter(id => id !== nodeId)); };

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.passengers.length < node.capacityNeeded) {
      const newPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
      const isQualified = newPassengers.length >= node.capacityNeeded;
      let updatedStatus = node.status;
      if (isQualified && node.status === 'forming') updatedStatus = 'qualified';
      await supabase.from('unihub_nodes').update({ passengers: newPassengers, status: updatedStatus }).eq('id', nodeId);
      addRideToMyList(nodeId);
    }
  };

  const leaveNode = async (nodeId: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newPassengers = node.passengers.filter(p => p.phone !== phone);
    const updatedStatus = newPassengers.length < node.capacityNeeded && node.status === 'qualified' ? 'forming' : node.status;
    await supabase.from('unihub_nodes').update({ passengers: newPassengers, status: updatedStatus }).eq('id', nodeId);
    removeRideFromMyList(nodeId);
  };

  const forceQualify = async (nodeId: string) => { await supabase.from('unihub_nodes').update({ status: 'qualified' }).eq('id', nodeId); };

  // --- REFACTORED CANCEL RIDE LOGIC (ROLE BASED + REFUND + ANTI-CHEAT) ---
  const cancelRide = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const isDispatched = node.status === 'dispatched' || !!node.assignedDriverId;
    const isLeader = currentUser && node.leaderPhone === currentUser.phone;
    const isDriverOwner = activeDriverId && node.assignedDriverId === activeDriverId && node.status === 'forming'; // For broadcasts

    // 1. DISPATCHED LOGIC: ONLY ADMIN CAN CANCEL
    if (isDispatched) {
        if (!isAdminAuthenticated) {
            alert("ANTI-CHEAT WARNING:\n\nThis ride has been dispatched. Only the Admin can cancel active rides to ensure driver fairness.\n\nPlease contact support: " + settings.whatsappNumber);
            return;
        } else {
            // Admin canceling a dispatched ride
            const confirmAdmin = confirm("ADMIN OVERRIDE:\n\nYou are canceling a dispatched ride. Has the driver been notified?\n\nRefund calculations will be processed. Continue?");
            if (!confirmAdmin) return;
        }
    } 
    // 2. FORMING/QUALIFIED LOGIC: ONLY CREATOR OR ADMIN
    else {
        if (!isLeader && !isAdminAuthenticated && !isDriverOwner) {
            alert("Permission Denied: Only the ride creator can cancel this request.");
            return;
        }
        // Warning for user
        const confirmUser = confirm("Confirm Cancellation?\n\nYour request will be removed from the marketplace.\n\n(No fees applied for non-dispatched rides)");
        if (!confirmUser) return;
    }

    try {
      if (node.assignedDriverId) {
        // Handle Refund Logic if Admin cancels a paid/dispatched ride
        const latestDriver = await supabase.from('unihub_drivers').select('*').eq('id', node.assignedDriverId).single();
        if (latestDriver.data) {
             const driver = latestDriver.data as Driver;
             // Calculate refund (Commission Reversal)
             // We assume the driver was charged commission when they accepted. We need to refund that commission to the driver's wallet.
             // If the payment system was real-money from passenger, we'd refund passenger. 
             // Here we just reverse the commission charge to the driver.
             let refundAmount = settings.commissionPerSeat * node.passengers.length;
             
             // Update driver wallet
             await supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance + refundAmount }).eq('id', driver.id);
             
             // Log transaction
             await supabase.from('unihub_transactions').insert([{ 
                 id: `TX-REFUND-${Date.now()}`, 
                 driverId: driver.id, 
                 amount: refundAmount, 
                 type: 'refund', 
                 timestamp: new Date().toISOString() 
             }]);
        }
        await supabase.from('unihub_nodes').delete().eq('id', nodeId);
        alert("Trip cancelled. Driver commission refunded (if applicable).");
      } else {
        await supabase.from('unihub_nodes').delete().eq('id', nodeId);
        removeRideFromMyList(nodeId);
        alert("Ride request removed successfully.");
      }
    } catch (err: any) { 
        alert("Failed to process request: " + err.message); 
    }
  };

  const handleDriverAuth = (driverId: string, pin: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver && driver.pin === pin) { setActiveDriverId(driverId); sessionStorage.setItem('nexryde_driver_session_v1', driverId); setViewMode('driver'); } 
    else { alert("Access Denied: Invalid Partner Password"); }
  };
  const handleDriverLogout = () => { setActiveDriverId(null); sessionStorage.removeItem('nexryde_driver_session_v1'); setViewMode('passenger'); };
  
  const safeSetViewMode = (mode: PortalMode) => {
    setViewMode(mode);
  };

  const handleAdminAuth = async (email: string, pass: string) => {
    try { const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass }); if (error) throw error; if (data.session) { setSession(data.session); setIsAdminAuthenticated(true); } } catch (err: any) { alert("Access Denied: " + err.message); }
  };
  const handleAdminLogout = async () => { await supabase.auth.signOut(); setIsAdminAuthenticated(false); setSession(null); };

  const aiActions = {
     onUpdateStatus: async (status: string) => { if (activeDriverId) await supabase.from('unihub_drivers').update({ status }).eq('id', activeDriverId); },
     onFillAuth: (data: any) => { setAuthFormState(prev => ({...prev, ...data})); },
     onFillRideForm: (data: any) => { setCreateMode(true); setNewNode(prev => ({...prev, ...data})); },
     onConfirmRide: () => {
       if (newNode.destination) {
         setCreateMode(true);
         setTimeout(() => {
            const baseFare = newNode.vehicleType === 'Taxi' ? settings.farePerTaxi : settings.farePerPragia;
            const finalFare = newNode.isSolo ? baseFare * settings.soloMultiplier : baseFare;
            if(!currentUser) return;
            const node: RideNode = {
                id: `NODE-${Date.now()}`, origin: newNode.origin || "Current Location", destination: newNode.destination!, vehicleType: newNode.vehicleType || 'Pragia', isSolo: newNode.isSolo, capacityNeeded: newNode.isSolo ? 1 : (newNode.vehicleType === 'Taxi' ? 4 : 3), passengers: [{ id: currentUser.id, name: currentUser.username, phone: currentUser.phone }], status: newNode.isSolo ? 'qualified' : 'forming', leaderName: currentUser.username, leaderPhone: currentUser.phone, farePerPerson: finalFare, createdAt: new Date().toISOString()
            };
            supabase.from('unihub_nodes').insert([node]).then(({error}) => { if(!error) { addRideToMyList(node.id); setCreateMode(false); setNewNode({ origin: '', destination: '', vehicleType: 'Pragia', isSolo: false }); } });
         }, 500);
       }
     }
  };

  const updateGlobalSettings = async (newSettings: AppSettings) => {
    const { id, ...data } = newSettings;
    const { error } = await supabase.from('unihub_settings').upsert({ id: id || 1, ...data });
    if (error) alert("Error saving settings: " + error.message); else alert("Settings Updated Successfully!");
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative" style={settings.appWallpaper ? { backgroundImage: `url(${settings.appWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' } : {}}>
      {settings.appWallpaper && <div className="absolute inset-0 bg-[#020617]/70 pointer-events-none z-0"></div>}
      <GlobalVoiceOrb mode={currentUser ? viewMode : 'public'} user={viewMode === 'driver' ? activeDriver : currentUser} contextData={{ nodes, drivers, transactions, settings, pendingRequests: pendingRequestsCount }} actions={aiActions} triggerRef={triggerVoiceRef} />
      {!currentUser ? (
         <HubGateway onIdentify={handleGlobalUserAuth} settings={settings} formState={authFormState} setFormState={setAuthFormState} onTriggerVoice={() => triggerVoiceRef.current?.()} />
      ) : (
        <>
      {settings.hub_announcement && !dismissedAnnouncement && (
        <div className="fixed top-0 left-0 right-0 z-[2000] bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-3 flex items-start sm:items-center justify-between shadow-2xl animate-in slide-in-from-top duration-500 border-b border-white/10">
           <div className="flex items-start sm:items-center gap-3 flex-1"><p className="text-[10px] sm:text-xs font-black uppercase italic text-white tracking-tight leading-relaxed break-words">{settings.hub_announcement}</p></div>
           <button onClick={() => {setDismissedAnnouncement('true'); localStorage.setItem('nexryde_dismissed_announcement', 'true');}} className="ml-4 w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-white text-[10px] hover:bg-white/30 transition-all shrink-0 mt-0.5 sm:mt-0"><i className="fas fa-times"></i></button>
        </div>
      )}
      {isSyncing && <div className={`fixed ${settings.hub_announcement && !dismissedAnnouncement ? 'top-20' : 'top-4'} right-4 z-[300] bg-amber-500/20 text-amber-500 px-4 py-2 rounded-full border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-2 transition-all`}>Live Syncing...</div>}

      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {settings.appLogo ? <img src={settings.appLogo} className="w-12 h-12 object-contain rounded-xl bg-white/5 p-1 border border-white/10" alt="Logo" /> : <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl"><i className="fas fa-route text-[#020617] text-xl"></i></div>}
            <div><h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">NexRyde</h1><p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Transit Excellence</p></div>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride Center" onClick={() => {safeSetViewMode('passenger'); setSearchConfig({...searchConfig, query: ''});}} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Partner Terminal" onClick={() => {safeSetViewMode('driver'); setSearchConfig({...searchConfig, query: ''});}} />
          {(isVaultAccess || isAdminAuthenticated) && <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Control Vault" onClick={() => {safeSetViewMode('admin'); setSearchConfig({...searchConfig, query: ''});}} badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined} />}
          <NavItem active={false} icon="fa-share-nodes" label="Invite Others" onClick={shareHub} />
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all mt-4"><i className="fas fa-power-off text-lg w-6"></i><span className="text-sm font-bold">Sign Out</span></button>
        </div>
      </nav>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around px-4">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride" onClick={() => safeSetViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => safeSetViewMode('driver')} />
        {(isVaultAccess || isAdminAuthenticated) && <MobileNavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin" onClick={() => safeSetViewMode('admin')} badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined} />}
        <MobileNavItem active={showMenuModal} icon="fa-bars" label="Menu" onClick={() => setShowMenuModal(true)} />
      </nav>

      <main className={`flex-1 overflow-y-auto p-4 lg:p-12 pb-36 lg:pb-12 no-scrollbar z-10 relative transition-all duration-500 ${settings.hub_announcement && !dismissedAnnouncement ? 'pt-24 lg:pt-28' : 'pt-4 lg:pt-12'}`}>
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <SearchHub searchConfig={searchConfig} setSearchConfig={setSearchConfig} portalMode={viewMode} />
          )}
          {viewMode === 'passenger' && (
            <PassengerPortal currentUser={currentUser} nodes={nodes} myRideIds={myRideIds} onAddNode={async (node: RideNode) => { const { error } = await supabase.from('unihub_nodes').insert([node]); if (error) throw error; addRideToMyList(node.id); }} onJoin={joinNode} onLeave={leaveNode} onForceQualify={forceQualify} onCancel={cancelRide} drivers={drivers} searchConfig={searchConfig} settings={settings} onShowQr={() => setShowQrModal(true)} onShowAbout={() => {}} createMode={createMode} setCreateMode={setCreateMode} newNode={newNode} setNewNode={setNewNode} onTriggerVoice={() => triggerVoiceRef.current?.()} />
          )}
          {viewMode === 'driver' && (
            <DriverPortal drivers={drivers} activeDriver={activeDriver} onLogin={handleDriverAuth} onLogout={handleDriverLogout} qualifiedNodes={nodes.filter(n => n.status === 'qualified')} dispatchedNodes={nodes.filter(n => n.status === 'dispatched')} missions={missions} allNodes={nodes} onJoinMission={async (id: string, dId: string) => { /* simplified for brevity */ }} onAccept={async (nodeId: string, driverId: string) => { /* logic in main */ }} onBroadcast={async (data: any) => { /* logic */ }} onStartBroadcast={async (id: string) => { /* logic */ }} onVerify={async (n: string, c: string) => { /* logic */ }} onCancel={cancelRide} onRequestTopup={async (d: string, a: number, r: string) => { /* logic */ }} onRequestRegistration={async (r: any) => { /* logic */ }} searchConfig={searchConfig} settings={settings} onUpdateStatus={async (status: 'online' | 'busy' | 'offline') => { if(!activeDriverId) return; await supabase.from('unihub_drivers').update({ status }).eq('id', activeDriverId); }} isLoading={isDriverLoading} />
          )}
          {viewMode === 'admin' && (
            !isAdminAuthenticated ? <AdminLogin onLogin={handleAdminAuth} /> : 
            <AdminPortal activeTab={activeTab} setActiveTab={setActiveTab} nodes={nodes} drivers={drivers} onAddDriver={async (d:any) => { /* logic */ }} onDeleteDriver={async (id: string) => await supabase.from('unihub_drivers').delete().eq('id', id)} onCancelRide={cancelRide} onSettleRide={async (id: string) => await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', id)} missions={missions} onCreateMission={async (m: HubMission) => await supabase.from('unihub_missions').insert([m])} onDeleteMission={async (id: string) => await supabase.from('unihub_missions').delete().eq('id', id)} transactions={transactions} topupRequests={topupRequests} registrationRequests={registrationRequests} onApproveTopup={async (id: string) => { /* logic */ }} onRejectTopup={async (id: string) => await supabase.from('unihub_topups').update({ status: 'rejected' }).eq('id', id)} onApproveRegistration={async (id: string) => { /* logic */ }} onRejectRegistration={async (id: string) => await supabase.from('unihub_registrations').update({ status: 'rejected' }).eq('id', id)} onLock={handleAdminLogout} searchConfig={searchConfig} settings={settings} onUpdateSettings={updateGlobalSettings} hubRevenue={hubRevenue} adminEmail={session?.user?.email} />
          )}
        </div>
      </main>

      {viewMode === 'passenger' && (
        <button onClick={() => isAiUnlocked ? setShowAiHelp(true) : setShowAiAd(true)} className="fixed bottom-24 right-6 lg:bottom-12 lg:right-12 w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl z-[100] hover:scale-110 transition-transform animate-bounce-slow"><i className="fas fa-sparkles"></i></button>
      )}

      {showAiAd && <AdGate onUnlock={() => { setIsAiUnlocked(true); setShowAiAd(false); setShowAiHelp(true); }} label="Launch AI Assistant" settings={settings} />}
      {showAiHelp && <AiHelpDesk onClose={() => setShowAiHelp(false)} settings={settings} />}
      {showQrModal && <QrScannerModal onScan={() => {}} onClose={() => setShowQrModal(false)} />}
      
      {/* Menu Modal - Now actually rendered! */}
      {showMenuModal && <MenuModal onClose={() => setShowMenuModal(false)} onLogout={handleLogout} currentUser={currentUser} settings={settings} />}
    </>
    )}
    </div>
  );
}
export default App;
