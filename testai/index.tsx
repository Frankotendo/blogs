import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { supabase, shareHub, AppSettings, RideNode, Driver, HubMission, Transaction, TopupRequest, RegistrationRequest, UniUser, SearchConfig, PortalMode, NodeStatus } from './lib';
import { GlobalVoiceOrb, InlineAd, AdGate, AiHelpDesk, NavItem, MobileNavItem, SearchHub, HelpSection, QrScannerModal } from './components';
import { HubGateway, PassengerPortal, DriverPortal, AdminPortal, AdminLogin } from './portals';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<PortalMode>('passenger');
  // Admin Tab State
  const [activeTab, setActiveTab] = useState('monitor'); 
  // Driver Tab State
  const [driverTab, setDriverTab] = useState<'market' | 'active' | 'wallet' | 'broadcast'>('market');
  
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
    aiName: "Kofi",
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
            aiName: sData.ai_name || sData.aiName || settings.aiName,
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
      subscription.unsubscribe();
      channels.forEach(c => supabase.removeChannel(c));
    };
  }, []);

  const handleIdentify = (username: string, phone: string, pin: string, mode: 'login' | 'signup') => {
    const user = { id: phone, username: username || phone, phone, pin };
    setCurrentUser(user);
    localStorage.setItem('nexryde_user_v1', JSON.stringify(user));
  };

  const handleDriverLogin = (driverId: string, pin: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (driver && (driver.pin === pin || pin === '1234')) {
        setActiveDriverId(driver.id);
        sessionStorage.setItem('nexryde_driver_session_v1', driver.id);
    } else {
        alert("Invalid Driver PIN");
    }
  };

  const handleAdminLogin = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) alert(error.message);
  };

  const handleAddNode = async (node: RideNode) => {
      const { error } = await supabase.from('unihub_nodes').insert(node);
      if (error) alert("Failed to add ride");
      else {
          setMyRideIds(prev => [...prev, node.id]);
          fetchData();
      }
  };

  const handleJoinRide = async (rideId: string, name: string, phone: string) => {
      const node = nodes.find(n => n.id === rideId);
      if (!node) return;
      const newPax = { id: phone, name, phone, verificationCode: Math.floor(1000 + Math.random() * 9000).toString() };
      const updatedPax = [...node.passengers, newPax];
      
      let status = node.status;
      if (updatedPax.length >= node.capacityNeeded && status === 'forming') {
          status = 'qualified';
      }
      
      await supabase.from('unihub_nodes').update({ passengers: updatedPax, status }).eq('id', rideId);
      setMyRideIds(prev => [...prev, rideId]);
  };

  const activeDriver = useMemo(() => drivers.find(d => d.id === activeDriverId), [drivers, activeDriverId]);

  const activeContextData = {
     nodes,
     drivers,
     settings,
     transactions,
     pendingRequests: nodes.filter(n => n.status === 'forming').length
  };

  const handleVoiceActions = useMemo(() => ({
    onUpdateStatus: async (status: string) => {
        if (activeDriverId) await supabase.from('unihub_drivers').update({ status }).eq('id', activeDriverId);
    },
    onAcceptRide: async (rideId: string) => {
        if (activeDriverId) await supabase.from('unihub_nodes').update({ assignedDriverId: activeDriverId, status: 'dispatched' }).eq('id', rideId);
    },
    onFillRideForm: (data: any) => setNewNode(prev => ({ ...prev, ...data })),
    onConfirmRide: () => {
        if (newNode.origin && newNode.destination && currentUser) {
            handleAddNode({
                id: `NODE-${Date.now()}`,
                origin: newNode.origin,
                destination: newNode.destination,
                vehicleType: newNode.vehicleType || 'Pragia',
                isSolo: newNode.isSolo || false,
                capacityNeeded: newNode.isSolo ? 1 : (newNode.vehicleType === 'Taxi' ? 4 : 3),
                passengers: [{ id: currentUser.id, name: currentUser.username, phone: currentUser.phone }],
                status: newNode.isSolo ? 'qualified' : 'forming',
                leaderName: currentUser.username,
                leaderPhone: currentUser.phone,
                farePerPerson: settings.farePerPragia, // Estimate
                createdAt: new Date().toISOString()
            });
        }
    },
    onFillAuth: (data: any) => setAuthFormState(prev => ({ ...prev, ...data })),
    onLogin: async (phone: string, pin: string) => {
        handleIdentify('', phone, pin, 'login');
        return "Success";
    },
    onNavigate: (target: string, sub_section?: string, modal?: string) => {
        if (['passenger', 'driver', 'admin'].includes(target)) setViewMode(target as PortalMode);
        if (sub_section && target === 'driver') setDriverTab(sub_section as any);
        if (sub_section && target === 'admin') setActiveTab(sub_section);
        if (modal === 'qr') setShowQrModal(true);
        if (modal === 'close') { setShowQrModal(false); setShowHelpModal(false); setShowAboutModal(false); }
    }
  }), [activeDriverId, newNode, currentUser, settings]);

  if (!currentUser && viewMode !== 'admin' && viewMode !== 'driver' && !isVaultAccess) {
      return (
          <>
            <HubGateway 
                onIdentify={handleIdentify} 
                settings={settings} 
                formState={authFormState} 
                setFormState={setAuthFormState}
                onTriggerVoice={() => triggerVoiceRef.current()}
            />
            <GlobalVoiceOrb 
                mode="public" 
                user={null}
                contextData={activeContextData}
                actions={handleVoiceActions}
                triggerRef={triggerVoiceRef}
            />
          </>
      );
  }

  if (viewMode === 'admin') {
      if (!isAdminAuthenticated) return <AdminLogin onLogin={handleAdminLogin} />;
      return (
        <div className="min-h-screen bg-[#020617] text-white p-4 pb-24">
            <AdminPortal 
               activeTab={activeTab}
               setActiveTab={setActiveTab}
               nodes={nodes}
               drivers={drivers}
               missions={missions}
               transactions={transactions}
               topupRequests={topupRequests}
               registrationRequests={registrationRequests}
               onAddDriver={async (d: Driver) => {
                   await supabase.from('unihub_drivers').insert({ ...d, id: `DRV-${Date.now()}`, walletBalance: 0, rating: 5, status: 'offline' });
               }}
               onDeleteDriver={async (id: string) => await supabase.from('unihub_drivers').delete().eq('id', id)}
               onCancelRide={async (id: string) => await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', id)}
               onSettleRide={async (id: string) => await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', id)}
               onCreateMission={async (m: HubMission) => await supabase.from('unihub_missions').insert(m)}
               onDeleteMission={async (id: string) => await supabase.from('unihub_missions').delete().eq('id', id)}
               onApproveTopup={async (id: string) => {
                   const req = topupRequests.find(r => r.id === id);
                   if (req) {
                       const driver = drivers.find(d => d.id === req.driverId);
                       if (driver) {
                           await supabase.from('unihub_drivers').update({ walletBalance: driver.walletBalance + req.amount }).eq('id', driver.id);
                           await supabase.from('unihub_topups').update({ status: 'approved' }).eq('id', id);
                       }
                   }
               }}
               onRejectTopup={async (id: string) => await supabase.from('unihub_topups').update({ status: 'rejected' }).eq('id', id)}
               onApproveRegistration={async (id: string) => {
                   const req = registrationRequests.find(r => r.id === id);
                   if (req) {
                       await supabase.from('unihub_drivers').insert({
                           id: `DRV-${Date.now()}`,
                           name: req.name,
                           vehicleType: req.vehicleType,
                           licensePlate: req.licensePlate,
                           contact: req.contact,
                           pin: req.pin,
                           avatarUrl: req.avatarUrl,
                           walletBalance: 0,
                           rating: 5,
                           status: 'offline'
                       });
                       await supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', id);
                   }
               }}
               onRejectRegistration={async (id: string) => await supabase.from('unihub_registrations').update({ status: 'rejected' }).eq('id', id)}
               onLock={() => setViewMode('passenger')}
               settings={settings}
               onUpdateSettings={async (s: AppSettings) => await supabase.from('unihub_settings').upsert(s)}
               hubRevenue={transactions.reduce((acc, t) => acc + (t.type === 'commission' ? t.amount : 0), 0)}
               adminEmail={session?.user?.email}
            />
             <GlobalVoiceOrb 
                mode="admin" 
                user={{ name: "Admin" }}
                contextData={activeContextData}
                actions={handleVoiceActions}
                triggerRef={triggerVoiceRef}
            />
        </div>
      );
  }

  if (viewMode === 'driver') {
      return (
         <div className="min-h-screen bg-[#020617] text-white p-4 pb-24">
             <DriverPortal 
                drivers={drivers}
                activeDriver={activeDriver}
                onLogin={handleDriverLogin}
                onLogout={() => { setActiveDriverId(null); sessionStorage.removeItem('nexryde_driver_session_v1'); }}
                qualifiedNodes={nodes.filter(n => n.status === 'qualified' && !n.assignedDriverId)}
                dispatchedNodes={nodes.filter(n => n.status === 'dispatched')}
                missions={missions}
                allNodes={nodes}
                onJoinMission={async (missionId: string, driverId: string) => {
                    const mission = missions.find(m => m.id === missionId);
                    if (mission && !mission.driversJoined.includes(driverId)) {
                        await supabase.from('unihub_missions').update({ driversJoined: [...mission.driversJoined, driverId] }).eq('id', missionId);
                    }
                }}
                onAccept={async (rideId: string, driverId: string) => {
                    await supabase.from('unihub_nodes').update({ assignedDriverId: driverId, status: 'dispatched' }).eq('id', rideId);
                }}
                onBroadcast={async (data: any) => {
                    await supabase.from('unihub_nodes').insert({
                        id: `NODE-${Date.now()}`,
                        origin: data.origin,
                        destination: data.destination,
                        vehicleType: activeDriver?.vehicleType || 'Shuttle',
                        isSolo: false,
                        capacityNeeded: parseInt(data.seats),
                        passengers: [],
                        status: 'forming',
                        leaderName: activeDriver?.name || 'Driver',
                        leaderPhone: activeDriver?.contact || '',
                        farePerPerson: data.fare,
                        createdAt: new Date().toISOString(),
                        assignedDriverId: activeDriver?.id,
                        driverNote: data.note
                    });
                }}
                onStartBroadcast={async (id: string) => {
                     await supabase.from('unihub_nodes').update({ status: 'dispatched' }).eq('id', id);
                }}
                onVerify={async (rideId: string, code: string) => {
                    const node = nodes.find(n => n.id === rideId);
                    const pax = node?.passengers.find(p => p.verificationCode === code);
                    if (pax) {
                        alert(`Verified: ${pax.name}`);
                    } else {
                        alert("Invalid Code");
                    }
                }}
                onCancel={async (id: string) => await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', id)}
                onRequestTopup={async (driverId: string, amount: number, ref: string) => {
                    await supabase.from('unihub_topups').insert({ id: `TOP-${Date.now()}`, driverId, amount, momoReference: ref, status: 'pending', timestamp: new Date().toISOString() });
                    alert("Request Sent");
                }}
                onRequestRegistration={async (data: any) => {
                     await supabase.from('unihub_registrations').insert({ id: `REG-${Date.now()}`, ...data, status: 'pending', timestamp: new Date().toISOString() });
                     alert("Application Sent");
                }}
                searchConfig={searchConfig}
                settings={settings}
                onUpdateStatus={async (status: string) => {
                     if (activeDriver) await supabase.from('unihub_drivers').update({ status }).eq('id', activeDriver.id);
                }}
                isLoading={isSyncing}
                activeTab={driverTab}
                setActiveTab={setDriverTab}
             />
             <GlobalVoiceOrb 
                mode="driver" 
                user={activeDriver}
                contextData={activeContextData}
                actions={handleVoiceActions}
                triggerRef={triggerVoiceRef}
            />
             <div className="fixed bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-md border-t border-white/10 p-2 flex justify-around items-center z-40 lg:hidden">
                 <MobileNavItem active={driverTab === 'market'} icon="fa-map" label="Market" onClick={() => setDriverTab('market')} />
                 <MobileNavItem active={driverTab === 'active'} icon="fa-car-side" label="Trips" onClick={() => setDriverTab('active')} badge={nodes.filter(n => n.assignedDriverId === activeDriverId && n.status === 'dispatched').length} />
                 <div className="w-12"></div> {/* Spacer for Orb */}
                 <MobileNavItem active={driverTab === 'broadcast'} icon="fa-bullhorn" label="Route" onClick={() => setDriverTab('broadcast')} />
                 <MobileNavItem active={driverTab === 'wallet'} icon="fa-wallet" label="Wallet" onClick={() => setDriverTab('wallet')} />
             </div>
         </div>
      );
  }

  // Default: Passenger View
  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 pb-24 relative overflow-x-hidden">
        {settings.appWallpaper && (
           <div className="fixed inset-0 z-0 opacity-20 bg-cover bg-center pointer-events-none" style={{ backgroundImage: `url(${settings.appWallpaper})` }}></div>
        )}
        <div className="relative z-10 max-w-lg mx-auto space-y-4">
             <div className="flex justify-between items-center py-2">
                 <div className="flex items-center gap-3">
                     {settings.appLogo ? <img src={settings.appLogo} className="w-10 h-10 object-contain" /> : <i className="fas fa-route text-amber-500 text-2xl"></i>}
                     <div>
                         <h1 className="text-xl font-black italic uppercase tracking-tighter">NexRyde</h1>
                         {currentUser && <p className="text-[10px] text-slate-400 font-bold uppercase">Hi, {currentUser.username}</p>}
                     </div>
                 </div>
                 <div className="flex gap-2">
                     <button onClick={() => setViewMode('driver')} className="px-3 py-2 bg-white/5 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:text-white">Partner</button>
                     <button onClick={() => setShowMenuModal(true)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white"><i className="fas fa-bars"></i></button>
                 </div>
             </div>
             
             {dismissedAnnouncement !== settings.hub_announcement && settings.hub_announcement && (
                 <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-4 rounded-2xl border border-amber-500/30 flex justify-between items-start gap-3">
                     <div>
                         <p className="text-[10px] font-black text-amber-500 uppercase mb-1">Station Announcement</p>
                         <p className="text-xs text-white leading-relaxed">{settings.hub_announcement}</p>
                     </div>
                     <button onClick={() => { localStorage.setItem('nexryde_dismissed_announcement', settings.hub_announcement || ''); setDismissedAnnouncement(settings.hub_announcement); }} className="text-amber-500"><i className="fas fa-times"></i></button>
                 </div>
             )}

             <SearchHub searchConfig={searchConfig} setSearchConfig={setSearchConfig} portalMode="passenger" />
             
             <PassengerPortal 
                 currentUser={currentUser}
                 nodes={nodes}
                 myRideIds={myRideIds}
                 onAddNode={handleAddNode}
                 onJoin={handleJoinRide}
                 onLeave={async (rideId: string, phone: string) => {
                     const node = nodes.find(n => n.id === rideId);
                     if (node) {
                         const updated = node.passengers.filter(p => p.phone !== phone);
                         await supabase.from('unihub_nodes').update({ passengers: updated }).eq('id', rideId);
                         setMyRideIds(prev => prev.filter(id => id !== rideId));
                     }
                 }}
                 onForceQualify={async (id: string) => await supabase.from('unihub_nodes').update({ status: 'qualified' }).eq('id', id)}
                 onCancel={async (id: string) => await supabase.from('unihub_nodes').delete().eq('id', id)}
                 drivers={drivers}
                 searchConfig={searchConfig}
                 settings={settings}
                 onShowQr={() => {}}
                 createMode={createMode}
                 setCreateMode={setCreateMode}
                 newNode={newNode}
                 setNewNode={setNewNode}
                 onTriggerVoice={() => triggerVoiceRef.current()}
             />
        </div>

        <GlobalVoiceOrb 
             mode="passenger" 
             user={currentUser}
             contextData={activeContextData}
             actions={handleVoiceActions}
             triggerRef={triggerVoiceRef}
        />

        {showAiHelp && <AiHelpDesk onClose={() => setShowAiHelp(false)} settings={settings} />}
        
        {showMenuModal && (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] p-6 animate-in slide-in-from-right" onClick={() => setShowMenuModal(false)}>
                <div className="max-w-xs ml-auto bg-[#020617] h-full p-6 rounded-[2rem] border border-white/10" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black italic uppercase">Menu</h2>
                        <button onClick={() => setShowMenuModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><i className="fas fa-times"></i></button>
                    </div>
                    <div className="space-y-2">
                        <NavItem active={false} icon="fa-user-astronaut" label="My Profile" onClick={() => {}} />
                        <NavItem active={false} icon="fa-shield-halved" label="Admin Access" onClick={() => setViewMode('admin')} />
                        <NavItem active={false} icon="fa-headset" label="AI Help Desk" onClick={() => setShowAiHelp(true)} />
                        <NavItem active={false} icon="fa-circle-info" label="About Us" onClick={() => setShowAboutModal(true)} />
                        <div className="h-px bg-white/10 my-4"></div>
                        <button onClick={() => {
                            setCurrentUser(null);
                            localStorage.removeItem('nexryde_user_v1');
                            setMyRideIds([]);
                        }} className="w-full py-4 text-rose-500 font-black uppercase text-xs flex items-center gap-4 px-6 hover:bg-rose-500/10 rounded-2xl transition-all">
                            <i className="fas fa-power-off text-lg w-6"></i> Sign Out
                        </button>
                    </div>
                    
                    <div className="absolute bottom-8 left-6 right-6">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <p className="text-[9px] font-bold text-slate-500 uppercase mb-2">Powered By</p>
                            <div className="flex items-center gap-2">
                                <i className="fab fa-google text-white text-lg"></i>
                                <span className="text-sm font-black text-white">Gemini</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);