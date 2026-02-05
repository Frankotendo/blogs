import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from './lib/clients';
import { shareHub } from './lib/utils';
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
  
  // FIXED: Safely parse user from local storage and ensure walletBalance exists
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
        { data: regData },
        { data: uData }
      ] = await Promise.all([
        supabase.from('unihub_settings').select('*').single(),
        supabase.from('unihub_nodes').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_drivers').select('*'),
        supabase.from('unihub_missions').select('*').order('createdAt', { ascending: false }),
        supabase.from('unihub_topups').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_transactions').select('*').order('timestamp', { ascending: false }),
        supabase.from('unihub_registrations').select('*').order('timestamp', { ascending: false }),
        currentUser ? supabase.from('unihub_users').select('*').eq('id', currentUser.id).single() : { data: null }
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
      if (uData && currentUser) {
          // Sync wallet balance
          const updatedUser = { ...currentUser, walletBalance: uData.walletBalance ?? 0 };
          setCurrentUser(updatedUser);
          localStorage.setItem('nexryde_user_v1', JSON.stringify(updatedUser));
      }
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
  const onlineDriverCount = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);
  const activeNodeCount = useMemo(() => nodes.filter(n => n.status !== 'completed').length, [nodes]);
  const hubRevenue = useMemo(() => transactions.reduce((a, b) => a + b.amount, 0), [transactions]);
  const pendingRequestsCount = useMemo(() => 
    topupRequests.filter(r => r.status === 'pending').length + 
    registrationRequests.filter(r => r.status === 'pending').length, 
  [topupRequests, registrationRequests]);

  const getLatestDriver = async (id: string) => {
    const { data, error } = await supabase.from('unihub_drivers').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Driver;
  };

  const handleGlobalUserAuth = async (username: string, phone: string, pin: string, mode: 'login' | 'signup') => {
    if (!phone || !pin) {
      alert("Phone number and 4-digit PIN are required.");
      return;
    }
    if (pin.length !== 4) {
       alert("PIN must be exactly 4 digits.");
       return;
    }
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('unihub_users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (mode === 'login') {
        if (!data) {
          alert("Profile not found! Please create an account first.");
          setIsSyncing(false);
          return;
        }
        
        const user = data as UniUser;

        if (user.pin) {
            if (user.pin !== pin) {
                alert("Access Denied: Incorrect PIN.");
                setIsSyncing(false);
                return;
            }
        } else {
            await supabase.from('unihub_users').update({ pin }).eq('id', user.id);
            user.pin = pin; 
            alert("Security Update: This PIN has been linked to your account.");
        }

        // Ensuring walletBalance exists
        const safeUser = { ...user, walletBalance: user.walletBalance ?? 0 };
        setCurrentUser(safeUser);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(safeUser));
      } else {
        if (data) {
          alert("An account with this phone already exists! Please Sign In.");
          setIsSyncing(false);
          return;
        }
        if (!username) { alert("Please enter a username for your profile."); setIsSyncing(false); return; }
        
        const newUser: UniUser = { id: `USER-${Date.now()}`, username, phone, pin, walletBalance: 0 };
        const { error: insertErr } = await supabase.from('unihub_users').insert([newUser]);
        if (insertErr) throw insertErr;
        
        setCurrentUser(newUser);
        localStorage.setItem('nexryde_user_v1', JSON.stringify(newUser));
      }
    } catch (err: any) {
      alert("Identity Error: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Sign out of NexRyde?")) {
      localStorage.removeItem('nexryde_user_v1');
      setCurrentUser(null);
    }
  };

  const joinMission = async (missionId: string, driverId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;
    
    const latestDriver = await getLatestDriver(driverId);
    if (!latestDriver) return;

    if (mission.driversJoined.includes(driverId)) {
      alert("You are already stationed at this hotspot.");
      return;
    }
    if (latestDriver.walletBalance < mission.entryFee) {
      alert("Insufficient Balance for Hotspot Entry Fee.");
      return;
    }

    const newJoined = [...mission.driversJoined, driverId];
    
    await Promise.all([
      supabase.from('unihub_missions').update({ driversJoined: newJoined }).eq('id', missionId),
      supabase.from('unihub_drivers').update({ walletBalance: latestDriver.walletBalance - mission.entryFee }).eq('id', driverId),
      supabase.from('unihub_transactions').insert([{
        id: `TX-MISSION-${Date.now()}`,
        driverId,
        amount: mission.entryFee,
        type: 'commission', 
        timestamp: new Date().toLocaleString()
      }])
    ]);

    alert(`Successfully stationed at ${mission.location}! ₵${mission.entryFee} deducted.`);
  };

  const addRideToMyList = (nodeId: string) => {
    setMyRideIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
  };

  const removeRideFromMyList = (nodeId: string) => {
    setMyRideIds(prev => prev.filter(id => id !== nodeId));
  };

  const joinNode = async (nodeId: string, name: string, phone: string) => {
    if (!currentUser || (currentUser.walletBalance ?? 0) < 2) { 
        alert("Insufficient wallet balance to join ride.");
        return;
    }
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.passengers.length < node.capacityNeeded) {
      const newPassengers = [...node.passengers, { id: `P-${Date.now()}`, name, phone }];
      const isQualified = newPassengers.length >= node.capacityNeeded;
      let updatedStatus: NodeStatus = node.status;
      if (isQualified && node.status === 'forming') {
          updatedStatus = 'qualified';
      }
      
      await supabase.from('unihub_nodes').update({ 
        passengers: newPassengers, 
        status: updatedStatus 
      }).eq('id', nodeId);

      addRideToMyList(nodeId);
    }
  };

  const leaveNode = async (nodeId: string, phone: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const newPassengers = node.passengers.filter(p => p.phone !== phone);
    const updatedStatus = newPassengers.length < node.capacityNeeded && node.status === 'qualified' ? 'forming' : node.status;

    await supabase.from('unihub_nodes').update({ 
        passengers: newPassengers, 
        status: updatedStatus
    }).eq('id', nodeId);
    removeRideFromMyList(nodeId);
  };

  const forceQualify = async (nodeId: string) => {
    await supabase.from('unihub_nodes').update({ status: 'qualified' }).eq('id', nodeId);
  };

  const acceptRide = async (nodeId: string, driverId: string, customFare?: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const activeRide = nodes.find(n => n.assignedDriverId === driverId && n.status !== 'completed');
    if (activeRide) {
        alert("Please complete your current active ride or broadcast before accepting a new one.");
        return;
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const updatedPassengers = node.passengers.map(p => ({
        ...p,
        verificationCode: Math.floor(1000 + Math.random() * 9000).toString()
    }));

    try {
        await supabase.from('unihub_nodes').update({ 
              status: 'dispatched', 
              assignedDriverId: driverId, 
              verificationCode, 
              passengers: updatedPassengers, 
              negotiatedTotalFare: customFare || node?.negotiatedTotalFare
        }).eq('id', nodeId);
    
        alert(customFare ? `Premium trip accepted at ₵${customFare}! Proceed to pickup.` : "Ride accepted! Proceed to pickup.");
    } catch (err: any) {
        console.error("Accept ride error:", err);
        alert("Failed to accept ride. Please try again.");
    }
  };

  const verifyRide = async (nodeId: string, code: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    if (node.status === 'completed') {
        alert("Trip already completed.");
        return;
    }

    const isMasterCode = node.verificationCode === code;
    const passengerMatch = node.passengers.find(p => p.verificationCode === code);

    if (isMasterCode || passengerMatch) {
      try {
        const driverId = node.assignedDriverId!;
        const driver = await getLatestDriver(driverId);
        
        let totalFare = node.negotiatedTotalFare || (node.farePerPerson * node.passengers.length);
        const commissionRate = node.vehicleType === 'Shuttle' ? settings.shuttleCommission : settings.commissionPerSeat;
        const totalCommission = node.vehicleType === 'Shuttle' ? (node.capacityNeeded * commissionRate) : (node.passengers.length * commissionRate);
        const driverEarnings = totalFare - totalCommission;

        for (const p of node.passengers) {
             const { data: uData } = await supabase.from('unihub_users').select('id, walletBalance').eq('phone', p.phone).single();
             if (uData) {
                 const newBalance = (uData.walletBalance ?? 0) - node.farePerPerson;
                 await supabase.from('unihub_users').update({ walletBalance: newBalance }).eq('id', uData.id);
                 
                 await supabase.from('unihub_transactions').insert([{
                    id: `TX-RIDE-${Date.now()}-${p.phone.slice(-4)}`,
                    userId: uData.id,
                    amount: node.farePerPerson,
                    type: 'fare_payment',
                    timestamp: new Date().toLocaleString()
                 }]);
             }
        }

        await supabase.from('unihub_drivers').update({ walletBalance: (driver.walletBalance ?? 0) + driverEarnings }).eq('id', driverId);
        
        await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
        removeRideFromMyList(nodeId);
        
        const successMsg = passengerMatch 
            ? `Ride Verified! Passenger ${passengerMatch.name} confirmed. Earnings credited.` 
            : `Ride verified and completed! Earnings credited.`;
        
        alert(successMsg);
      } catch (err: any) {
        console.error("Verification error:", err);
        alert("Error closing ride. Contact Admin.");
      }
    } else {
      alert("Invalid Code! Ask the passenger for their Ride PIN.");
    }
  };

  const cancelRide = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    try {
      if (node.assignedDriverId) {
        const { error: resetErr } = await supabase.from('unihub_nodes').update({ 
            status: 'qualified', 
            assignedDriverId: null, 
            verificationCode: null
        }).eq('id', nodeId);
        if (resetErr) throw resetErr;
        alert("Trip assignment reset.");
      } else {
        const { error: deleteErr } = await supabase.from('unihub_nodes').delete().eq('id', nodeId);
        if (deleteErr) throw deleteErr;
        removeRideFromMyList(nodeId);
        alert("Ride request removed.");
      }
    } catch (err: any) {
      console.error("Cancellation error:", err);
      alert("Failed to process request: " + (err.message || "Unknown error"));
    }
  };

  const handleBroadcast = async (data: any) => {
      if (!activeDriverId) return;
      const latestDriver = await getLatestDriver(activeDriverId);
      if (!latestDriver) return;
      
      const activeRide = nodes.find(n => n.assignedDriverId === activeDriverId && n.status !== 'completed');
      if (activeRide) { alert("You already have an active/broadcasting trip."); return; }

      const rawSeats = parseInt(data.seats);
      const capacity = (!rawSeats || rawSeats < 1) ? 3 : rawSeats;

      const node: RideNode = {
          id: `NODE-DRV-${Date.now()}`,
          origin: data.origin,
          destination: data.destination,
          capacityNeeded: capacity,
          passengers: [],
          status: 'forming',
          leaderName: latestDriver.name,
          leaderPhone: latestDriver.contact,
          farePerPerson: data.fare,
          createdAt: new Date().toISOString(),
          assignedDriverId: activeDriverId,
          vehicleType: latestDriver.vehicleType,
          driverNote: data.note
      };
      
      try {
          const { error: insError } = await supabase.from('unihub_nodes').insert([node]);
          if(insError) throw insError;
          alert("Route broadcasted to passengers!"); 
      } catch(e: any) {
          console.error("Broadcast Logic Failure:", e);
          alert("Broadcast failed: " + e.message);
      }
  };

  const handleStartBroadcast = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !activeDriverId) return;
    
    if (node.passengers.length === 0) {
        alert("Cannot start trip with 0 passengers.");
        return;
    }

    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const updatedPassengers = node.passengers.map(p => ({
        ...p,
        verificationCode: Math.floor(1000 + Math.random() * 9000).toString()
    }));

    await supabase.from('unihub_nodes').update({
        status: 'dispatched',
        verificationCode,
        passengers: updatedPassengers,
    }).eq('id', nodeId);

    alert("Trip started! Passengers notified with codes.");
  };

  const settleNode = async (nodeId: string) => {
    if (confirm("Force complete this trip? (Manual settlement)")) {
      await supabase.from('unihub_nodes').update({ status: 'completed' }).eq('id', nodeId);
      alert("Trip settled manually.");
    }
  };

  const requestTopup = async (driverIdOrUserId: string, amount: number, ref: string, type: 'topup' | 'withdrawal' = 'topup') => {
    if (!amount || !ref) {
      alert("Details missing.");
      return;
    }
    const req: TopupRequest = {
      id: `REQ-${Date.now()}`,
      amount: Number(amount),
      momoReference: ref,
      status: 'pending',
      timestamp: new Date().toLocaleString()
    };
    
    if (type === 'topup') {
        req.userId = driverIdOrUserId; 
        req.driverId = driverIdOrUserId; 
    } else {
        req.driverId = driverIdOrUserId; 
    }

    const { error } = await supabase.from('unihub_topups').insert([req]);
    if (error) {
      alert("Request Failed: " + error.message);
    } else {
      alert(type === 'withdrawal' ? "Withdrawal request submitted." : "Credit request logged.");
    }
  };

  const handlePassengerTopup = async (amount: number, ref: string, proofImage: string) => {
      if (!currentUser) return;
      
      const { data: duplicates } = await supabase.from('unihub_transactions').select('id').eq('reference', ref);
      if (duplicates && duplicates.length > 0) {
          alert("Error: This Reference ID has already been used.");
          return;
      }

      const req: TopupRequest = {
          id: `TOPUP-${Date.now()}`,
          userId: currentUser.id,
          amount: amount,
          momoReference: ref,
          status: 'approved', 
          timestamp: new Date().toLocaleString(),
          proofImage: proofImage
      };

      try {
          await Promise.all([
              supabase.from('unihub_topups').insert([req]),
              supabase.from('unihub_users').update({ walletBalance: (currentUser.walletBalance ?? 0) + amount }).eq('id', currentUser.id),
              supabase.from('unihub_transactions').insert([{
                  id: `TX-TOPUP-${Date.now()}`,
                  userId: currentUser.id,
                  amount: amount,
                  type: 'topup',
                  timestamp: new Date().toLocaleString(),
                  reference: ref
              }])
          ]);
          
          const updatedBalance = (currentUser.walletBalance ?? 0) + amount;
          const updatedUser = { ...currentUser, walletBalance: updatedBalance };
          setCurrentUser(updatedUser);
          localStorage.setItem('nexryde_user_v1', JSON.stringify(updatedUser));
          
          alert(`Success! ₵${amount} added to your wallet.`);
      } catch (err: any) {
          console.error("Auto-topup failed", err);
          alert("System Error: Could not credit wallet. Please contact admin.");
      }
  };

  const requestRegistration = async (reg: Omit<RegistrationRequest, 'id' | 'status' | 'timestamp'>) => {
    const existingDriver = drivers.find(d => d.contact === reg.contact || d.licensePlate === reg.licensePlate);
    const existingReq = registrationRequests.find(r => (r.contact === reg.contact || r.licensePlate === reg.licensePlate) && r.status === 'pending');
    
    if (existingDriver) {
      alert("Error: This Partner or Vehicle is already registered with NexRyde.");
      return;
    }
    if (existingReq) {
      alert("Application Pending: You already have an onboarding request under review.");
      return;
    }

    const req: RegistrationRequest = {
      ...reg,
      id: `REG-${Date.now()}`,
      status: 'pending',
      timestamp: new Date().toLocaleString()
    };
    const { error } = await supabase.from('unihub_registrations').insert([req]);
    if (error) {
      console.error("Registration error:", error);
      alert("Submission Error: " + error.message);
    } else {
      alert("Application submitted! NexRyde Admin will review your details shortly.");
    }
  };

  const approveTopup = async (reqId: string) => {
    const req = topupRequests.find(r => r.id === reqId);
    if (!req || req.status !== 'pending') return;

    if (req.driverId) {
        const driver = await getLatestDriver(req.driverId);
        if (driver) {
             await supabase.from('unihub_drivers').update({ walletBalance: (driver.walletBalance ?? 0) - req.amount }).eq('id', req.driverId);
             await supabase.from('unihub_transactions').insert([{
                id: `TX-WITHDRAW-${Date.now()}`,
                driverId: req.driverId,
                amount: req.amount,
                type: 'withdrawal',
                timestamp: new Date().toLocaleString()
             }]);
        }
    } else if (req.userId) {
        const { data: user } = await supabase.from('unihub_users').select('*').eq('id', req.userId).single();
        if (user) {
            await supabase.from('unihub_users').update({ walletBalance: (user.walletBalance ?? 0) + req.amount }).eq('id', req.userId);
        }
    }

    await supabase.from('unihub_topups').update({ status: 'approved' }).eq('id', reqId);
  };

  const rejectTopup = async (reqId: string) => {
    if(!confirm("Reject this request?")) return;
    const { error } = await supabase.from('unihub_topups').update({ status: 'rejected' }).eq('id', reqId);
    if (error) alert("Failed to reject: " + error.message);
  };

  const approveRegistration = async (regId: string) => {
    const reg = registrationRequests.find(r => r.id === regId);
    if (!reg || reg.status !== 'pending') return;

    const newDriver: Driver = {
      id: `DRV-${Date.now()}`,
      name: reg.name,
      vehicleType: reg.vehicleType,
      licensePlate: reg.licensePlate,
      contact: reg.contact,
      pin: reg.pin,
      walletBalance: 0,
      rating: 5.0,
      status: 'online',
      avatarUrl: reg.avatarUrl
    };

    try {
      await Promise.all([
        supabase.from('unihub_drivers').insert([newDriver]),
        supabase.from('unihub_registrations').update({ status: 'approved' }).eq('id', regId),
        supabase.from('unihub_transactions').insert([{
          id: `TX-REG-${Date.now()}`,
          driverId: newDriver.id,
          amount: reg.amount,
          type: 'registration',
          timestamp: new Date().toLocaleString()
        }])
      ]);
      alert("Partner approved and activated!");
    } catch (err: any) {
      console.error("Approval error:", err);
      alert("Activation failed: " + err.message);
    }
  };

  const rejectRegistration = async (regId: string) => {
    if(!confirm("Reject this partner application?")) return;
    const { error } = await supabase.from('unihub_registrations').update({ status: 'rejected' }).eq('id', regId);
    if (error) alert("Failed to reject: " + error.message);
  };

  const registerDriver = async (d: Omit<Driver, 'id' | 'walletBalance' | 'rating' | 'status'>) => {
    const newDriver: Driver = {
      ...d,
      id: `DRV-${Date.now()}`,
      walletBalance: 0,
      rating: 5.0,
      status: 'online'
    };
    try {
      const { error } = await supabase.from('unihub_drivers').insert([newDriver]);
      if (error) throw error;
      alert(`Partner ${d.name} registered successfully!`);
    } catch (err: any) {
      console.error("Registration error:", err);
      alert(`Failed to register: ${err.message}.`);
    }
  };

  // Missing function added here
  const handleDriverLogout = () => {
    if (confirm("End partner session?")) {
        setActiveDriverId(null);
        sessionStorage.removeItem('nexryde_driver_session_v1');
    }
  };

  const deleteDriver = useCallback(async (id: string) => {
    const hasActiveMission = nodes.some(n => n.assignedDriverId === id && (n.status === 'qualified' || n.status === 'dispatched'));
    if (hasActiveMission) {
      alert("Cannot unregister partner with an active trip.");
      return;
    }

    await supabase.from('unihub_drivers').delete().eq('id', id);
    if (activeDriverId === id) {
      handleDriverLogout();
    }
  }, [nodes, activeDriverId]);

  const handleDriverAuth = (driverId: string, pin: string) => {
      const driver = drivers.find(d => d.id === driverId);
      if (driver && driver.pin === pin) {
          setActiveDriverId(driverId);
          sessionStorage.setItem('nexryde_driver_session_v1', driverId);
      } else {
          alert("Invalid credentials.");
      }
  };

  const handleAdminAuth = async (email: string, pass: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) alert("Admin Access Denied: " + error.message);
  };

  const handleAdminLogout = async () => {
      await supabase.auth.signOut();
  };

  const updateGlobalSettings = async (newSettings: AppSettings) => {
      if (newSettings.id) {
          const { error } = await supabase.from('unihub_settings').update(newSettings).eq('id', newSettings.id);
          if (error) alert("Update failed: " + error.message);
          else alert("Settings updated globally.");
      }
  };

  const safeSetViewMode = (mode: PortalMode) => {
      setViewMode(mode);
  };

  const dismissWelcome = () => {
      setIsNewUser(false);
      localStorage.setItem('nexryde_seen_welcome_v1', 'true');
  };

  const handleDismissAnnouncement = () => {
      setDismissedAnnouncement('true');
      localStorage.setItem('nexryde_dismissed_announcement', 'true');
  };

  const handleAiAccess = () => {
      if (isAiUnlocked) {
          setShowAiHelp(true);
      } else {
          setShowAiAd(true);
      }
  };

  const handleAiUnlock = () => {
      setIsAiUnlocked(true);
      setShowAiAd(false);
      setShowAiHelp(true);
  };

  const aiActions = {
      onUpdateStatus: async (status: string) => {
          if (activeDriverId) {
              await supabase.from('unihub_drivers').update({ status }).eq('id', activeDriverId);
          }
      },
      onAcceptRide: (id: string) => {
          if (activeDriverId) acceptRide(id, activeDriverId);
      },
      onFillRideForm: (data: any) => {
          setNewNode(prev => ({ ...prev, ...data }));
          if (!createMode) setCreateMode(true);
      },
      onConfirmRide: () => {
           alert("Please review details and press Confirm.");
      },
      onFillAuth: (data: any) => {
          setAuthFormState(prev => ({ ...prev, ...data }));
      }
  };

  return (
    <div 
      className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[#020617] text-slate-100 font-sans relative"
      style={settings.appWallpaper ? {
        backgroundImage: `url(${settings.appWallpaper})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      } : {}}
    >
      {settings.appWallpaper && (
        <div className="absolute inset-0 bg-[#020617]/70 pointer-events-none z-0"></div>
      )}

      <GlobalVoiceOrb 
        mode={currentUser ? viewMode : 'public'}
        user={viewMode === 'driver' ? activeDriver : currentUser}
        contextData={{
            nodes,
            drivers,
            transactions,
            settings,
            pendingRequests: pendingRequestsCount
        }}
        actions={aiActions}
        triggerRef={triggerVoiceRef}
      />

      {!currentUser ? (
         <HubGateway 
            onIdentify={handleGlobalUserAuth} 
            settings={settings} 
            formState={authFormState}
            setFormState={setAuthFormState}
            onTriggerVoice={() => triggerVoiceRef.current?.()}
         />
      ) : (
        <>
      {settings.hub_announcement && !dismissedAnnouncement && (
        <div className="fixed top-0 left-0 right-0 z-[2000] bg-gradient-to-r from-amber-600 to-rose-600 px-4 py-3 flex items-start sm:items-center justify-between shadow-2xl animate-in slide-in-from-top duration-500 border-b border-white/10">
           <div className="flex items-start sm:items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse shrink-0 mt-0.5 sm:mt-0">
                <i className="fas fa-bullhorn text-white text-xs"></i>
              </div>
              <p className="text-[10px] sm:text-xs font-black uppercase italic text-white tracking-tight leading-relaxed break-words">{settings.hub_announcement}</p>
           </div>
           <button onClick={handleDismissAnnouncement} className="ml-4 w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-white text-[10px] hover:bg-white/30 transition-all shrink-0 mt-0.5 sm:mt-0">
             <i className="fas fa-times"></i>
           </button>
        </div>
      )}
      
      {isSyncing && (
        <div className={`fixed ${settings.hub_announcement && !dismissedAnnouncement ? 'top-20' : 'top-4'} right-4 z-[300] bg-amber-500/20 text-amber-500 px-4 py-2 rounded-full border border-amber-500/30 text-[10px] font-black uppercase flex items-center gap-2 transition-all`}>
           <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
           Live Syncing...
        </div>
      )}

      <nav className="hidden lg:flex w-72 glass border-r border-white/5 flex-col p-8 space-y-10 z-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {settings.appLogo ? (
              <img src={settings.appLogo} className="w-12 h-12 object-contain rounded-xl bg-white/5 p-1 border border-white/10" alt="Logo" />
            ) : (
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-xl">
                <i className="fas fa-route text-[#020617] text-xl"></i>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none text-white">NexRyde</h1>
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Transit Excellence</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowQrModal(true)} title="NexRyde Code" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-amber-500 hover:bg-white/10 transition-all">
              <i className="fas fa-qrcode text-xs"></i>
            </button>
            <button onClick={() => setShowHelpModal(true)} title="Help Center" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-white/10 transition-all">
              <i className="fas fa-circle-question text-xs"></i>
            </button>
            <button onClick={() => setShowAboutModal(true)} title="Platform Info" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-emerald-400 hover:bg-white/10 transition-all">
              <i className="fas fa-info-circle text-xs"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1">
          <NavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride Center" onClick={() => {safeSetViewMode('passenger'); setSearchConfig({...searchConfig, query: ''});}} />
          <NavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Partner Terminal" onClick={() => {safeSetViewMode('driver'); setSearchConfig({...searchConfig, query: ''});}} />
          {(isVaultAccess || isAdminAuthenticated) && (
            <NavItem 
              active={viewMode === 'admin'} 
              icon="fa-shield-halved" 
              label="Control Vault" 
              onClick={() => {safeSetViewMode('admin'); setSearchConfig({...searchConfig, query: ''});}} 
              badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
            />
          )}
          <NavItem active={false} icon="fa-share-nodes" label="Invite Others" onClick={shareHub} />
          <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-slate-500 hover:bg-white/5 transition-all mt-4">
             <i className="fas fa-power-off text-lg w-6"></i>
             <span className="text-sm font-bold">Sign Out</span>
          </button>
        </div>

        <div className="pt-6 border-t border-white/5">
           {activeDriver ? (
             <div className="bg-indigo-500/10 p-6 rounded-[2.5rem] border border-indigo-500/20 relative overflow-hidden mb-4">
                <div className="flex items-center gap-3">
                  {activeDriver.avatarUrl ? (
                     <img src={activeDriver.avatarUrl} className="w-10 h-10 rounded-full object-cover border border-indigo-500/40" alt="Avatar" />
                  ) : (
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                      <i className="fas fa-user text-xs"></i>
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-[9px] font-black uppercase text-indigo-400 leading-none">Partner</p>
                    <p className="text-sm font-black text-white truncate">{activeDriver.name}</p>
                  </div>
                </div>
                <button onClick={handleDriverLogout} className="mt-4 w-full py-2 bg-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest">Sign Out Hub</button>
             </div>
           ) : (
             <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 mb-4">
                <p className="text-[9px] font-black uppercase text-slate-500 leading-none">Identity</p>
                <p className="text-sm font-black text-white truncate mt-1">{currentUser.username}</p>
                <p className="text-[10px] text-slate-500 mt-1">{currentUser.phone}</p>
             </div>
           )}
          <div className="bg-emerald-500/10 p-6 rounded-[2.5rem] border border-emerald-500/20 relative overflow-hidden">
            <p className="text-[9px] font-black uppercase text-emerald-400 mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Market Pulse
            </p>
            <div className="space-y-1">
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-white uppercase opacity-60 tracking-tight">Active Partners</p>
                  <p className="text-lg font-black text-white italic">{onlineDriverCount}</p>
               </div>
               <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-white uppercase opacity-60 tracking-tight">Open Trips</p>
                  <p className="text-lg font-black text-white italic">{activeNodeCount}</p>
               </div>
            </div>
          </div>
        </div>
      </nav>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-[100] flex items-center justify-around px-4">
        <MobileNavItem active={viewMode === 'passenger'} icon="fa-user-graduate" label="Ride" onClick={() => safeSetViewMode('passenger')} />
        <MobileNavItem active={viewMode === 'driver'} icon="fa-id-card-clip" label="Drive" onClick={() => safeSetViewMode('driver')} />
        {(isVaultAccess || isAdminAuthenticated) && (
          <MobileNavItem 
            active={viewMode === 'admin'} 
            icon="fa-shield-halved" 
            label="Admin" 
            onClick={() => safeSetViewMode('admin')} 
            badge={isAdminAuthenticated && pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
          />
        )}
        <MobileNavItem active={showMenuModal} icon="fa-bars" label="Menu" onClick={() => setShowMenuModal(true)} />
      </nav>

      <main className={`flex-1 overflow-y-auto p-4 lg:p-12 pb-36 lg:pb-12 no-scrollbar z-10 relative transition-all duration-500 ${settings.hub_announcement && !dismissedAnnouncement ? 'pt-24 lg:pt-28' : 'pt-4 lg:pt-12'}`}>
        <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8">
          
          {isNewUser && (
            <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4">
              <div className="relative z-10 flex items-center gap-6 text-center sm:text-left">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white text-2xl backdrop-blur-md shrink-0">
                   <i className="fas fa-sparkles"></i>
                </div>
                <div>
                   <h2 className="text-xl font-black uppercase italic leading-none text-white">Welcome to NexRyde</h2>
                   <p className="text-xs font-bold opacity-80 mt-1 uppercase tracking-tight text-indigo-100">Ready to move? Check out our quick start guide.</p>
                </div>
              </div>
              <div className="relative z-10 flex gap-3 w-full sm:w-auto">
                 <button onClick={() => setShowHelpModal(true)} className="flex-1 sm:flex-none px-6 py-3 bg-white text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl">Guide</button>
                 <button onClick={dismissWelcome} className="flex-1 sm:flex-none px-6 py-3 bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest">Let's Go</button>
              </div>
              <i className="fas fa-route absolute right-[-20px] top-[-20px] text-[150px] opacity-10 pointer-events-none rotate-12"></i>
            </div>
          )}

          {(viewMode === 'passenger' || viewMode === 'driver' || (viewMode === 'admin' && isAdminAuthenticated)) && (
            <SearchHub searchConfig={searchConfig} setSearchConfig={setSearchConfig} portalMode={viewMode} />
          )}

          {viewMode === 'passenger' && (
            <PassengerPortal 
              currentUser={currentUser}
              nodes={nodes} 
              myRideIds={myRideIds}
              onAddNode={async (node: RideNode) => {
                try {
                  const { error } = await supabase.from('unihub_nodes').insert([node]);
                  if (error) throw error;
                  addRideToMyList(node.id);
                } catch (err: any) {
                  alert(`Failed to request ride: ${err.message}`);
                  throw err;
                }
              }} 
              onJoin={joinNode} 
              onLeave={leaveNode}
              onForceQualify={forceQualify} 
              onCancel={cancelRide} 
              drivers={drivers} 
              searchConfig={searchConfig} 
              settings={settings} 
              onShowQr={() => setShowQrModal(true)} 
              onShowAbout={() => setShowAboutModal(true)}
              createMode={createMode}
              setCreateMode={setCreateMode}
              newNode={newNode}
              setNewNode={setNewNode}
              onTriggerVoice={() => triggerVoiceRef.current?.()}
              onTopupSuccess={handlePassengerTopup}
            />
          )}
          {viewMode === 'driver' && (
            <DriverPortal 
              drivers={drivers} 
              activeDriver={activeDriver}
              onLogin={handleDriverAuth}
              onLogout={handleDriverLogout}
              qualifiedNodes={nodes.filter(n => n.status === 'qualified')} 
              dispatchedNodes={nodes.filter(n => n.status === 'dispatched')}
              missions={missions}
              allNodes={nodes}
              onJoinMission={joinMission}
              onAccept={acceptRide}
              onBroadcast={handleBroadcast}
              onStartBroadcast={handleStartBroadcast}
              onVerify={verifyRide}
              onCancel={cancelRide}
              onRequestTopup={requestTopup}
              onRequestRegistration={requestRegistration}
              searchConfig={searchConfig}
              settings={settings}
              onUpdateStatus={async (status: 'online' | 'busy' | 'offline') => {
                 if(!activeDriverId) return;
                 await supabase.from('unihub_drivers').update({ status }).eq('id', activeDriverId);
              }}
              isLoading={isDriverLoading}
            />
          )}
          {viewMode === 'admin' && (
            !isAdminAuthenticated ? (
              <AdminLogin onLogin={handleAdminAuth} />
            ) : (
              <AdminPortal 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                nodes={nodes} 
                setNodes={setNodes}
                drivers={drivers} 
                onAddDriver={registerDriver}
                onDeleteDriver={deleteDriver}
                onCancelRide={cancelRide}
                onSettleRide={settleNode}
                missions={missions}
                onCreateMission={async (m: HubMission) => await supabase.from('unihub_missions').insert([m])}
                onDeleteMission={async (id: string) => await supabase.from('unihub_missions').delete().eq('id', id)}
                transactions={transactions} 
                topupRequests={topupRequests}
                registrationRequests={registrationRequests}
                onApproveTopup={approveTopup}
                onRejectTopup={rejectTopup}
                onApproveRegistration={approveRegistration}
                onRejectRegistration={rejectRegistration}
                onLock={handleAdminLogout}
                searchConfig={searchConfig}
                settings={settings}
                onUpdateSettings={updateGlobalSettings}
                hubRevenue={hubRevenue}
                adminEmail={session?.user?.email}
              />
            )
          )}
        </div>
      </main>

      {viewMode === 'passenger' && (
        <button 
          onClick={handleAiAccess}
          className="fixed bottom-24 right-6 lg:bottom-12 lg:right-12 w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-full shadow-2xl flex items-center justify-center text-white text-2xl z-[100] hover:scale-110 transition-transform animate-bounce-slow"
        >
          <i className="fas fa-sparkles"></i>
        </button>
      )}

      {showAiAd && <AdGate onUnlock={handleAiUnlock} label="Launch AI Assistant" settings={settings} />}
      {showAiHelp && <AiHelpDesk onClose={() => setShowAiHelp(false)} settings={settings} />}

      {showMenuModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-end sm:items-center justify-center p-4 animate-in slide-in-from-bottom-10 fade-in">
           <div className="glass-bright w-full max-w-sm rounded-[2.5rem] p-6 space-y-6 border border-white/10 relative">
              <button onClick={() => setShowMenuModal(false)} className="absolute top-6 right-6 w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
              
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                    <i className="fas fa-user-circle text-2xl"></i>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-white italic uppercase">{currentUser?.username || 'Guest'}</h3>
                    <p className="text-xs text-slate-400">{currentUser?.phone}</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <button onClick={() => { setShowMenuModal(false); setShowQrModal(true); }} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2 hover:bg-white/10">
                    <i className="fas fa-qrcode text-xl text-indigo-400"></i>
                    <span className="text-[10px] font-black uppercase text-slate-300">My Code</span>
                 </button>
                 <button onClick={() => { setShowMenuModal(false); setShowAboutModal(true); }} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2 hover:bg-white/10">
                    <i className="fas fa-info-circle text-xl text-emerald-400"></i>
                    <span className="text-[10px] font-black uppercase text-slate-300">About App</span>
                 </button>
              </div>

              <button onClick={() => { setShowMenuModal(false); handleLogout(); }} className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2">
                 <i className="fas fa-power-off"></i> Sign Out
              </button>
           </div>
        </div>
      )}

      {showQrModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-sm:px-4 max-w-sm rounded-[3rem] p-10 space-y-8 animate-in zoom-in text-center border border-white/10">
              <div className="space-y-2">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">NexRyde Code</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Scan to access the platform</p>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl relative group">
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin)}&bgcolor=ffffff&color=020617&format=svg`} 
                   className="w-full aspect-square"
                   alt="NexRyde QR"
                 />
              </div>
              <div className="flex gap-4">
                 <button onClick={() => setShowQrModal(false)} className="flex-1 py-4 bg-white/5 rounded-[1.5rem] font-black text-[10px] uppercase text-slate-400">Close</button>
                 <button onClick={shareHub} className="flex-1 py-4 bg-amber-500 text-[#020617] rounded-[1.5rem] font-black text-[10px] uppercase shadow-xl">Share Platform</button>
              </div>
           </div>
        </div>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
            <div className="glass-bright w-full max-w-4xl rounded-[3rem] p-8 lg:p-12 space-y-8 animate-in zoom-in border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
               <div className="flex justify-between items-center">
                 <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">NexRyde Guide</h3>
                 <button onClick={() => setShowHelpModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <i className="fas fa-times"></i>
                 </button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <HelpSection 
                     icon="fa-user-graduate" 
                     title="For Passengers" 
                     color="text-indigo-400"
                     points={[
                         "Select 'Pool' to share rides and save money.",
                         "Select 'Solo' for express, direct trips (higher fare).",
                         "Join existing rides from the Community Rides list.",
                         "Use the AI voice assistant for hands-free booking.",
                         "Always verify the Ride PIN with your driver."
                     ]}
                  />
                  <HelpSection 
                     icon="fa-id-card-clip" 
                     title="For Partners" 
                     color="text-amber-500"
                     points={[
                         "Register as a partner to start earning.",
                         "Top up your wallet via MoMo to accept rides.",
                         "Station at Hotspots to get priority assignments.",
                         "Broadcast your own routes (Shuttles/Taxis).",
                         "Keep your rating high for bonuses."
                     ]}
                  />
                  <HelpSection 
                     icon="fa-shield-halved" 
                     title="Safety First" 
                     color="text-emerald-400"
                     points={[
                         "Share trip details with friends via the Share button.",
                         "Verify driver photo and license plate before boarding.",
                         "Report any issues immediately to Support.",
                         "Emergency contacts are available in the About section."
                     ]}
                  />
                   <HelpSection 
                     icon="fa-robot" 
                     title="AI Features" 
                     color="text-rose-400"
                     points={[
                         "Tap the Orb to speak in local languages (Twi, Ga, etc).",
                         "Drivers can use voice commands to find hotspots.",
                         "Passengers can book rides just by speaking.",
                         "Use the 'Guide' chat for instant answers."
                     ]}
                  />
               </div>
               
               <div className="pt-6 border-t border-white/5 text-center">
                  <button onClick={() => setShowHelpModal(false)} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Got it</button>
               </div>
            </div>
        </div>
      )}

      {showAboutModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
           <div className="glass-bright w-full max-w-2xl rounded-[3rem] p-8 lg:p-12 space-y-8 animate-in zoom-in border border-white/10 overflow-y-auto max-h-[90vh] no-scrollbar">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl">
                      <i className="fas fa-info-circle text-xl"></i>
                   </div>
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">NexRyde Manifesto</h3>
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-1">Our Mission & Ethics</p>
                   </div>
                </div>
                <button onClick={() => setShowAboutModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                   <i className="fas fa-times"></i>
                </button>
              </div>
              {settings.aboutMeImages && settings.aboutMeImages.length > 0 && (
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                   {settings.aboutMeImages.map((img, i) => (
                     <div key={i} className="min-w-[280px] h-[180px] rounded-[2rem] overflow-hidden border border-white/10 shadow-xl shrink-0">
                        <img src={img} className="w-full h-full object-cover" alt="NexRyde Portfolio" />
                     </div>
                   ))}
                </div>
              )}
              <div className="space-y-6">
                 <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 relative overflow-hidden">
                    <i className="fas fa-quote-left absolute top-4 left-4 text-4xl text-emerald-500/10"></i>
                    <p className="text-sm lg:text-base font-medium italic text-slate-300 leading-relaxed relative z-10 whitespace-pre-wrap">{settings.aboutMeText}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <a href={`https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-emerald-600/10 hover:border-emerald-500/30 transition-all group">
                       <i className="fab fa-whatsapp text-emerald-500 text-2xl group-hover:scale-110 transition-transform"></i>
                       <span className="text-[9px] font-black uppercase text-slate-500">Partner Support</span>
                    </a>
                    <button onClick={shareHub} className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-amber-600/10 hover:border-amber-500/30 transition-all group">
                       <i className="fas fa-share-nodes text-amber-500 text-2xl group-hover:scale-110 transition-transform"></i>
                       <span className="text-[9px] font-black uppercase text-slate-500">Share Platform</span>
                    </button>
                    {settings.facebookUrl && (
                        <a href={settings.facebookUrl} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-blue-600/10 hover:border-blue-500/30 transition-all group">
                            <i className="fab fa-facebook text-blue-500 text-2xl group-hover:scale-110 transition-transform"></i>
                            <span className="text-[9px] font-black uppercase text-slate-500">Facebook</span>
                        </a>
                    )}
                    {settings.instagramUrl && (
                        <a href={settings.instagramUrl} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-pink-600/10 hover:border-pink-500/30 transition-all group">
                            <i className="fab fa-instagram text-pink-500 text-2xl group-hover:scale-110 transition-transform"></i>
                            <span className="text-[9px] font-black uppercase text-slate-500">Instagram</span>
                        </a>
                    )}
                    {settings.tiktokUrl && (
                        <a href={settings.tiktokUrl} target="_blank" className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-white/10 rounded-[2rem] hover:bg-gray-600/10 hover:border-gray-500/30 transition-all group">
                            <i className="fab fa-tiktok text-white text-2xl group-hover:scale-110 transition-transform"></i>
                            <span className="text-[9px] font-black uppercase text-slate-500">TikTok</span>
                        </a>
                    )}
                 </div>
              </div>
              <div className="pt-6 border-t border-white/5 text-center">
                 <button onClick={() => setShowAboutModal(false)} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Close Portfolio</button>
              </div>
           </div>
        </div>
      )}
    </>
  );
}