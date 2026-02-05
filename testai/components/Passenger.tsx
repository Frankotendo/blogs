
import React, { useState, useEffect, useRef } from 'react';
import { RideNode, Driver, AppSettings, UniUser } from '../types';
import { InlineAd, AdGate } from './Shared';
import { compressImage, verifyPaymentSlip } from '../lib/utils';

export const PassengerPortal = ({ 
  currentUser, nodes, myRideIds, onAddNode, onJoin, onLeave, onForceQualify, onCancel, drivers, searchConfig, settings, onShowQr, onShowAbout, createMode, setCreateMode, newNode, setNewNode, onTriggerVoice, onTopupSuccess
}: any) => {
  const [fareEstimate, setFareEstimate] = useState(0);
  const [customOffer, setCustomOffer] = useState<number | null>(null);
  const [offerInput, setOfferInput] = useState<string>(''); 
  const [expandedQr, setExpandedQr] = useState<string | null>(null);
  const [showSoloAd, setShowSoloAd] = useState(false);
  const [isSoloUnlocked, setIsSoloUnlocked] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [topupStep, setTopupStep] = useState<'info' | 'scan' | 'result'>('info');
  const [scanResult, setScanResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableRides = nodes.filter((n: RideNode) => {
    if (myRideIds.includes(n.id) || n.status === 'completed' || n.status === 'dispatched') return false;
    if (searchConfig.query && !n.origin.toLowerCase().includes(searchConfig.query.toLowerCase()) && !n.destination.toLowerCase().includes(searchConfig.query.toLowerCase())) return false;
    if (searchConfig.vehicleType !== 'All' && n.vehicleType !== searchConfig.vehicleType) return false;
    return true;
  });

  const myRides = nodes.filter((n: RideNode) => myRideIds.includes(n.id) && n.status !== 'completed');

  useEffect(() => {
    let base = newNode.vehicleType === 'Taxi' ? (settings.farePerTaxi || 0) : (settings.farePerPragia || 0);
    if (newNode.isSolo) base *= (settings.soloMultiplier || 1);
    setFareEstimate(base);
    setCustomOffer(null);
    setOfferInput(base.toFixed(2));
  }, [newNode.vehicleType, newNode.isSolo, settings]);

  const handleSubmit = () => {
    if (!newNode.origin || !newNode.destination) return alert("Fill all fields");
    const finalFare = customOffer ? parseFloat(customOffer.toString()) : fareEstimate;
    if ((currentUser.walletBalance || 0) < finalFare) { setShowWallet(true); return; }
    const node: RideNode = {
      id: `NODE-${Date.now()}`, origin: newNode.origin!, destination: newNode.destination!, vehicleType: newNode.vehicleType, isSolo: newNode.isSolo,
      capacityNeeded: newNode.isSolo ? 1 : (newNode.vehicleType === 'Taxi' ? 4 : 3),
      passengers: [{ id: currentUser.id, name: currentUser.username, phone: currentUser.phone }],
      status: newNode.isSolo ? 'qualified' : 'forming', leaderName: currentUser.username, leaderPhone: currentUser.phone,
      farePerPerson: finalFare, createdAt: new Date().toISOString()
    };
    onAddNode(node);
    setCreateMode(false);
  };

  const handleScanProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setTopupStep('scan');
      try {
          const base64 = await compressImage(file, 0.7, 800);
          const result = await verifyPaymentSlip(base64, settings.adminMomoName, currentUser.phone);
          setScanResult({ ...result, proofImage: base64 }); setTopupStep('result');
      } catch (err) { setTopupStep('info'); }
  };

  if (createMode) {
    return (
      <div className="glass p-8 rounded-[2.5rem] border border-white/10 animate-in zoom-in max-w-lg mx-auto relative">
         {showSoloAd && <AdGate onUnlock={() => {setIsSoloUnlocked(true); setShowSoloAd(false); setNewNode({...newNode, isSolo: true})}} label="Unlock Solo Ride" settings={settings} />}
         <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black italic uppercase text-white">New Request</h2><button onClick={() => setCreateMode(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button></div>
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl">
               <button onClick={() => setNewNode({...newNode, isSolo: false})} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${!newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Pool</button>
               <button onClick={() => newNode.isSolo ? setNewNode({...newNode, isSolo: false}) : (isSoloUnlocked ? setNewNode({...newNode, isSolo: true}) : setShowSoloAd(true))} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Solo</button>
            </div>
            <input value={newNode.origin} onChange={e => setNewNode({...newNode, origin: e.target.value})} placeholder="Pickup" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none" />
            <input value={newNode.destination} onChange={e => setNewNode({...newNode, destination: e.target.value})} placeholder="Destination" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none" />
            <div className="flex gap-2">{['Pragia', 'Taxi', 'Shuttle'].map(v => (<button key={v} onClick={() => setNewNode({...newNode, vehicleType: v as any})} className={`px-4 py-2 rounded-lg border border-white/10 font-black text-[10px] uppercase ${newNode.vehicleType === v ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-400'}`}>{v}</button>))}</div>
            <div className="p-6 bg-indigo-900/30 rounded-2xl border border-indigo-500/20"><div className="flex justify-between mb-2"><span className="text-[10px] font-black uppercase text-white">Your Offer (₵)</span></div>
               <div className="flex items-center gap-3">
                  <button onClick={() => {const v = (parseFloat(offerInput)||0)-1; setOfferInput(v.toFixed(2)); setCustomOffer(v);}} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center"><i className="fas fa-minus"></i></button>
                  <input type="number" step="0.5" value={offerInput} onChange={e => setOfferInput(e.target.value)} onBlur={() => setOfferInput(parseFloat(offerInput).toFixed(2))} className="flex-1 bg-black/50 border border-white/10 rounded-xl py-3 text-white font-black text-lg text-center outline-none" />
                  <button onClick={() => {const v = (parseFloat(offerInput)||0)+1; setOfferInput(v.toFixed(2)); setCustomOffer(v);}} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center"><i className="fas fa-plus"></i></button>
               </div>
            </div>
            <button onClick={handleSubmit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Confirm Request</button>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
       <div className="absolute top-[-70px] right-0 z-20">
          <button onClick={() => setShowWallet(true)} className="flex items-center gap-3 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-2xl border border-white/10 transition-all backdrop-blur-md">
             <div className="text-right"><p className="text-[9px] font-bold text-slate-400 uppercase">Wallet</p><p className={`text-sm font-black ${(currentUser.walletBalance || 0) < 5 ? 'text-rose-500' : 'text-emerald-400'}`}>₵ {(currentUser.walletBalance || 0).toFixed(2)}</p></div>
             <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><i className="fas fa-wallet"></i></div>
          </button>
       </div>

       {showWallet && (
           <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 backdrop-blur-xl">
               <div className="glass-bright w-full max-w-sm rounded-[2.5rem] p-8 border border-white/10 relative animate-in zoom-in">
                   <button onClick={() => { setShowWallet(false); setTopupStep('info'); }} className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500"><i className="fas fa-times"></i></button>
                   <h3 className="text-xl font-black italic uppercase text-white mb-6">Topup Hub</h3>
                   <div className="bg-gradient-to-br from-indigo-600 to-purple-800 p-6 rounded-[2rem] shadow-2xl mb-8">
                       <p className="text-[10px] font-black uppercase text-indigo-200 tracking-widest mb-1">NexRyde Balance</p>
                       <p className="text-4xl font-black text-white">₵ {(currentUser.walletBalance || 0).toFixed(2)}</p>
                   </div>
                   {topupStep === 'info' && (
                       <div className="space-y-4">
                           <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                               <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">MoMo to: {settings.adminMomo}</p>
                               <p className="text-[9px] text-slate-500">Name: {settings.adminMomoName}</p>
                           </div>
                           <label className="w-full py-3 bg-emerald-500 text-black rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 cursor-pointer shadow-lg">
                               <i className="fas fa-receipt"></i> Scan Receipt SMS
                               <input type="file" accept="image/*" className="hidden" onChange={handleScanProof} />
                           </label>
                       </div>
                   )}
                   {topupStep === 'scan' && <div className="text-center py-8 animate-pulse"><p className="text-xs font-black text-white uppercase">AI Analysis In Progress...</p></div>}
                   {topupStep === 'result' && scanResult && (
                       <div className="space-y-4 text-center">
                           <p className="text-lg font-black text-white uppercase">{scanResult.valid ? 'Analysis Success' : 'Analysis Failed'}</p>
                           <p className="text-xs text-slate-400">{scanResult.reason}</p>
                           {scanResult.valid && <button onClick={() => {onTopupSuccess(scanResult.amount, scanResult.reference, scanResult.proofImage); setShowWallet(false);}} className="w-full py-3 bg-emerald-500 text-black rounded-xl font-black text-[10px] uppercase">Finalize Request</button>}
                           {!scanResult.valid && <button onClick={() => setTopupStep('info')} className="w-full py-3 bg-white/10 text-white rounded-xl font-black text-[10px] uppercase">Try Again</button>}
                       </div>
                   )}
               </div>
           </div>
       )}

       {myRides.length > 0 && (
         <div className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">My Current Trips</h3>
            {myRides.map((node: RideNode) => {
              const myP = node.passengers.find(p => p.phone === currentUser.phone);
              const myCode = myP?.verificationCode || node.verificationCode;
              const assignedDriver = drivers.find((d: Driver) => d.id === node.assignedDriverId);
              return (
              <div key={node.id} className="glass p-6 rounded-[2rem] border border-indigo-500/30 bg-indigo-900/10 relative overflow-hidden">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                       <span className="px-2 py-1 rounded-md text-[8px] font-black uppercase bg-emerald-500 text-black">{node.status}</span>
                       <h4 className="text-lg font-black text-white mt-1">{node.destination}</h4>
                       <p className="text-xs text-slate-400">From: {node.origin}</p>
                    </div>
                    <div className="text-right"><p className="text-xl font-black text-white">₵{node.farePerPerson}</p></div>
                 </div>
                 {assignedDriver && (
                    <div className="bg-white/5 p-3 rounded-xl mb-4 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <img src={assignedDriver.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${assignedDriver.name}`} className="w-10 h-10 rounded-full object-cover" />
                           <div><p className="text-sm font-black text-white">{assignedDriver.name}</p><p className="text-[9px] text-slate-500">{assignedDriver.licensePlate} • ★ {assignedDriver.rating}</p></div>
                        </div>
                        <a href={`tel:${assignedDriver.contact}`} className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white"><i className="fas fa-phone text-xs"></i></a>
                    </div>
                 )}
                 {node.status === 'dispatched' && myCode && (
                    <div className="bg-black/30 p-4 rounded-xl mb-4 flex items-center justify-between">
                       <div><p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Ride PIN</p><p className="text-2xl font-black text-white tracking-[0.2em]">{myCode}</p></div>
                       <button onClick={() => setExpandedQr(myCode)} className="bg-white p-2 rounded-lg"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${myCode}`} className="w-12 h-12" /></button>
                    </div>
                 )}
                 <div className="flex gap-2">
                    {node.status === 'forming' && node.passengers.length > 1 && <button onClick={() => onForceQualify(node.id)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase">Force Qualify</button>}
                    <button onClick={() => onLeave(node.id, currentUser.phone)} className="flex-1 py-3 bg-white/5 text-slate-400 rounded-xl font-black text-[9px] uppercase">Leave Trip</button>
                 </div>
              </div>
            )})}
         </div>
       )}

       <div onClick={() => setCreateMode(true)} className="glass p-8 rounded-[2.5rem] border-2 border-dashed border-white/10 hover:border-amber-500/50 cursor-pointer group text-center space-y-2">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-500 group-hover:bg-amber-500 group-hover:text-black transition-all"><i className="fas fa-plus"></i></div>
          <h3 className="text-lg font-black uppercase italic text-white group-hover:text-amber-500 transition-colors">Start New Trip</h3>
       </div>

       <div>
          <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2 mb-4">Feed Hub</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {availableRides.length === 0 && <p className="text-slate-600 text-xs font-bold uppercase col-span-full text-center py-8">No open requests.</p>}
             {availableRides.map((node: RideNode, index: number) => {
               const seatsLeft = Math.max(0, node.capacityNeeded - node.passengers.length);
               return (
               <React.Fragment key={node.id}>
                <div className={`glass p-6 rounded-[2rem] border border-white/5 hover:border-white/10 transition-all`}>
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <span className="px-2 py-1 bg-white/10 rounded-md text-[8px] font-black uppercase text-slate-300">{node.vehicleType}</span>
                         <h4 className="text-base font-black text-white mt-1">{node.destination}</h4>
                         <p className="text-[10px] text-slate-400 uppercase">From: {node.origin}</p>
                      </div>
                      <div className="text-right"><p className="text-lg font-black text-amber-500">₵{node.farePerPerson}</p><p className="text-[9px] font-bold text-slate-500 uppercase">{node.passengers.length}/{node.capacityNeeded} Seats</p></div>
                   </div>
                   <button onClick={() => (currentUser.walletBalance || 0) < node.farePerPerson ? setShowWallet(true) : onJoin(node.id, currentUser.username, currentUser.phone)} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase bg-white/5 text-white hover:bg-white/10`}>Join Ride</button>
                </div>
                {(index + 1) % 3 === 0 && <InlineAd className="col-span-1" settings={settings} />}
               </React.Fragment>
             )})}
          </div>
       </div>

       {expandedQr && (
         <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[300] flex items-center justify-center p-6" onClick={() => setExpandedQr(null)}>
            <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center animate-in zoom-in" onClick={e => e.stopPropagation()}>
               <h3 className="text-2xl font-black uppercase text-black mb-6">Boarding Pass</h3>
               <div className="bg-black p-4 rounded-3xl inline-block mb-6"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${expandedQr}`} className="w-full aspect-square" /></div>
               <p className="text-5xl font-black text-black tracking-[0.2em]">{expandedQr}</p>
               <button onClick={() => setExpandedQr(null)} className="mt-8 text-xs font-black uppercase text-slate-400">Close</button>
            </div>
         </div>
       )}
    </div>
  );
};
