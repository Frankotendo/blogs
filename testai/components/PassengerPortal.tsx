
import React, { useState, useEffect } from 'react';
import { RideNode, AppSettings, SearchConfig, Driver } from '../types';
import { AdGate, InlineAd } from './SharedUI';

interface PassengerPortalProps {
  currentUser: any;
  nodes: RideNode[];
  myRideIds: string[];
  onAddNode: (node: RideNode) => void;
  onJoin: (id: string, name: string, phone: string) => void;
  onLeave: (id: string, phone: string) => void;
  onForceQualify: (id: string) => void;
  onCancel: (id: string) => void;
  drivers: Driver[];
  searchConfig: SearchConfig;
  settings: AppSettings;
  createMode: boolean;
  setCreateMode: (v: boolean) => void;
  newNode: Partial<RideNode>;
  setNewNode: (v: any) => void;
  onTriggerVoice: () => void;
}

export const PassengerPortal: React.FC<PassengerPortalProps> = ({ 
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
  createMode,
  setCreateMode,
  newNode,
  setNewNode,
  onTriggerVoice
}) => {
  const [fareEstimate, setFareEstimate] = useState(0);
  const [customOffer, setCustomOffer] = useState<number | null>(null);
  const [offerInput, setOfferInput] = useState<string>(''); 
  const [showSoloAd, setShowSoloAd] = useState(false);
  const [isSoloUnlocked, setIsSoloUnlocked] = useState(false);
  const [expandedQr, setExpandedQr] = useState<string | null>(null);

  const filteredNodes = nodes.filter((n) => {
    if (searchConfig.query && !n.origin.toLowerCase().includes(searchConfig.query.toLowerCase()) && !n.destination.toLowerCase().includes(searchConfig.query.toLowerCase())) return false;
    if (searchConfig.vehicleType !== 'All' && n.vehicleType !== searchConfig.vehicleType) return false;
    return true;
  });

  const myRides = nodes.filter((n) => myRideIds.includes(n.id) && n.status !== 'completed');
  const availableRides = filteredNodes.filter((n) => n.status !== 'completed' && n.status !== 'dispatched' && !myRideIds.includes(n.id));

  useEffect(() => {
    let base = newNode.vehicleType === 'Taxi' ? settings.farePerTaxi : settings.farePerPragia;
    if (newNode.isSolo) base *= settings.soloMultiplier;
    setFareEstimate(base);
    setOfferInput(base.toFixed(2));
    setCustomOffer(null);
  }, [newNode.vehicleType, newNode.isSolo, settings]);

  const adjustOffer = (delta: number) => {
    const current = parseFloat(offerInput) || fareEstimate;
    const newVal = Math.max(fareEstimate, current + delta);
    setOfferInput(newVal.toFixed(2));
    setCustomOffer(newVal);
  };

  const handleSoloUnlock = () => {
    setIsSoloUnlocked(true);
    setNewNode({ ...newNode, isSolo: true });
    setShowSoloAd(false);
  };

  const handleSubmit = () => {
    if (!newNode.origin || !newNode.destination) return alert("Fill all fields");
    const finalFare = customOffer || fareEstimate;
    const node: RideNode = {
      id: `NODE-${Date.now()}`,
      origin: newNode.origin!,
      destination: newNode.destination!,
      vehicleType: (newNode.vehicleType as any) || 'Pragia',
      isSolo: !!newNode.isSolo,
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
  };

  if (createMode) {
    return (
      <div className="glass p-6 rounded-[2rem] border border-white/10 animate-in zoom-in max-w-lg mx-auto relative">
         {showSoloAd && <AdGate onUnlock={handleSoloUnlock} label="Unlock Solo Ride" settings={settings} />}
         <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black italic uppercase text-white">New Request</h2>
            <button onClick={() => setCreateMode(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
         </div>
         <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-2xl">
               <button onClick={() => setNewNode({...newNode, isSolo: false})} className={`py-3 rounded-xl font-black text-[10px] uppercase ${!newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Pool</button>
               <button onClick={() => { if(isSoloUnlocked) setNewNode({...newNode, isSolo: true}); else setShowSoloAd(true); }} className={`py-3 rounded-xl font-black text-[10px] uppercase ${newNode.isSolo ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Solo</button>
            </div>
            <div className="relative">
              <input value={newNode.origin || ''} onChange={e => setNewNode({...newNode, origin: e.target.value})} placeholder="Pickup Location" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-sm" />
              <button onClick={onTriggerVoice} className="absolute right-2 top-2 w-8 h-8 flex items-center justify-center text-indigo-400"><i className="fas fa-microphone"></i></button>
            </div>
            <div className="relative">
              <input value={newNode.destination || ''} onChange={e => setNewNode({...newNode, destination: e.target.value})} placeholder="Dropoff Location" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-sm" />
              <button onClick={onTriggerVoice} className="absolute right-2 top-2 w-8 h-8 flex items-center justify-center text-indigo-400"><i className="fas fa-microphone"></i></button>
            </div>
            <div className="flex gap-2 py-2">
               {['Pragia', 'Taxi', 'Shuttle'].map(v => (
                 <button key={v} onClick={() => setNewNode({...newNode, vehicleType: v as any})} className={`px-4 py-2 rounded-lg border border-white/10 font-black text-[10px] uppercase ${newNode.vehicleType === v ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-400'}`}>{v}</button>
               ))}
            </div>
            <div className="p-4 bg-indigo-900/30 rounded-2xl border border-indigo-500/20 space-y-3">
               <div className="flex justify-between items-center">
                   <div>
                       <span className="text-[10px] font-black uppercase text-indigo-300 block">Base Fare</span>
                       {newNode.isSolo && <span className="text-[9px] text-slate-500 font-bold uppercase">(Solo Multiplier Applied)</span>}
                   </div>
                   <span className="text-sm font-bold text-slate-400">₵{fareEstimate.toFixed(2)}</span>
               </div>
               <div className="flex items-center gap-2">
                  <button onClick={() => adjustOffer(-0.5)} className="w-10 h-10 shrink-0 bg-white/5 rounded-xl border border-white/10 text-white"><i className="fas fa-minus"></i></button>
                  <input type="number" value={offerInput} readOnly className="flex-1 bg-black/50 border border-white/10 rounded-xl py-3 text-white font-black text-lg text-center outline-none" />
                  <button onClick={() => adjustOffer(0.5)} className="w-10 h-10 shrink-0 bg-white/5 rounded-xl border border-white/10 text-white"><i className="fas fa-plus"></i></button>
               </div>
            </div>
            <button onClick={handleSubmit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl">Request Ride</button>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       {myRides.map((node) => {
         const assignedDriver = drivers.find(d => d.id === node.assignedDriverId);
         const myInfo = node.passengers.find(p => p.phone === currentUser.phone);
         
         return (
         <div key={node.id} className="glass p-6 rounded-[2rem] border border-indigo-500/30 bg-indigo-900/10 relative overflow-hidden">
            <div className="flex justify-between mb-4">
               <div>
                  <h4 className="text-lg font-black text-white">{node.destination}</h4>
                  <p className="text-xs text-slate-400">From: {node.origin}</p>
               </div>
               <div className="text-right">
                  <p className="text-xl font-black text-white">₵{node.farePerPerson}</p>
                  <p className="text-[10px] font-black text-amber-500 uppercase">{node.status}</p>
               </div>
            </div>

            {assignedDriver && (
              <div className="bg-white/5 p-4 rounded-xl mb-4 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-black font-black">
                    {assignedDriver.name[0]}
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Partner</p>
                    <p className="text-sm font-black text-white">{assignedDriver.name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href={`tel:${assignedDriver.contact}`} className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs"><i className="fas fa-phone"></i></a>
                  {node.status === 'dispatched' && myInfo?.verificationCode && (
                    <button onClick={() => setExpandedQr(myInfo.verificationCode!)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white text-xs border border-white/10"><i className="fas fa-qrcode"></i></button>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
               {node.status === 'forming' && node.passengers.length > 1 && (
                 <button onClick={() => onForceQualify(node.id)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase">Go Now (Pay Full)</button>
               )}
               <button onClick={() => onCancel(node.id)} className="flex-1 py-3 bg-white/5 text-slate-400 rounded-xl font-black text-[9px] uppercase hover:bg-rose-500/20 hover:text-rose-500 transition-all">Cancel</button>
            </div>
         </div>
       )})}

       {expandedQr && (
         <div className="fixed inset-0 bg-black/95 z-[3000] flex items-center justify-center p-6" onClick={() => setExpandedQr(null)}>
            <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm text-center animate-in zoom-in" onClick={e => e.stopPropagation()}>
               <h3 className="text-2xl font-black uppercase text-[#020617] mb-2">Ride PIN</h3>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Show to Partner</p>
               <div className="bg-[#020617] p-4 rounded-2xl inline-block mb-6">
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${expandedQr}`} className="w-full aspect-square bg-white p-2 rounded-xl" alt="QR" />
               </div>
               <p className="text-5xl font-black text-[#020617] tracking-[0.2em]">{expandedQr}</p>
               <button onClick={() => setExpandedQr(null)} className="mt-8 w-full py-4 bg-[#020617] text-white rounded-xl font-black uppercase text-xs">Close</button>
            </div>
         </div>
       )}

       <div onClick={() => setCreateMode(true)} className="glass p-8 rounded-[2.5rem] border-2 border-dashed border-white/10 hover:border-amber-500/50 cursor-pointer text-center space-y-2 group transition-all">
          <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-500 group-hover:bg-amber-500 group-hover:text-black transition-all"><i className="fas fa-plus"></i></div>
          <h3 className="text-lg font-black uppercase italic text-white group-hover:text-amber-500 transition-colors">Start New Trip</h3>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableRides.length === 0 && <p className="col-span-full text-center py-12 text-slate-600 text-xs font-bold uppercase tracking-widest">No active pools nearby.</p>}
          {availableRides.map((node, index) => (
            <React.Fragment key={node.id}>
              <div className="glass p-6 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                       <span className="px-2 py-1 bg-white/10 rounded-md text-[8px] font-black uppercase text-slate-300">{node.vehicleType}</span>
                       <h4 className="text-base font-black text-white mt-1">{node.destination}</h4>
                       <p className="text-[10px] text-slate-400 uppercase">From: {node.origin}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-lg font-black text-amber-500">₵{node.farePerPerson}</p>
                       <p className="text-[9px] font-bold text-slate-500 uppercase">{node.passengers.length}/{node.capacityNeeded} Seats</p>
                    </div>
                 </div>
                 <button onClick={() => onJoin(node.id, currentUser.username, currentUser.phone)} className="w-full py-3 bg-white/5 hover:bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase transition-all">Join Ride</button>
              </div>
              {(index + 1) % 3 === 0 && <InlineAd settings={settings} />}
            </React.Fragment>
          ))}
       </div>
    </div>
  );
};
