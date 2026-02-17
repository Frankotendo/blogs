
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './utils';
import { RideNode, Driver, HubMission, TopupRequest, RegistrationRequest, Transaction, AppSettings, SearchConfig, PortalMode, UniUser } from './types';
import { PassengerPortal } from './components/PassengerPortal';
import { DriverPortal } from './components/DriverPortal';
import { AdminPortal, AdminLogin } from './components/AdminPortal';
import { GlobalVoiceOrb } from './components/GlobalVoiceOrb';
import { HubGateway, NavItem, MobileNavItem, SearchHub, AiHelpDesk, MenuModal } from './components/SharedUI';

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

  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);

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
    adSenseClientId: "",
    adSenseSlotId: "",
    adSenseStatus: "inactive"
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
        supabase.from('unihub_missions').select('*').order('createdat', { ascending: false }),
        supabase.from('unihub_topups').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_transactions').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_registrations').select('*').order('timestamp', { ascending: false })
      ]);

      if (sData) {
        // SQL schema has both camelCase and snake_case variants for several fields.
        // We prioritize camelCase but check snake_case as fallback.
        const mappedSettings: AppSettings = {
            ...settings, 
            ...sData, 
            adminMomo: sData.adminMomo || sData.admin_momo || settings.adminMomo,
            adminMomoName: sData.adminMomoName || sData.admin_momo_name || settings.adminMomoName,
            whatsappNumber: sData.whatsappNumber || sData.whatsapp_number || settings.whatsappNumber,
            commissionPerSeat: sData.commissionPerSeat || sData.commission_per_seat || settings.commissionPerSeat,
            farePerPragia: sData.farePerPragia || sData.fare_per_pragia || settings.farePerPragia,
            farePerTaxi: sData.farePerTaxi || sData.fare_per_taxi || settings.farePerTaxi,
            soloMultiplier: sData.soloMultiplier || sData.solo_multiplier || settings.soloMultiplier,
            aboutMeText: sData.aboutMeText || sData.about_me_text || settings.aboutMeText,
            aboutMeImages: sData.aboutMeImages || sData.about_me_images || [],
            appWallpaper: sData.appWallpaper || sData.app_wallpaper || "",
            appLogo: sData.appLogo || sData.app_logo || "",
            registrationFee: sData.registrationFee || sData.registration_fee || settings.registrationFee
        };
        setSettings(mappedSettings);
      }
      
      if (nData) {
          // In SQL schema, unihub_nodes has both vehicleType and vehicle_type.
          const normalizedNodes = nData.map((n: any) => ({
              ...n,
              vehicleType: n.vehicleType || n.vehicle_type || 'Pragia'
          }));
          setNodes(normalizedNodes);
      }
      
      if (dData) {
          // SQL unihub_drivers has avatarUrl and avatar_url
          const normalizedDrivers = dData.map((d: any) => ({
              ...d,
              avatarUrl: d.avatarUrl || d.avatar_url || ''
          }));
          setDrivers(normalizedDrivers);
      }
      
      if (mData) {
          // unihub_missions has driversjoined and createdat (lowercase)
          const normalizedMissions = mData.map((m: any) => ({
              ...m,
              driversJoined: m.driversjoined || [],
              createdAt: m.createdat || m.createdAt
          }));
          setMissions(normalizedMissions);
      }
      
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
      supabase.channel('public:unihub_missions').on('postgres_changes', { event: '*', schema: 'public', table: 'unihub_missions' }, () => fetchData()).subscribe()
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
    if (!phone || !pin) { alert("Phone and PIN are required."); return; }
    setIsSyncing(true);
    try {
      const { data } = await supabase.from('unihub_users').select('*').eq('phone', phone).maybeSingle();
      if (mode === 'login') {
        if (!data) { alert("Profile not found!"); setIsSyncing(false); return; }
        const user = data as UniUser;
        if (user.pin && user.pin !== pin) { alert("Incorrect PIN."); setIsSyncing(false); return; }
        setCurrentUser(user);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(user));
      } else {
        if (data) { alert("Account exists! Please Sign In."); setIsSyncing(false); return; }
        const newUser: UniUser = { id: `USER-${Date.now()}`, username, phone, pin };
        await supabase.from('unihub_users').insert([newUser]);
        setCurrentUser(newUser);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(newUser));
      }
    } catch (err: any) { alert("Error: " + err.message); } finally { setIsSyncing(false); }
  };

  const handleLogout = () => { if (confirm("Sign out?")) { localStorage.removeItem('nexryde_user_v1'); setCurrentUser(null); } };
  
  const updateGlobalSettings = async (newSettings: AppSettings) => {
    const { id, ...data } = newSettings;
    // Map to DB columns exactly as they appear in SQL schema, using camelCase primary keys but updating snake_case shadows if they exist
    const dbData = {
      adminMomo: data.adminMomo,
      admin_momo: data.adminMomo,
      adminMomoName: data.adminMomoName,
      admin_momo_name: data.adminMomoName,
      whatsappNumber: data.whatsappNumber,
      whatsapp_number: data.whatsappNumber,
      commissionPerSeat: data.commissionPerSeat,
      commission_per_seat: data.commissionPerSeat,
      shuttleCommission: data.shuttleCommission,
      shuttle_commission: data.shuttleCommission,
      farePerPragia: data.farePerPragia,
      fare_per_pragia: data.farePerPragia,
      farePerTaxi: data.farePerTaxi,
      fare_per_taxi: data.farePerTaxi,
      soloMultiplier: data.soloMultiplier,
      solo_multiplier: data.soloMultiplier,
      aboutMeText: data.aboutMeText,
      about_me_text: data.aboutMeText,
      aboutMeImages: data.aboutMeImages,
      about_me_images: data.aboutMeImages,
      appWallpaper: data.appWallpaper,
      app_wallpaper: data.appWallpaper,
      appLogo: data.appLogo,
      registrationFee: data.registrationFee,
      registration_fee: data.registrationFee,
      hub_announcement: data.hub_announcement,
      adSenseClientId: data.adSenseClientId,
      adSenseSlotId: data.adSenseSlotId,
      adSenseStatus: data.adSenseStatus
    };

    const { error } = await supabase.from('unihub_settings').upsert({ id: id || 1, ...dbData });
    if (error) alert("Sync Error: " + error.message); else alert("Settings Synced!");
  };

  const handleAdminAuth = async (email: string, pass: string) => {
    try { 
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass }); 
      if (error) throw error; 
      if (data.session) { setSession(data.session); setIsAdminAuthenticated(true); } 
    } catch (err: any) { alert("Access Denied: " + err.message); }
  };

  const handleAdminLogout = async () => { await supabase.auth.signOut(); setIsAdminAuthenticated(false); setSession(null); };

  const handleDriverAuth = (driverId: string, pin: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver && driver.pin === pin) {
      setActiveDriverId(driverId);
      sessionStorage.setItem('nexryde_driver_session_v1', driverId);
    } else {
      alert("Invalid Driver PIN");
    }
  };

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.passengers.length < node.capacityNeeded) {
      const newPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
      const isQualified = newPassengers.length >= node.capacityNeeded;
      let updatedStatus = node.status;
      if (isQualified && node.status === 'forming') updatedStatus = 'qualified';
      await supabase.from('unihub_nodes').update({ passengers: newPassengers, status: updatedStatus }).eq('id', nodeId);
      setMyRideIds(prev => [...prev, nodeId]);
    }
  };

  const leaveNode = async (nodeId: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newPassengers = node.passengers.filter(p => p.phone !== phone);
    await supabase.from('unihub_nodes').update({ passengers: newPassengers, status: 'forming' }).eq('id', nodeId);
    setMyRideIds(prev => prev.filter(id => id !== nodeId));
  };

  const cancelRide = async (nodeId: string) => {
    if (confirm("Cancel this ride?")) {
      await supabase.from('unihub_nodes').delete().eq('id', nodeId);
      setMyRideIds(prev => prev.filter(id => id !== nodeId));
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative" style={settings.appWallpaper ? { backgroundImage: `url(${settings.appWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' } : {}}>
      {settings.appWallpaper && <div className="absolute inset-0 bg-[#020617]/80 pointer-events-none z-0"></div>}
      <GlobalVoiceOrb mode={currentUser ? viewMode : 'public'} user={viewMode === 'driver' ? activeDriver : currentUser} contextData={{ nodes, drivers, transactions, settings, pendingRequests: pendingRequestsCount }} actions={{
          onUpdateStatus: async (s: string) => activeDriverId && await supabase.from('unihub_drivers').update({ status: s }).eq('id', activeDriverId),
          onFillAuth: (d: any) => setAuthFormState(prev => ({...prev, ...d})),
          onFillRideForm: (d: any) => { setCreateMode(true); setNewNode(prev => ({...prev, ...d})); }
      }} triggerRef={triggerVoiceRef} />
      
      {!currentUser ? (
         <HubGateway onIdentify={handleGlobalUserAuth} settings={settings} formState={authFormState} setFormState={setAuthFormState} onTriggerVoice={() => triggerVoiceRef.current?.()} />
      ) : (
        <>
      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center space-x-4">
          {settings.appLogo ? <img src={settings.appLogo} className="w-12 h-12 object-contain" alt="Logo" /> : <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center"><i className="fas fa-route text-black"></i></div>}
          <h1 className="text-2xl font-black italic uppercase text-white">NexRyde</h1>
        </div>
        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride Center" onClick={() => setViewMode('passenger')} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Partner Terminal" onClick={() => setViewMode('driver')} />
          {(isVaultAccess || isAdminAuthenticated) && <NavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Control Vault" onClick={() => setViewMode('admin')} badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined} />}
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-white/5 mt-4"><i className="fas fa-power-off"></i><span className="text-sm font-bold">Sign Out</span></button>
        </div>
      </nav>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride" onClick={() => setViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => setViewMode('driver')} />
        {(isVaultAccess || isAdminAuthenticated) && <MobileNavItem active={viewMode === 'admin'} icon="fa-shield-halved" label="Admin" badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined} onClick={() => setViewMode('admin')} />}
        <MobileNavItem active={showMenuModal} icon="fa-bars" label="Menu" onClick={() => setShowMenuModal(true)} />
      </nav>

      <main className="flex-1 overflow-y-auto p-4 lg:p-12 pb-36 z-10 no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8">
          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <SearchHub searchConfig={searchConfig} setSearchConfig={setSearchConfig} portalMode={viewMode} />
          )}
          {viewMode === 'passenger' && (
            <PassengerPortal currentUser={currentUser} nodes={nodes} myRideIds={myRideIds} onAddNode={async (n: any) => await supabase.from('unihub_nodes').insert([n])} onJoin={joinNode} onLeave={leaveNode} onForceQualify={async (id: string) => await supabase.from('unihub_nodes').update({ status: 'qualified' }).eq('id', id)} onCancel={cancelRide} drivers={drivers} searchConfig={searchConfig} settings={settings} createMode={createMode} setCreateMode={setCreateMode} newNode={newNode} setNewNode={setNewNode} onTriggerVoice={() => triggerVoiceRef.current?.()} />
          )}
          {viewMode === 'driver' && (
            <DriverPortal drivers={drivers} activeDriver={activeDriver} onLogin={handleDriverAuth} onLogout={() => setActiveDriverId(null)} qualifiedNodes={nodes.filter(n => n.status === 'qualified')} dispatchedNodes={nodes.filter(n => n.status === 'dispatched')} missions={missions} allNodes={nodes} onAccept={async (nid: string, did: string) => await supabase.from('unihub_nodes').update({ assignedDriverId: did, status: 'dispatched' }).eq('id', nid)} searchConfig={searchConfig} settings={settings} onUpdateStatus={async (s: any) => activeDriverId && await supabase.from('unihub_drivers').update({ status: s }).eq('id', activeDriverId)} isLoading={isDriverLoading} />
          )}
          {viewMode === 'admin' && (
            !isAdminAuthenticated ? <AdminLogin onLogin={handleAdminAuth} /> : 
            <AdminPortal 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                nodes={nodes} 
                drivers={drivers} 
                missions={missions} 
                transactions={transactions} 
                topupRequests={topupRequests} 
                registrationRequests={registrationRequests} 
                onLock={handleAdminLogout} 
                settings={settings} 
                onUpdateSettings={updateGlobalSettings} 
                hubRevenue={hubRevenue} 
                adminEmail={session?.user?.email || 'admin@nexryde.com'} 
                onApproveTopup={async (id: string, did: string, amt: number) => {
                    await supabase.from('unihub_topups').update({ status: 'approved' }).eq('id', id);
                    const driver = drivers.find(d => d.id === did);
                    if (driver) await supabase.from('unihub_drivers').update({ walletBalance: (driver.walletBalance || 0) + amt }).eq('id', did);
                    fetchData();
                }}
                onRejectTopup={async (id: string) => {
                    await supabase.from('unihub_topups').update({ status: 'rejected' }).eq('id', id);
                    fetchData();
                }}
                onApproveRegistration={async (req: RegistrationRequest) => {
                    const newDriver: Driver = {
                        id: req.id,
                        name: req.name,
                        vehicleType: req.vehicleType,
                        licensePlate: req.licensePlate,
                        contact: req.contact,
                        pin: req.pin,
                        walletBalance: 0,
                        rating: 5,
                        status: 'offline',
                        avatarUrl: req.avatarUrl
                    };
                    await supabase.from('unihub_drivers').insert([newDriver]);
                    await supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', req.id);
                    fetchData();
                }}
                onRejectRegistration={async (id: string) => {
                    await supabase.from('unihub_registrations').update({ status: 'rejected' }).eq('id', id);
                    fetchData();
                }}
            />
          )}
        </div>
      </main>

      {showAiHelp && <AiHelpDesk onClose={() => setShowAiHelp(false)} settings={settings} />}
      {showMenuModal && <MenuModal onClose={() => setShowMenuModal(false)} onLogout={handleLogout} currentUser={currentUser} settings={settings} />}
    </>
    )}
    </div>
  );
}
export default App;
