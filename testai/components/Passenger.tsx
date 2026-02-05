
import React, { useState, useEffect, useRef } from 'react';
import { RideNode, Driver, AppSettings, UniUser } from '../types';
import { InlineAd, AdGate } from './Shared';
import { compressImage, verifyPaymentSlip } from '../lib/utils';

export const PassengerPortal = ({ 
  currentUser, 
  nodes, 
  myRideIds, 
  onAddNode, 
  onJoin, 
  onLeave, 
  onForceQualify, 
  onCancel, 
  drivers, 
  searchConfig, 
  settings, 
  onShowQr, 
  onShowAbout,
  createMode,
  setCreateMode,
  newNode,
  setNewNode,
  onTriggerVoice,
  onTopupSuccess
}: any) => {
  const [fareEstimate, setFareEstimate] = useState(0);
  const [customOffer, setCustomOffer] = useState<number | null>(null);
  const [offerInput, setOfferInput] = useState<string>(''); 
  const [expandedQr, setExpandedQr] = useState<string | null>(null);
  
  const [showSoloAd, setShowSoloAd] = useState(false);
  const [isSoloUnlocked, setIsSoloUnlocked] = useState(false);
  
  // Wallet & Topup States
  const [showWallet, setShowWallet] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [topupStep, setTopupStep] = useState<'info' | 'scan' | 'result'>('info');
  const [scanResult, setScanResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredNodes = nodes.filter((n: RideNode) => {
    if (searchConfig.query && !n.origin.toLowerCase().includes(searchConfig.query.toLowerCase()) && !n.destination.toLowerCase().includes(searchConfig.query.toLowerCase())) return false;
    if (searchConfig.vehicleType !== 'All' && n.vehicleType !== searchConfig.vehicleType) return false;
    return true;
  });

  const myRides = nodes.filter((n: RideNode) => myRideIds.includes(n.id) && n.status !== 'completed');
  const availableRides = filteredNodes.filter((n: RideNode) => n.status !== 'completed' && n.status !== 'dispatched' && !myRideIds.includes(n.id));

  useEffect(() => {
    let base = newNode.vehicleType === 'Taxi' ? (settings.farePerTaxi || 0) : (settings.farePerPragia || 0);
    if (newNode.isSolo) base *= (settings.soloMultiplier || 1);
    setFareEstimate(base);
    
    // Reset custom offer on vehicle/mode change and sync input
    setCustomOffer(null);
    setOfferInput(base.toFixed(2));
  }, [newNode.vehicleType, newNode.isSolo, settings]);

  const handleOfferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setOfferInput(val);
      const num = parseFloat(val);
      if (!isNaN(num)) setCustomOffer(num);
      else setCustomOffer(null);
  };

  const handleOfferBlur = () => {
      const val = parseFloat(offerInput);
      if (isNaN(val) || val < fareEstimate) {
          setOfferInput(fareEstimate.toFixed(2));
          setCustomOffer(null);
      } else {
          setOfferInput(val.toFixed(2));
      }
  };

  const adjustOffer = (delta: number) => {
      const current = parseFloat(offerInput) || fareEstimate;
      const newVal = Math.max(fareEstimate, current + delta);
      setOfferInput(newVal.toFixed(2));
      setCustomOffer(newVal);
  };

  const toggleSolo = () => {
    if (newNode.isSolo) {
      setNewNode({...newNode, isSolo: false});
    } else {
      if (isSoloUnlocked) {
        setNewNode({...newNode, isSolo: true});
      } else {
        setShowSoloAd(true);
      }
    }
  };

  const handleSoloUnlock = () => {
    setIsSoloUnlocked(true);
    setNewNode({...newNode, isSolo: true});
    setShowSoloAd(false);
  };

  const handleSubmit = () => {
    if (!newNode.origin || !newNode.destination) return alert("Please fill all fields");
    
    const finalFare = customOffer ? parseFloat(customOffer.toString()) : fareEstimate;
    if ((currentUser.walletBalance || 0) < finalFare) {
        alert("Insufficient Wallet Balance. Please Top Up to create a ride.");
        setShowWallet(true);
        return;
    }

    const node: RideNode = {
      id: `NODE-${Date.now()}`,
      origin: newNode.origin!,
      destination: newNode.destination!,
      vehicleType: newNode.vehicleType,
      isSolo: newNode.isSolo,
      capacityNeeded: newNode.isSolo ? 1 : (newNode.vehicleType === 'Taxi' ? 4 : 3),
      passengers: [{ id: currentUser.id, name: currentUser.username, phone: currentUser.phone }],
      status: newNode.isSolo ? 'qualified' : 'forming',
      leaderName: currentUser.username,
      leaderPhone: currentUser.phone,
      farePerPerson: finalFare,
      createdAt: new Date().toISOString()
    };
    onAddNode(node);
    setCreateMode(false);
    setCustomOffer(null);
  };

  const handleScanProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsVerifying(true);
      setTopupStep('scan');
      try {
          const base64 = await compressImage(file, 0.7, 800);
          const result = await verifyPaymentSlip(base64, settings.adminMomoName, currentUser.phone);
          setScanResult({ ...result, proofImage: base64 });
          setTopupStep('result');
      } catch (err) {
          alert("Error scanning image.");
          setTopupStep('info');
      } finally {
          setIsVerifying(false);
      }
  };

  const finalizeTopup = () => {
      if (scanResult && scanResult.valid) {
          onTopupSuccess(scanResult.amount, scanResult.reference, scanResult.proofImage);
          setShowWallet(false);
          setTopupStep('info');
          setScanResult(null);
      }
  };

  if (createMode) {
    return (
      <div className="glass p-8 rounded-[2.5rem] border border-white/10 animate-in zoom-in max-w-lg mx-auto relative">
         {showSoloAd && <AdGate onUnlock={handleSoloUnlock} label="Unlock Solo Ride Mode" settings={settings} />}
         
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black italic uppercase text-white">New Request</h2>
            <button onClick={() => setCreateMode(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
         </div>
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl">
               <button onClick={() => setNewNode({...newNode, isSolo: false})} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${!newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Pool (Cheaper)</button>
               <button onClick={toggleSolo} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>
                 Solo (Express)
                 {!isSoloUnlocked && !newNode.isSolo && <i className="fas fa-lock text-[8px] opacity-70"></i>}
               </button>
            </div>
            
            <div className="relative">
              <input value={newNode.origin} onChange={e => setNewNode({...newNode, origin: e.target.value})} placeholder="Pickup Location" className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white font-bold outline-none text-sm focus:border-indigo-500" />
              <button onClick={onTriggerVoice} className="absolute right-2 top-2 w-8 h-8 flex items-center justify-center text-indigo-400 hover:text-white"><i className="fas fa-microphone"></i></button>
            </div>
            <div className="relative">
              <input value={newNode.destination} onChange={e => setNewNode({...newNode, destination: e.target.value})} placeholder="Dropoff Location" className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white font-bold outline-none text-sm focus:border-indigo-500" />
              <button onClick={onTriggerVoice} className="absolute right-2 top-2 w-8 h-8 flex items-center justify-center text-indigo-400 hover:text-white"><i className="fas fa-microphone"></i></button>
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
               {['Pragia', 'Taxi', 'Shuttle'].map(v => (
                 <button key={v} onClick={() => setNewNode({...newNode, vehicleType: v as any})} className={`px-4 py-2 rounded-lg border border-white/10 font-black text-[10px] uppercase ${newNode.vehicleType === v ? 'bg-amber-500 text-[#020617]' : 'bg-white/5 text-slate-400'}`}>
                    {v}
                 </button>
               ))}
            </div>

            <div className="p-6 bg-indigo-900/30 rounded-2xl border border-indigo-500/20 space-y-3">
               <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase text-indigo-300">Base Fare</span>
                   <span className="text-sm font-bold text-slate-400">₵{fareEstimate.toFixed(2)}</span>
               </div>
               <div>
                   <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black uppercase text-white">Your Offer (₵)</label>
                      <span className="text-[9px] text-emerald-400 font-bold uppercase">Boost to attract drivers</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <button onClick={() => adjustOffer(-0.5)} className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all">
                          <i className="fas fa-minus"></i>
                      </button>
                      <input 
                          type="number" 
                          step="0.5"
                          value={offerInput}
                          onChange={handleOfferChange}
                          onBlur={handleOfferBlur}
                          className="flex-1 bg-[#020617]/50 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-lg text-center outline-none focus:border-emerald-500 transition-colors"
                      />
                      <button onClick={() => adjustOffer(0.5)} className="w-12 h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all">
                          <i className="fas fa-plus"></i>
                      </button>
                   </div>
               </div>
            </div>

            <button onClick={handleSubmit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Confirm Request</button>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
       {/* Wallet Access Button */}
       <div className="absolute top-[-70px] right-0 z-20">
          <button onClick={() => setShowWallet(true)} className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-2xl border border-white/10 transition-all backdrop-blur-md">
             <div className="text-right">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Balance</p>
                <p className={`text-sm font-black ${(currentUser.walletBalance || 0) < 5 ? 'text-rose-500' : 'text-emerald-400'}`}>₵ {(currentUser.walletBalance || 0).toFixed(2)}</p>
             </div>
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-wallet"></i>
             </div>
          </button>
       </div>

       {/* Wallet Modal */}
       {showWallet && (
           <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 backdrop-blur-xl">
               <div className="glass-bright w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 relative animate-in zoom-in">
                   <button onClick={() => { setShowWallet(false); setTopupStep('info'); }} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
                   
                   <h3 className="text-xl font-black italic uppercase text-white mb-6">My Wallet</h3>
                   
                   {/* Digital Card */}
                   <div className="bg-gradient-to-br from-indigo-600 to-purple-800 p-6 rounded-[2rem] shadow-2xl mb-8 relative overflow-hidden border border-white/10">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>
                       <p className="text-[10px] font-black uppercase text-indigo-200 tracking-widest mb-1">Current Balance</p>
                       <p className="text-4xl font-black text-white mb-8">₵ {(currentUser.walletBalance || 0).toFixed(2)}</p>
                       <div className="flex justify-between items-end">
                           <div>
                               <p className="text-[9px] font-bold text-indigo-200 uppercase">{currentUser.username}</p>
                               <p className="text-[8px] text-indigo-300 font-mono tracking-widest">**** {currentUser.phone.slice(-4)}</p>
                           </div>
                           <i className="fas fa-contactless text-white/50 text-2xl"></i>
                       </div>
                   </div>

                   {topupStep === 'info' && (
                       <div className="space-y-4 animate-in slide-in-from-right">
                           <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                               <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Step 1: Send Money</p>
                               <div className="flex justify-between items-center bg-black/30 p-3 rounded-xl mb-2">
                                   <span className="text-xs text-white font-mono">{settings.adminMomo}</span>
                                   <button onClick={() => navigator.clipboard.writeText(settings.adminMomo)} className="text-indigo-400 text-[10px] uppercase font-black">Copy</button>
                               </div>
                               <p className="text-[9px] text-slate-500">Name: <span className="text-slate-300">{settings.adminMomoName}</span></p>
                           </div>
                           
                           <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                               <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Step 2: Upload Proof</p>
                               <p className="text-[9px] text-slate-500 mb-3">Take a screenshot of the SMS receipt. Our AI will verify it instantly.</p>
                               <label className="w-full py-3 bg-emerald-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform">
                                   <i className="fas fa-camera"></i> Scan Receipt
                                   <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleScanProof} />
                               </label>
                           </div>
                       </div>
                   )}

                   {topupStep === 'scan' && (
                       <div className="text-center py-8 animate-in fade-in">
                           <div className="w-24 h-24 bg-white/5 rounded-2xl mx-auto mb-4 relative overflow-hidden border border-emerald-500/30">
                               <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)] animate-[scan_2s_linear_infinite]"></div>
                               <i className="fas fa-receipt text-4xl text-slate-600 absolute inset-0 flex items-center justify-center"></i>
                           </div>
                           <p className="text-xs font-black text-white uppercase animate-pulse">AI Verifying Transaction...</p>
                           <p className="text-[9px] text-slate-500 mt-2">Checking Date, Amount & Reference ID</p>
                       </div>
                   )}

                   {topupStep === 'result' && scanResult && (
                       <div className="space-y-4 animate-in slide-in-from-bottom">
                           {scanResult.valid ? (
                               <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/30 text-center">
                                   <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
                                       <i className="fas fa-check text-[#020617] text-xl"></i>
                                   </div>
                                   <h4 className="text-lg font-black text-white uppercase">Verified!</h4>
                                   <p className="text-3xl font-black text-emerald-400 my-2">+ ₵{scanResult.amount}</p>
                                   <p className="text-[9px] text-slate-400 font-mono">Ref: {scanResult.reference}</p>
                                   <button onClick={finalizeTopup} className="w-full mt-4 py-3 bg-emerald-500 text-[#020617] rounded-xl font-black text-[10px] uppercase">Add to Wallet</button>
                               </div>
                           ) : (
                               <div className="bg-rose-500/10 p-6 rounded-2xl border border-rose-500/30 text-center">
                                   <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-rose-500/20">
                                       <i className="fas fa-times text-white text-xl"></i>
                                   </div>
                                   <h4 className="text-lg font-black text-white uppercase">Failed</h4>
                                   <p className="text-xs text-rose-300 font-bold mt-2">{scanResult.reason}</p>
                                   <button onClick={() => setTopupStep('info')} className="w-full mt-4 py-3 bg-white/10 text-white rounded-xl font-black text-[10px] uppercase">Try Again</button>
                               </div>
                           )}
                       </div>
                   )}
               </div>
           </div>
       )}

       {myRides.length > 0 && (
         <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">My Active Trips</h3>
            {myRides.map((node: RideNode) => {
              const myPassengerInfo = node.passengers.find(p => p.phone === currentUser.phone);
              const myPin = myPassengerInfo?.verificationCode;
              const assignedDriver = drivers.find((d: Driver) => d.id === node.assignedDriverId);

              return (
              <div key={node.id} className="glass p-6 rounded-[2rem] border border-indigo-500/30 bg-indigo-900/10 relative overflow-hidden">
                 <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase ${node.status === 'qualified' ? 'bg-emerald-500 text-[#020617]' : 'bg-amber-500 text-[#020617]'}`}>{node.status}</span>
                          <span className="text-[10px] font-black text-indigo-300 uppercase">{node.vehicleType}</span>
                       </div>
                       <h4 className="text-lg font-black text-white">{node.destination}</h4>
                       <p className="text-xs text-slate-400">From: {node.origin}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-xl font-black text-white">₵{node.farePerPerson}</p>
                       {node.assignedDriverId && <p className="text-[9px] font-black text-emerald-400 uppercase animate-pulse">Driver En Route</p>}
                    </div>
                 </div>
                 
                 {assignedDriver && (
                    <div className="bg-white/5 p-3 rounded-xl mb-4 border border-white/5">
                        <div className="flex items-center gap-3 mb-3">
                           <img src={assignedDriver.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${assignedDriver.name}`} className="w-10 h-10 rounded-full object-cover bg-black" alt="Driver" />
                           <div>
                               <p className="text-[10px] text-slate-400 font-bold uppercase">Your Partner</p>
                               <p className="text-sm font-black text-white leading-none">{assignedDriver.name}</p>
                               <div className="flex items-center gap-1 mt-1">
                                    <span className="text-[9px] text-amber-500">★ {assignedDriver.rating}</span>
                                    <span className="text-[9px] text-slate-500">• {assignedDriver.licensePlate}</span>
                               </div>
                           </div>
                        </div>
                        <div className="flex gap-2">
                           <a href={`tel:${assignedDriver.contact}`} className="flex-1 py-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all">
                              <i className="fas fa-phone"></i> Call
                           </a>
                           <a href={`https://wa.me/${assignedDriver.contact.replace(/[^0-9]/g, '')}`} target="_blank" className="flex-1 py-2 bg-emerald-500/20 text-emerald-500 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-[#020617] transition-all">
                              <i className="fab fa-whatsapp"></i> WhatsApp
                           </a>
                        </div>
                    </div>
                 )}

                 {node.assignedDriverId && myPin && (
                    <div className="bg-black/30 p-4 rounded-xl mb-4 flex items-center justify-between gap-4">
                       <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ride PIN</p>
                          <p className="text-2xl font-black text-white tracking-[0.2em]">{myPin}</p>
                          <button onClick={() => setExpandedQr(myPin)} className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-2 border border-white/10 transition-colors">
                             <i className="fas fa-expand"></i> Show QR
                          </button>
                       </div>
                       <div onClick={() => setExpandedQr(myPin)} className="bg-white p-2 rounded-lg cursor-pointer hover:scale-105 transition-transform">
                          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${myPin}`} className="w-20 h-20" alt="Ride QR" />
                       </div>
                    </div>
                 )}

                 <div className="flex gap-2">
                    {node.status === 'forming' && node.passengers.length > 1 && !node.assignedDriverId && (
                       <button onClick={() => onForceQualify(node.id)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase">Go Now (Pay Extra)</button>
                    )}
                    <button onClick={() => onLeave(node.id, currentUser.phone)} className="flex-1 py-3 bg-white/5 hover:bg-rose-500/20 hover:text-rose-500 text-slate-400 rounded-xl font-black text-[9px] uppercase transition-all">Leave</button>
                    {node.leaderPhone === currentUser.phone && !node.assignedDriverId && (
                       <button onClick={() => onCancel(node.id)} className="w-10 flex items-center justify-center bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-trash text-xs"></i></button>
                    )}
                 </div>
              </div>
            )})}
         </div>
       )}

       <div onClick={() => setCreateMode(true)} className="glass p-8 rounded-[2.5rem] border-2 border-dashed border-white/10 hover:border-amber-500/50 cursor-pointer group transition-all text-center space-y-2">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-500 group-hover:bg-amber-500 group-hover:text-[#020617] transition-all">
             <i className="fas fa-plus"></i>
          </div>
          <h3 className="text-lg font-black uppercase italic text-white group-hover:text-amber-500 transition-colors">Start New Trip</h3>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Create a pool or go solo</p>
       </div>

       <div>
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2 mb-4">Community Rides</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {availableRides.length === 0 && <p className="text-slate-600 text-xs font-bold uppercase col-span-full text-center py-8">No matching rides found.</p>}
             {availableRides.map((node: RideNode, index: number) => {
               const isPartnerOffer = node.assignedDriverId && (node.status === 'forming' || node.status === 'qualified');
               const seatsLeft = Math.max(0, node.capacityNeeded - node.passengers.length);
               
               return (
               <React.Fragment key={node.id}>
                <div className={`glass p-6 rounded-[2rem] border transition-all ${isPartnerOffer ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-white/5 hover:border-white/10'}`}>
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <div className="flex gap-2 items-center mb-1">
                             <span className="px-2 py-1 bg-white/10 rounded-md text-[8px] font-black uppercase text-slate-300">{node.vehicleType}</span>
                             {isPartnerOffer && <span className="px-2 py-1 bg-emerald-500 rounded-md text-[8px] font-black uppercase text-[#020617] animate-pulse">Partner Offer</span>}
                         </div>
                         <h4 className="text-base font-black text-white mt-1">{node.destination}</h4>
                         <p className="text-[10px] text-slate-400 uppercase">From: {node.origin}</p>
                         {node.driverNote && <p className="text-[9px] text-emerald-400 font-bold mt-1">"{node.driverNote}"</p>}
                      </div>
                      <div className="text-right">
                         <p className="text-lg font-black text-amber-500">₵{node.farePerPerson}</p>
                         <p className="text-[9px] font-bold text-slate-500 uppercase">{node.passengers.length}/{node.capacityNeeded} Seats</p>
                      </div>
                   </div>
                   <div className="flex items-center gap-2 mb-4 overflow-hidden">
                      {node.capacityNeeded > 5 ? (
                         <div className="flex gap-2 w-full">
                            <div className="flex-1 bg-white/5 p-2 rounded-xl text-center border border-white/5">
                               <p className="text-lg font-black text-white">{seatsLeft}</p>
                               <p className="text-[8px] font-bold text-slate-500 uppercase">Seats Left</p>
                            </div>
                            <div className="flex-1 bg-white/5 p-2 rounded-xl text-center border border-white/5">
                               <p className="text-lg font-black text-white">{node.passengers.length}</p>
                               <p className="text-[8px] font-bold text-slate-500 uppercase">Joined</p>
                            </div>
                         </div>
                      ) : (
                        <>
                          {node.passengers.map((p, i) => (
                             <div key={i} className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white border border-[#020617]" title={p.name}>{p.name[0]}</div>
                          ))}
                          {[...Array(seatsLeft)].map((_, i) => (
                             <div key={i} className="w-6 h-6 rounded-full bg-white/5 border border-white/10 border-dashed"></div>
                          ))}
                        </>
                      )}
                   </div>
                   <button onClick={() => {
                       if ((currentUser.walletBalance || 0) < node.farePerPerson) {
                           alert("Insufficient funds to join this ride. Please Top Up.");
                           setShowWallet(true);
                           return;
                       }
                       onJoin(node.id, currentUser.username, currentUser.phone);
                   }} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase transition-all ${isPartnerOffer ? 'bg-emerald-500 text-white shadow-lg hover:scale-[1.02]' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
                      {isPartnerOffer ? 'Join Instantly' : 'Join Ride'}
                   </button>
                </div>
                {(index + 1) % 3 === 0 && <InlineAd className="col-span-1" settings={settings} />}
               </React.Fragment>
             )})}
          </div>
       </div>

       {expandedQr && (
         <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6" onClick={() => setExpandedQr(null)}>
            <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center animate-in zoom-in relative" onClick={e => e.stopPropagation()}>
               <button onClick={() => setExpandedQr(null)} className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><i className="fas fa-times"></i></button>
               <h3 className="text-2xl font-black uppercase text-[#020617] mb-2">Scan Me</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Present to Partner</p>
               <div className="bg-[#020617] p-2 rounded-2xl inline-block mb-6 shadow-2xl">
                 <div className="bg-white p-2 rounded-xl">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${expandedQr}`} className="w-full aspect-square" alt="Large QR" />
                 </div>
               </div>
               <div className="mb-6">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Confirmation PIN</p>
                  <p className="text-5xl font-black text-[#020617] tracking-[0.5em]">{expandedQr}</p>
               </div>
               <p className="text-[10px] font-bold text-rose-500 uppercase">Only show when ready to board</p>
            </div>
         </div>
       )}
    </div>
  );
};
