
import React, { useState } from 'react';
import { Modality } from "@google/genai";
import { Driver, RideNode } from '../types';
import { ai, decode, decodeAudioData } from '../lib/clients';
import { compressImage } from '../lib/utils';
import { QrScannerModal } from './Shared';

export const DriverPortal = ({ 
  drivers, 
  activeDriver, 
  onLogin, 
  onLogout, 
  qualifiedNodes, 
  dispatchedNodes, 
  missions, 
  allNodes,
  onJoinMission, 
  onAccept, 
  onBroadcast, 
  onStartBroadcast,
  onVerify, 
  onCancel, 
  onRequestTopup, 
  onRequestRegistration,
  searchConfig,
  settings,
  onUpdateStatus,
  isLoading
}: any) => {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [isScanning, setIsScanning] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [isPlayingBriefing, setIsPlayingBriefing] = useState(false);
  
  const [regMode, setRegMode] = useState(false);
  const [regData, setRegData] = useState<any>({ name: '', vehicleType: 'Pragia', licensePlate: '', contact: '', pin: '', amount: 20, momoReference: '', avatarUrl: '' });

  const [activeTab, setActiveTab] = useState<'market' | 'active' | 'wallet' | 'broadcast'>('market');
  const [verifyCode, setVerifyCode] = useState('');
  const [broadcastData, setBroadcastData] = useState({ origin: '', destination: '', seats: '3', fare: 5, note: '' });

  const myActiveRides = dispatchedNodes.filter((n: any) => n.assignedDriverId === activeDriver?.id && n.status !== 'completed');
  const availableRides = qualifiedNodes.filter((n: any) => {
      if (activeDriver && n.vehicleType !== activeDriver.vehicleType) return false;
      if (searchConfig.query && !n.origin.toLowerCase().includes(searchConfig.query.toLowerCase()) && !n.destination.toLowerCase().includes(searchConfig.query.toLowerCase())) return false;
      return true;
  });

  const myBroadcasts = allNodes.filter((n: any) => n.assignedDriverId === activeDriver?.id && n.status === 'forming');

  const isShuttle = activeDriver?.vehicleType === 'Shuttle';
  // SYNC Logic: Match Handler's default capacity logic for Shuttle vs Others
  const estimatedCapacity = parseInt(broadcastData.seats) || (isShuttle ? 10 : 3);
  const commissionRate = isShuttle ? (settings.shuttleCommission || 0) : settings.commissionPerSeat;
  // const requiredBalanceForBroadcast = isShuttle ? (estimatedCapacity * commissionRate) : 0; 
  // const canAffordBroadcast = activeDriver ? (activeDriver.walletBalance >= requiredBalanceForBroadcast) : false;

  const playMorningBriefing = async () => {
     if (isPlayingBriefing || !activeDriver) return;
     setIsPlayingBriefing(true);
     try {
       const prompt = `TTS the following conversation between Dispatcher Joe and Driver Jane (Keep it short, under 30 seconds):
          Joe: Good morning ${activeDriver.name}! Ready for the road?
          Jane: Always ready, Joe. What's the status on campus?
          Joe: We have ${availableRides.length} pending requests right now. 
          Jane: Any hotspots active?
          Joe: Yes, there are ${missions.length} active missions paying bonuses. Check the map!
          Jane: Copy that. Staying safe. Over.`;

       const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-exp",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: [
                        { speaker: 'Joe', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                        { speaker: 'Jane', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } }
                  ]
                }
            }
          }
       });

       const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
       if (base64Audio) {
         const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
         const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
         const source = ctx.createBufferSource();
         source.buffer = audioBuffer;
         source.connect(ctx.destination);
         source.start();
         source.onended = () => setIsPlayingBriefing(false);
       } else {
         setIsPlayingBriefing(false);
       }
     } catch (e) {
       console.error("Briefing failed", e);
       setIsPlayingBriefing(false);
     }
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-700">
             <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] animate-pulse">Syncing Network...</p>
          </div>
      );
  }

  if (!activeDriver) {
      if (regMode) {
          return (
              <div className="glass p-8 rounded-[2.5rem] border border-white/10 max-w-lg mx-auto animate-in zoom-in relative">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-black italic uppercase text-white">Partner Application</h2>
                      <button onClick={() => setRegMode(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
                  </div>
                  <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
                         <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center overflow-hidden relative group">
                            {regData.avatarUrl ? (
                               <img src={regData.avatarUrl} className="w-full h-full object-cover" />
                            ) : (
                               <i className="fas fa-camera text-slate-400"></i>
                            )}
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                               if (e.target.files?.[0]) {
                                  const base64 = await compressImage(e.target.files[0], 0.5, 300);
                                  setRegData({...regData, avatarUrl: base64});
                               }
                            }} />
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase text-white">Profile Photo</p>
                            <p className="text-[9px] text-slate-400">Required for Trust Verification</p>
                         </div>
                      </div>

                      <input value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} placeholder="Full Name" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                         <select value={regData.vehicleType} onChange={e => setRegData({...regData, vehicleType: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs">
                            <option value="Pragia">Pragia</option>
                            <option value="Taxi">Taxi</option>
                            <option value="Shuttle">Shuttle</option>
                         </select>
                         <input value={regData.licensePlate} onChange={e => setRegData({...regData, licensePlate: e.target.value})} placeholder="License Plate" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      </div>
                      <input value={regData.contact} onChange={e => setRegData({...regData, contact: e.target.value})} placeholder="Phone Number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      <input type="password" maxLength={4} value={regData.pin} onChange={e => setRegData({...regData, pin: e.target.value})} placeholder="Set a 4-digit PIN" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      
                      <div className="p-4 bg-indigo-600/10 rounded-xl border border-indigo-600/20">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Registration Fee: ₵{settings.registrationFee}</p>
                          <p className="text-[9px] text-slate-400">Send to <b>{settings.adminMomo}</b> ({settings.adminMomoName}) and enter Ref ID below.</p>
                          <input value={regData.momoReference} onChange={e => setRegData({...regData, momoReference: e.target.value, amount: settings.registrationFee})} placeholder="MoMo Reference ID" className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                      </div>

                      <button onClick={() => { onRequestRegistration(regData); setRegMode(false); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Submit Application</button>
                  </div>
              </div>
          )
      }

      return (
          <div className="glass p-8 rounded-[2.5rem] border border-white/10 max-w-sm mx-auto text-center space-y-6 animate-in zoom-in">
             <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                <i className="fas fa-id-card-clip text-2xl"></i>
             </div>
             <div>
                <h2 className="text-xl font-black italic uppercase text-white">Partner Access</h2>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Authorized Personnel Only</p>
             </div>
             
             <div className="space-y-4 animate-in slide-in-from-right">
                <div className="text-left space-y-3">
                   <div>
                       <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Partner ID</label>
                       <input 
                         type="text" 
                         value={loginIdentifier} 
                         onChange={e => setLoginIdentifier(e.target.value)} 
                         placeholder="Phone Number or Exact Name" 
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs focus:border-indigo-500 transition-colors" 
                       />
                   </div>
                   <div>
                       <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Security PIN</label>
                       <input 
                         type="password" 
                         maxLength={4} 
                         value={loginPin} 
                         onChange={e => setLoginPin(e.target.value)} 
                         placeholder="4-Digit PIN" 
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs text-center tracking-widest focus:border-indigo-500" 
                       />
                   </div>
                </div>
                
                <button onClick={() => {
                   const driver = drivers.find((d: Driver) => 
                      d.contact === loginIdentifier || 
                      d.name.toLowerCase() === loginIdentifier.toLowerCase()
                   );
                   
                   if (driver) {
                       onLogin(driver.id, loginPin);
                   } else {
                       alert("Partner not found. Please check credentials.");
                   }
                }} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-500 transition-all">
                   Access Terminal
                </button>
             </div>
             
             <div className="pt-4 border-t border-white/5">
                <button onClick={() => setRegMode(true)} className="text-[9px] font-black text-slate-500 uppercase hover:text-white transition-colors">Join the Fleet</button>
             </div>
          </div>
      );
  }

  return (
      <div className="space-y-6">
          {isScanning && (
             <QrScannerModal 
               onClose={() => setIsScanning(null)}
               onScan={(code) => {
                 if (isScanning) {
                    onVerify(isScanning, code);
                    setIsScanning(null);
                 }
               }}
             />
          )}
          
          <div className="flex justify-between items-center mb-6">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
               {['market', 'active', 'broadcast', 'wallet'].map(tab => (
                   <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                      {tab}
                      {tab === 'active' && myActiveRides.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}
                   </button>
               ))}
            </div>
            <button onClick={playMorningBriefing} disabled={isPlayingBriefing} className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-[#020617] shadow-lg hover:scale-105 transition-transform disabled:opacity-50">
               {isPlayingBriefing ? <i className="fas fa-volume-high animate-pulse"></i> : <i className="fas fa-play"></i>}
            </button>
          </div>

          {activeTab === 'market' && (
              <div className="space-y-6">
                  {missions.length > 0 && (
                      <div className="space-y-2">
                          <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Active Hotspots</h3>
                          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                             {missions.map((m: any) => {
                                 const joined = m.driversJoined.includes(activeDriver.id);
                                 return (
                                     <div key={m.id} className={`min-w-[250px] p-6 rounded-[2rem] border relative overflow-hidden ${joined ? 'bg-emerald-500 text-[#020617] border-emerald-400' : 'glass border-white/10'}`}>
                                         <div className="relative z-10">
                                            <h4 className="text-lg font-black uppercase italic">{m.location}</h4>
                                            <p className={`text-[10px] font-bold uppercase ${joined ? 'text-[#020617]/70' : 'text-indigo-400'}`}>Fee: ₵{m.entryFee}</p>
                                            <p className={`text-xs mt-2 ${joined ? 'text-[#020617]' : 'text-slate-400'}`}>{m.description}</p>
                                            <div className="mt-4 flex justify-between items-center">
                                                <span className={`text-[9px] font-black uppercase ${joined ? 'text-[#020617]/50' : 'text-slate-500'}`}>{m.driversJoined.length} Partners</span>
                                                {!joined && <button onClick={() => onJoinMission(m.id, activeDriver.id)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase">Station Here</button>}
                                                {joined && <span className="px-3 py-1 bg-[#020617]/20 rounded-lg text-[9px] font-black uppercase">Stationed</span>}
                                            </div>
                                         </div>
                                     </div>
                                 );
                             })}
                          </div>
                      </div>
                  )}

                  <div className="space-y-2">
                      <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Job Board</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {availableRides.length === 0 && <p className="col-span-full text-center text-slate-600 py-8 text-xs font-bold uppercase">No matching jobs.</p>}
                          {availableRides.map((node: any) => {
                             const isSolo = node.isSolo;
                             const paxCount = node.passengers.length;
                             const capacity = node.capacityNeeded;
                             const canAccept = paxCount > 0;
                             
                             const baseFare = node.vehicleType === 'Taxi' ? settings.farePerTaxi : settings.farePerPragia;
                             const expectedFare = node.isSolo ? baseFare * settings.soloMultiplier : baseFare;
                             const isHighFare = node.farePerPerson > expectedFare;

                             return (
                                 <div key={node.id} className={`glass p-6 rounded-[2rem] border transition-all group relative ${isHighFare ? 'border-amber-500/40 shadow-lg shadow-amber-500/10' : 'border-white/5 hover:border-indigo-500/30'}`}>
                                     {node.isSolo && <div className="absolute top-4 right-4 text-[9px] font-black uppercase bg-amber-500 text-[#020617] px-2 py-1 rounded-md animate-pulse">Express</div>}
                                     <div className="mb-4">
                                         <h4 className="text-lg font-black text-white">{node.destination}</h4>
                                         <p className="text-[10px] text-slate-400 uppercase">From: {node.origin}</p>
                                     </div>
                                     <div className="flex justify-between items-center mb-4 p-3 bg-white/5 rounded-xl border border-white/5">
                                         <div>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">Per Pax</p>
                                            <div className="flex items-center gap-2">
                                                <p className={`text-lg font-black ${isHighFare ? 'text-amber-400' : 'text-white'}`}>₵ {node.farePerPerson}</p>
                                                {isHighFare && <i className="fas fa-fire text-amber-500 text-xs animate-bounce"></i>}
                                            </div>
                                         </div>
                                         <div className="text-right">
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">Est. Total</p>
                                            <p className="text-lg font-black text-emerald-400">₵ {(node.farePerPerson * (isSolo ? 1 : capacity)).toFixed(2)}</p>
                                         </div>
                                     </div>
                                     <div className="flex gap-1 mb-4">
                                         {[...Array(capacity)].map((_, i) => (
                                             <div key={i} className={`h-1.5 flex-1 rounded-full ${i < paxCount ? 'bg-indigo-500' : 'bg-white/10'}`}></div>
                                         ))}
                                     </div>
                                     <button onClick={() => onAccept(node.id, activeDriver.id)} disabled={!canAccept} className="w-full py-3 bg-white text-[#020617] rounded-xl font-black text-[10px] uppercase hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                         Accept Request
                                     </button>
                                 </div>
                             );
                          })}
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'active' && (
              <div className="space-y-4">
                  {myActiveRides.length === 0 && <p className="text-center text-slate-600 py-8 text-xs font-bold uppercase">No active trips.</p>}
                  {myActiveRides.map((node: any) => (
                      <div key={node.id} className="glass p-8 rounded-[2.5rem] border border-indigo-500/30 bg-indigo-900/10 relative overflow-hidden">
                          <div className="relative z-10">
                              <div className="flex justify-between items-start mb-6">
                                  <div>
                                     <span className="px-3 py-1 bg-emerald-500 text-[#020617] rounded-lg text-[9px] font-black uppercase mb-2 inline-block animate-pulse">In Progress</span>
                                     <h3 className="text-2xl font-black text-white">{node.destination}</h3>
                                     <p className="text-xs text-slate-300">Pickup: {node.origin}</p>
                                  </div>
                                  <div className="text-right">
                                     <p className="text-3xl font-black text-white">₵ {node.negotiatedTotalFare || (node.farePerPerson * node.passengers.length)}</p>
                                     <p className="text-[10px] font-bold text-indigo-300 uppercase">Total Fare</p>
                                  </div>
                              </div>
                              
                              <div className="bg-black/30 p-6 rounded-2xl mb-6 border border-white/5">
                                 <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Passenger Manifest</h4>
                                 <div className="space-y-3">
                                     {node.passengers.map((p: any) => {
                                         return (
                                             <div key={p.id} className="flex justify-between items-center">
                                                 <div className="flex items-center gap-3">
                                                     <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">{p.name[0]}</div>
                                                     <div>
                                                         <p className="text-sm font-bold text-white">{p.name}</p>
                                                         <div className="flex gap-3 mt-1">
                                                            <a href={`tel:${p.phone}`} className="text-[10px] text-indigo-400 font-bold flex items-center gap-1 hover:text-white"><i className="fas fa-phone"></i> Call</a>
                                                            <a href={`https://wa.me/${p.phone.replace(/[^0-9]/g, '')}`} target="_blank" className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 hover:text-white"><i className="fab fa-whatsapp"></i> Chat</a>
                                                         </div>
                                                     </div>
                                                 </div>
                                                 <span className="text-[9px] font-black text-slate-500 uppercase">Pending</span>
                                             </div>
                                         );
                                     })}
                                 </div>
                              </div>

                              <button onClick={() => setIsScanning(node.id)} className="w-full py-8 bg-gradient-to-tr from-white to-slate-200 text-indigo-900 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center mb-6 animate-pulse hover:scale-[1.02] transition-transform">
                                  <i className="fas fa-qrcode text-4xl mb-2"></i>
                                  <span className="text-xl font-black uppercase tracking-tight">Scan Rider Code</span>
                                  <span className="text-[10px] font-bold uppercase opacity-60">Tap to Verify</span>
                              </button>

                              <div className="flex justify-center mb-6">
                                  <button onClick={() => setShowManualEntry(!showManualEntry)} className="text-[10px] font-bold text-slate-400 underline uppercase">
                                     Problem scanning? Use Manual Entry
                                  </button>
                              </div>

                              {showManualEntry && (
                                <div className="flex gap-2 mb-6 animate-in slide-in-from-top-2 fade-in">
                                    <input type="number" placeholder="Enter PIN manually" className="flex-[2] bg-white text-[#020617] rounded-xl px-4 text-center font-black text-lg outline-none placeholder:text-slate-400 placeholder:text-xs placeholder:font-bold" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} />
                                    <button onClick={() => { onVerify(node.id, verifyCode); setVerifyCode(''); }} className="flex-1 py-4 bg-emerald-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-lg">Verify</button>
                                </div>
                              )}

                              <div className="text-center">
                                  <button onClick={() => onCancel(node.id)} className="w-12 h-12 mx-auto flex items-center justify-center bg-rose-500/20 text-rose-500 rounded-full hover:bg-rose-500 hover:text-white transition-all"><i className="fas fa-ban"></i></button>
                                  <p className="text-[9px] text-rose-500 font-bold uppercase mt-2">Cancel Trip</p>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {activeTab === 'broadcast' && (
              <div className="space-y-8">
                  <div className="glass p-6 md:p-8 rounded-[2.5rem] border border-white/10">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black italic uppercase text-white">Create Route</h3>
                        {isShuttle && (
                          <span className="px-2 py-1 bg-amber-500 text-[#020617] text-[8px] font-black uppercase rounded">Bus Mode</span>
                        )}
                      </div>
                      <div className="space-y-4">
                          <input value={broadcastData.origin} onChange={e => setBroadcastData({...broadcastData, origin: e.target.value})} placeholder="Starting Point" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                          <input value={broadcastData.destination} onChange={e => setBroadcastData({...broadcastData, destination: e.target.value})} placeholder="Destination" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="text-[8px] text-slate-500 uppercase font-bold pl-2">Fare (₵)</label>
                                  <input type="number" value={broadcastData.fare} onChange={e => setBroadcastData({...broadcastData, fare: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                              </div>
                              <div>
                                  <label className="text-[8px] text-slate-500 uppercase font-bold pl-2">Seats</label>
                                  {isShuttle ? (
                                     <input 
                                       type="number" 
                                       min="5" 
                                       max="60" 
                                       placeholder="Capacity"
                                       value={broadcastData.seats} 
                                       onChange={e => setBroadcastData({...broadcastData, seats: e.target.value})} 
                                       className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" 
                                     />
                                  ) : (
                                    <select value={broadcastData.seats} onChange={e => setBroadcastData({...broadcastData, seats: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs">
                                        {[1,2,3,4].map(n => <option key={n} value={n.toString()}>{n}</option>)}
                                    </select>
                                  )}
                              </div>
                          </div>
                          <input value={broadcastData.note} onChange={e => setBroadcastData({...broadcastData, note: e.target.value})} placeholder="Note (e.g. Leaving in 5 mins)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                          
                          <button 
                            onClick={() => onBroadcast(broadcastData)} 
                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all bg-indigo-600 text-white hover:bg-indigo-500`}
                          >
                             Broadcast Route
                          </button>
                      </div>
                  </div>

                  {myBroadcasts.length > 0 && (
                      <div className="space-y-4">
                          <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Your Broadcasts</h3>
                          {myBroadcasts.map((node: any) => (
                              <div key={node.id} className="glass p-6 rounded-[2rem] border border-indigo-500/30">
                                  <div className="flex justify-between items-center mb-4">
                                      <div>
                                          <h4 className="text-white font-bold">{node.destination}</h4>
                                          <p className="text-[10px] text-slate-400 uppercase">From: {node.origin}</p>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-lg font-black text-amber-500">₵{node.farePerPerson}</p>
                                          <p className="text-[9px] text-slate-500 uppercase">{node.passengers.length}/{node.capacityNeeded} Joined</p>
                                      </div>
                                  </div>
                                  <div className="space-y-2 mb-4">
                                      {node.passengers.map((p: any) => (
                                          <div key={p.id} className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 p-2 rounded-lg">
                                              <i className="fas fa-user"></i> {p.name}
                                          </div>
                                      ))}
                                      {node.passengers.length === 0 && <p className="text-[10px] text-slate-600 italic">Waiting for passengers...</p>}
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => onStartBroadcast(node.id)} disabled={node.passengers.length === 0} className="flex-[2] py-3 bg-emerald-500 text-[#020617] rounded-xl font-black text-[9px] uppercase disabled:opacity-50">Start Trip</button>
                                      <button onClick={() => onCancel(node.id)} className="flex-1 py-3 bg-rose-500/20 text-rose-500 rounded-xl font-black text-[9px] uppercase">Cancel</button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'wallet' && (
              <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
                  <div className="text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Earnings</p>
                      <h3 className="text-4xl font-black text-white">₵ {activeDriver.walletBalance.toFixed(2)}</h3>
                  </div>
                  
                  <div className="p-6 bg-white/5 rounded-[2rem] border border-white/5 space-y-4">
                      <h4 className="text-xs font-black uppercase text-white">Withdraw Funds</h4>
                      <div className="space-y-3">
                          <input type="number" placeholder="Amount (₵)" id="topup-amount" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" />
                          <input placeholder="MoMo Number" id="topup-ref" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs" defaultValue={activeDriver.contact} />
                          <button onClick={() => {
                              const amt = (document.getElementById('topup-amount') as HTMLInputElement).value;
                              const ref = (document.getElementById('topup-ref') as HTMLInputElement).value;
                              if (activeDriver.walletBalance < parseFloat(amt)) {
                                  alert("Insufficient Balance");
                                  return;
                              }
                              // We reuse requestTopup function but context is different, maybe rename it in App.tsx or add type
                              onRequestTopup(activeDriver.id, parseFloat(amt), ref, 'withdrawal');
                          }} className="w-full py-3 bg-emerald-500 text-[#020617] rounded-xl font-black text-[9px] uppercase shadow-lg">Request Payout</button>
                      </div>
                      <p className="text-[9px] text-slate-500 text-center">Admin: {settings.adminMomo} ({settings.adminMomoName})</p>
                  </div>
                  
                  <div className="pt-4 border-t border-white/5">
                      <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                          <select value={activeDriver.status} onChange={(e) => onUpdateStatus(e.target.value)} className="bg-white/5 text-white text-[10px] font-bold uppercase rounded-lg px-2 py-1 outline-none border border-white/10">
                              <option value="online">Online</option>
                              <option value="busy">Busy</option>
                              <option value="offline">Offline</option>
                          </select>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Rating</span>
                          <span className="text-white font-black text-sm flex items-center gap-1"><i className="fas fa-star text-amber-500 text-xs"></i> {activeDriver.rating}</span>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
};
