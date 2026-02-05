
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { HubMission, Driver, AppSettings } from '../types';
import { supabase, ai } from '../lib/clients';
import { compressImage } from '../lib/utils';

export const AdminLogin = ({ onLogin }: any) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  return (
    <div className="max-w-sm mx-auto glass p-8 rounded-[2.5rem] border border-white/10 text-center space-y-6 animate-in zoom-in">
       <div className="w-16 h-16 bg-rose-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-rose-900/20">
          <i className="fas fa-shield-halved text-2xl"></i>
       </div>
       <div>
          <h2 className="text-xl font-black italic uppercase text-white">Restricted Access</h2>
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">Admin Credentials Required</p>
       </div>
       <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin Email" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs focus:border-rose-500" />
       <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs focus:border-rose-500" />
       <button onClick={() => onLogin(email, pass)} className="w-full py-4 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Authenticate</button>
    </div>
  );
};

export const AdminPortal = ({ 
  activeTab, 
  setActiveTab, 
  nodes, 
  drivers, 
  onAddDriver, 
  onDeleteDriver, 
  onCancelRide, 
  onSettleRide, 
  missions, 
  onCreateMission, 
  onDeleteMission, 
  transactions, 
  topupRequests, 
  registrationRequests, 
  onApproveTopup, 
  onRejectTopup, 
  onApproveRegistration, 
  onRejectRegistration, 
  onLock, 
  settings, 
  onUpdateSettings, 
  hubRevenue, 
  adminEmail,
  onManualCredit,
  // Fix: Added pendingRequestsCount to props destructuring
  pendingRequestsCount
}: any) => {
  const [newMission, setNewMission] = useState({ location: '', description: '', entryFee: 5 });
  const [newDriver, setNewDriver] = useState({ name: '', contact: '', vehicleType: 'Pragia', licensePlate: '', pin: '1234', avatarUrl: '' });
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  
  // Marketing / Veo
  const [videoPrompt, setVideoPrompt] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Pulse
  const [pulseAnalysis, setPulseAnalysis] = useState<any>(null);
  const [isAnalyzingPulse, setIsAnalyzingPulse] = useState(false);

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Manual Credit
  const [manualCreditData, setManualCreditData] = useState({ identifier: '', amount: 0, type: 'credit' });

  // Receipt Modal
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSaveSettings = async () => {
      setIsSaving(true);
      await onUpdateSettings(localSettings);
      setIsSaving(false);
  };

  const handleUpdateCredentials = async () => {
    if (!newAdminEmail && !newAdminPassword) return alert("Enter a new email or password to update.");
    
    const updates: any = {};
    if (newAdminEmail) updates.email = newAdminEmail;
    if (newAdminPassword) updates.password = newAdminPassword;

    const { error } = await supabase.auth.updateUser(updates);
    if (error) alert("Update failed: " + error.message);
    else {
        alert("Credentials updated! Please login again if you changed your password.");
        setNewAdminEmail('');
        setNewAdminPassword('');
    }
  };

  const handleImageUpload = async (e: any, field: 'appLogo' | 'appWallpaper') => {
      const file = e.target.files[0];
      if(file) {
          const base64 = await compressImage(file);
          setLocalSettings({...localSettings, [field]: base64});
      }
  };
  
  const handlePortfolioUpload = async (e: any) => {
      const files = Array.from(e.target.files);
      const newImages = await Promise.all(files.map((f: any) => compressImage(f)));
      setLocalSettings({...localSettings, aboutMeImages: [...(localSettings.aboutMeImages || []), ...newImages]});
  };

  const handleCreatePromo = async () => {
      if (!videoPrompt) return;
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
          return;
      }

      setIsGeneratingVideo(true);
      try {
          const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
          let operation = await videoAi.models.generateVideos({
              model: 'veo-3.1-fast-generate-preview',
              prompt: videoPrompt,
              config: {
                 numberOfVideos: 1,
                 resolution: '1080p',
                 aspectRatio: '16:9'
              }
          });
          
          while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            operation = await videoAi.operations.getVideosOperation({operation: operation});
          }

          const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (uri) {
              const videoUrl = `${uri}&key=${process.env.API_KEY}`;
              window.open(videoUrl, '_blank');
              setVideoPrompt('');
              alert("Video Generated! Opening in new tab.");
          }
      } catch (err: any) {
          console.error("Video Gen Error", err);
          alert("Video generation failed: " + err.message);
          if (err.message.includes("Requested entity was not found")) {
             await (window as any).aistudio.openSelectKey();
          }
      } finally {
          setIsGeneratingVideo(false);
      }
  };

  const handlePulseAnalysis = async () => {
      setIsAnalyzingPulse(true);
      try {
          const activeRides = nodes.filter((n: any) => n.status !== 'completed').length;
          const onlineDrivers = drivers.filter((d: any) => d.status === 'online').length;
          const hour = new Date().getHours();

          const prompt = `
            Analyze these ride-sharing stats:
            - Active Rides: ${activeRides}
            - Online Drivers: ${onlineDrivers}
            - Time of Day: ${hour}:00
            - Current Settings: Pragia Fare ${settings.farePerPragia}, Multiplier ${settings.soloMultiplier}.

            Output a JSON with:
            - "status": "Surge" or "Normal" or "Quiet"
            - "reason": Short explanation.
            - "suggestedAction": "Raise Pragia Fare by 1", "Lower Multiplier", etc.
          `;
          
          const pulseAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await pulseAi.models.generateContent({
             model: 'gemini-3-pro-preview',
             contents: prompt,
             config: { responseMimeType: 'application/json' }
          });
          
          const json = JSON.parse(response.text || '{}');
          setPulseAnalysis(json);
      } catch (e) {
          console.error("Pulse Failed", e);
      } finally {
          setIsAnalyzingPulse(false);
      }
  };

  return (
    <div className="space-y-6">
       <div className="glass p-6 rounded-[2.5rem] border border-white/10 flex justify-between items-center">
          <div>
             <h2 className="text-xl font-black italic uppercase text-white">Command Center</h2>
             <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{adminEmail}</p>
          </div>
          <button onClick={onLock} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-white/10 transition-all">
             <i className="fas fa-lock"></i>
          </button>
       </div>

       <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
          {['monitor', 'drivers', 'rides', 'finance', 'missions', 'marketing', 'config'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                 {tab}
              </button>
          ))}
       </div>

       {activeTab === 'monitor' && (
          <div className="space-y-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass p-6 rounded-[2rem] border border-rose-500/20 bg-rose-900/5 shadow-lg shadow-rose-900/5">
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-2">Platform Revenue</p>
                    <p className="text-2xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">Net Commissions</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Active Partners</p>
                    <p className="text-2xl font-black text-emerald-400">{drivers.filter((d:any) => d.status === 'online').length} / {drivers.length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Ongoing Trips</p>
                    <p className="text-2xl font-black text-amber-500">{nodes.filter((n:any) => n.status !== 'completed').length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Tasks Pending</p>
                    <p className="text-2xl font-black text-indigo-400">{pendingRequestsCount}</p>
                </div>
             </div>
             
             <div className="glass p-8 rounded-[2rem] border border-white/10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-black text-white uppercase">Market Pulse (AI)</h3>
                    <button onClick={handlePulseAnalysis} disabled={isAnalyzingPulse} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-50">
                        {isAnalyzingPulse ? 'Reasoning...' : 'Analyze Supply/Demand'}
                    </button>
                </div>
                {pulseAnalysis && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 animate-in fade-in">
                        <div className="flex items-center gap-2 mb-2">
                           <span className={`w-2 h-2 rounded-full ${pulseAnalysis.status === 'Surge' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                           <span className="text-sm font-black text-white uppercase">{pulseAnalysis.status}</span>
                        </div>
                        <p className="text-xs text-slate-300 mb-2">{pulseAnalysis.reason}</p>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase">Suggestion: {pulseAnalysis.suggestedAction}</p>
                    </div>
                )}
             </div>
          </div>
       )}
       
       {activeTab === 'finance' && (
           <div className="space-y-6">
               <div className="glass p-6 rounded-[2rem] border border-white/10">
                   <h3 className="text-sm font-black text-white uppercase mb-4">Direct Wallet Injection</h3>
                   <div className="space-y-3">
                       <input 
                         value={manualCreditData.identifier} 
                         onChange={e => setManualCreditData({...manualCreditData, identifier: e.target.value})} 
                         placeholder="User or Driver Phone Number" 
                         className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs"
                       />
                       <div className="flex gap-2">
                           <input 
                             type="number" 
                             value={manualCreditData.amount} 
                             onChange={e => setManualCreditData({...manualCreditData, amount: parseFloat(e.target.value)})} 
                             placeholder="Amount (Cedis)" 
                             className="flex-[2] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold outline-none text-xs"
                           />
                           <button 
                             onClick={() => {
                                if (manualCreditData.amount <= 0 || !manualCreditData.identifier) return alert("Invalid Input");
                                onManualCredit(manualCreditData.identifier, manualCreditData.amount);
                             }}
                             className="flex-1 bg-emerald-500 text-[#020617] rounded-xl font-black text-[9px] uppercase shadow-lg"
                           >
                              Credit Wallet
                           </button>
                       </div>
                   </div>
               </div>

               <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Pending Topups</h3>
                  {topupRequests.filter((r:any) => r.status === 'pending').length === 0 && <p className="text-center text-slate-600 text-xs py-4">No pending requests.</p>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {topupRequests.filter((r:any) => r.status === 'pending').map((r: any) => (
                          <div key={r.id} className="glass p-6 rounded-3xl border border-indigo-500/30 flex flex-col space-y-4">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <p className="text-xl font-black text-white">₵ {r.amount}</p>
                                      <p className="text-[10px] text-slate-400 font-bold uppercase">Ref: {r.momoReference}</p>
                                      <p className="text-[9px] text-slate-500 italic">{r.timestamp}</p>
                                  </div>
                                  <button onClick={() => setViewReceipt(r.proofImage)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-indigo-400 hover:text-white transition-all">
                                      <i className="fas fa-image"></i>
                                  </button>
                              </div>
                              
                              {r.proofImage && (
                                  <div onClick={() => setViewReceipt(r.proofImage)} className="h-24 bg-black rounded-xl overflow-hidden cursor-pointer border border-white/5">
                                      <img src={r.proofImage} className="w-full h-full object-cover opacity-50 hover:opacity-100 transition-opacity" />
                                  </div>
                              )}

                              <div className="flex gap-2">
                                <button onClick={() => onApproveTopup(r.id)} className="flex-1 py-3 bg-emerald-500 text-[#020617] rounded-xl text-[10px] font-black uppercase shadow-lg">Approve</button>
                                <button onClick={() => onRejectTopup(r.id)} className="flex-1 py-3 bg-rose-500/10 text-rose-500 rounded-xl text-[10px] font-black uppercase border border-rose-500/20">Reject</button>
                              </div>
                          </div>
                      ))}
                  </div>
               </div>

               <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Pending Registrations</h3>
                  {registrationRequests.filter((r:any) => r.status === 'pending').length === 0 && <p className="text-center text-slate-600 text-xs py-4">No pending applications.</p>}
                  {registrationRequests.filter((r:any) => r.status === 'pending').map((r: any) => (
                      <div key={r.id} className="glass p-4 rounded-2xl border border-indigo-500/30">
                          <div className="flex justify-between items-start mb-2">
                             <div>
                                <p className="text-sm font-black text-white">{r.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold">{r.vehicleType} • {r.contact}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-sm font-black text-emerald-400">Paid: ₵ {r.amount}</p>
                                <p className="text-[10px] text-slate-500 font-bold">Ref: {r.momoReference}</p>
                             </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                             <button onClick={() => onApproveRegistration(r.id)} className="flex-1 py-2 bg-emerald-500 text-[#020617] rounded-lg text-[9px] font-black uppercase">Approve Partner</button>
                             <button onClick={() => onRejectRegistration(r.id)} className="flex-1 py-2 bg-rose-500/10 text-rose-500 rounded-lg text-[9px] font-black uppercase">Reject</button>
                          </div>
                      </div>
                  ))}
               </div>
           </div>
       )}

       {/* Receipt Zoom Modal */}
       {viewReceipt && (
           <div className="fixed inset-0 bg-black/98 z-[1000] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in" onClick={() => setViewReceipt(null)}>
               <div className="max-w-xl w-full flex flex-col items-center">
                   <img src={viewReceipt} className="max-h-[80vh] w-auto rounded-3xl shadow-2xl border border-white/10" />
                   <button className="mt-8 px-8 py-3 bg-white text-black font-black uppercase text-xs rounded-full">Close Preview</button>
               </div>
           </div>
       )}

       {activeTab === 'drivers' && (
           <div className="space-y-6">
               <div className="glass p-6 rounded-[2rem] border border-white/10">
                  <h3 className="text-sm font-black text-white uppercase mb-4">Add Partner</h3>
                  
                  <div className="flex items-center gap-4 mb-4 bg-white/5 p-3 rounded-xl border border-white/10">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden relative group shrink-0">
                          {newDriver.avatarUrl ? (
                              <img src={newDriver.avatarUrl} className="w-full h-full object-cover" />
                          ) : (
                              <i className="fas fa-camera text-slate-400"></i>
                          )}
                          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => {
                              if (e.target.files?.[0]) {
                                  const base64 = await compressImage(e.target.files[0], 0.5, 300);
                                  setNewDriver({...newDriver, avatarUrl: base64});
                              }
                          }} />
                      </div>
                      <div>
                          <p className="text-[10px] font-black uppercase text-white">Driver Photo</p>
                          <p className="text-[9px] text-slate-400">Required</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                     <input value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} placeholder="Name" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                     <input value={newDriver.contact} onChange={e => setNewDriver({...newDriver, contact: e.target.value})} placeholder="Phone" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                     <select value={newDriver.vehicleType} onChange={e => setNewDriver({...newDriver, vehicleType: e.target.value})} className="bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-xs font-bold outline-none">
                        <option value="Pragia">Pragia</option>
                        <option value="Taxi">Taxi</option>
                        <option value="Shuttle">Shuttle</option>
                     </select>
                     <input value={newDriver.licensePlate} onChange={e => setNewDriver({...newDriver, licensePlate: e.target.value})} placeholder="Plate" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                     <input value={newDriver.pin} onChange={e => setNewDriver({...newDriver, pin: e.target.value})} placeholder="PIN" className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                  </div>
                  <button onClick={() => { onAddDriver(newDriver); setNewDriver({ name: '', contact: '', vehicleType: 'Pragia', licensePlate: '', pin: '1234', avatarUrl: '' }); }} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[9px] uppercase transition-all">Manually Register Driver</button>
               </div>

               <div className="space-y-2">
                   {drivers.map((d: any) => (
                       <div key={d.id} className="glass p-4 rounded-2xl flex justify-between items-center border border-white/5">
                           <div>
                               <p className="text-sm font-black text-white">{d.name}</p>
                               <p className="text-[10px] text-slate-400 font-bold">{d.vehicleType} • {d.licensePlate}</p>
                           </div>
                           <div className="flex items-center gap-4">
                               <span className={`text-[9px] font-black uppercase ${d.status === 'online' ? 'text-emerald-500' : 'text-slate-500'}`}>{d.status}</span>
                               <button onClick={() => onDeleteDriver(d.id)} className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><i className="fas fa-trash text-xs"></i></button>
                           </div>
                       </div>
                   ))}
               </div>
           </div>
       )}

       {activeTab === 'marketing' && (
           <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
               <div className="flex items-center justify-between">
                   <div>
                       <h3 className="text-xl font-black italic uppercase text-white">Hub Promos (Veo)</h3>
                       <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Generate 1080p Video Content</p>
                   </div>
                   <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                       <i className="fas fa-video"></i>
                   </div>
               </div>
               
               <div className="space-y-4">
                   <textarea 
                     value={videoPrompt} 
                     onChange={(e) => setVideoPrompt(e.target.value)} 
                     placeholder="Describe your promo video (e.g. A futuristic shuttle driving through a busy campus at sunset with neon lights)..." 
                     className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold text-xs outline-none focus:border-purple-500 transition-colors"
                   />
                   <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20 flex gap-3 items-center">
                       <i className="fas fa-info-circle text-purple-400"></i>
                       <p className="text-[9px] text-slate-400">Requires a paid billing project. You will be asked to select an API Key if not already selected.</p>
                   </div>
                   <button 
                     onClick={handleCreatePromo} 
                     disabled={isGeneratingVideo || !videoPrompt}
                     className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-500 transition-all"
                   >
                     {isGeneratingVideo ? 'Generating Video (This takes time)...' : 'Generate Promo Video'}
                   </button>
               </div>
           </div>
       )}

       {activeTab === 'config' && (
           <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
              <div>
                  <h3 className="text-lg font-black italic uppercase text-white">System Config</h3>
                  <p className="text-[10px] text-slate-400 uppercase">Update pricing and contacts</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Pragia Fare (₵)</label>
                      <input type="number" value={localSettings.farePerPragia} onChange={e => setLocalSettings({...localSettings, farePerPragia: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Taxi Fare (₵)</label>
                      <input type="number" value={localSettings.farePerTaxi} onChange={e => setLocalSettings({...localSettings, farePerTaxi: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Comm. Per Seat (₵)</label>
                      <input type="number" value={localSettings.commissionPerSeat} onChange={e => setLocalSettings({...localSettings, commissionPerSeat: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Shuttle Comm. (₵)</label>
                      <input type="number" value={localSettings.shuttleCommission || 0} onChange={e => setLocalSettings({...localSettings, shuttleCommission: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Solo Multiplier</label>
                      <input type="number" step="0.1" value={localSettings.soloMultiplier} onChange={e => setLocalSettings({...localSettings, soloMultiplier: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
              </div>

              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Admin MoMo Name</label>
                  <input value={localSettings.adminMomoName} onChange={e => setLocalSettings({...localSettings, adminMomoName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold mb-2" />
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Admin MoMo Number</label>
                  <input value={localSettings.adminMomo} onChange={e => setLocalSettings({...localSettings, adminMomo: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
              </div>

              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">WhatsApp Support Number</label>
                  <input value={localSettings.whatsappNumber} onChange={e => setLocalSettings({...localSettings, whatsappNumber: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" placeholder="e.g. 23324..." />
              </div>

              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Partner Registration Fee (₵)</label>
                  <input type="number" value={localSettings.registrationFee} onChange={e => setLocalSettings({...localSettings, registrationFee: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
              </div>

              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">System Announcement</label>
                  <textarea value={localSettings.hub_announcement || ''} onChange={e => setLocalSettings({...localSettings, hub_announcement: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs h-20" placeholder="Broadcast message..." />
              </div>
              
              <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">App Logo</label>
                   <div className="flex items-center gap-4">
                       {localSettings.appLogo && <img src={localSettings.appLogo} className="w-12 h-12 object-contain bg-white/10 rounded-lg" />}
                       <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'appLogo')} className="text-[9px] text-slate-400" />
                   </div>
              </div>

              <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">App Wallpaper</label>
                   <div className="flex items-center gap-4">
                       {localSettings.appWallpaper && <img src={localSettings.appWallpaper} className="w-16 h-9 object-cover bg-white/10 rounded-lg border border-white/10" />}
                       <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'appWallpaper')} className="text-[9px] text-slate-400" />
                       {localSettings.appWallpaper && (
                           <button onClick={() => setLocalSettings({...localSettings, appWallpaper: ''})} className="ml-2 text-[9px] font-bold text-rose-500 uppercase hover:text-white">Clear</button>
                       )}
                   </div>
              </div>

              <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">About Me Text</label>
                   <textarea value={localSettings.aboutMeText || ''} onChange={e => setLocalSettings({...localSettings, aboutMeText: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs h-24" />
              </div>

              <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">Portfolio Images</label>
                   <div className="flex gap-2 overflow-x-auto pb-2">
                       {localSettings.aboutMeImages?.map((img: string, i: number) => (
                           <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 group">
                               <img src={img} className="w-full h-full object-cover" />
                               <button onClick={() => setLocalSettings({...localSettings, aboutMeImages: localSettings.aboutMeImages.filter((_:any, idx:number) => idx !== i)})} className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"><i className="fas fa-trash"></i></button>
                           </div>
                       ))}
                       <label className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10">
                           <i className="fas fa-plus text-slate-500"></i>
                           <input type="file" multiple accept="image/*" className="hidden" onChange={handlePortfolioUpload} />
                       </label>
                   </div>
              </div>
              
              <div>
                  <h4 className="text-xs font-black uppercase text-white mb-4">Social Media Handles</h4>
                  <div className="space-y-3">
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Facebook URL</label>
                          <input value={localSettings.facebookUrl || ''} onChange={e => setLocalSettings({...localSettings, facebookUrl: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="https://facebook.com/..." />
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Instagram URL</label>
                          <input value={localSettings.instagramUrl || ''} onChange={e => setLocalSettings({...localSettings, instagramUrl: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="https://instagram.com/..." />
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">TikTok URL</label>
                          <input value={localSettings.tiktokUrl || ''} onChange={e => setLocalSettings({...localSettings, tiktokUrl: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="https://tiktok.com/@..." />
                      </div>
                  </div>
              </div>

              <div>
                  <h4 className="text-xs font-black uppercase text-white mb-4">AdSense Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">AdSense Status</label>
                          <select value={localSettings.adSenseStatus || 'inactive'} onChange={e => setLocalSettings({...localSettings, adSenseStatus: e.target.value as any})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs">
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Client ID (ca-pub-...)</label>
                          <input value={localSettings.adSenseClientId || ''} onChange={e => setLocalSettings({...localSettings, adSenseClientId: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" />
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Slot ID</label>
                          <input value={localSettings.adSenseSlotId || ''} onChange={e => setLocalSettings({...localSettings, adSenseSlotId: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" />
                      </div>
                      <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Layout Key</label>
                          <input value={localSettings.adSenseLayoutKey || ''} onChange={e => setLocalSettings({...localSettings, adSenseLayoutKey: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" />
                      </div>
                  </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <h4 className="text-xs font-black uppercase text-white mb-4">Admin Security</h4>
                <div className="space-y-3">
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Update Email</label>
                        <input value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="New Admin Email" />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Update Password</label>
                        <input type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs" placeholder="New Strong Password" />
                    </div>
                    <button onClick={handleUpdateCredentials} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-[9px] uppercase transition-all">Update Credentials</button>
                </div>
              </div>

              <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 mt-4">
                  {isSaving ? 'Saving Changes...' : 'Update Configuration'}
              </button>
           </div>
       )}

       {activeTab === 'missions' && (
           <div className="space-y-6">
              <div className="glass p-6 rounded-[2rem] border border-white/10">
                  <h3 className="text-sm font-black text-white uppercase mb-4">Create Hotspot</h3>
                  <div className="space-y-3">
                      <input value={newMission.location} onChange={e => setNewMission({...newMission, location: e.target.value})} placeholder="Location Name" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                      <input value={newMission.description} onChange={e => setNewMission({...newMission, description: e.target.value})} placeholder="Description" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                      <input type="number" value={newMission.entryFee} onChange={e => setNewMission({...newMission, entryFee: parseFloat(e.target.value)})} placeholder="Entry Fee" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold outline-none" />
                      <button onClick={() => { 
                         onCreateMission({ ...newMission, id: `MSN-${Date.now()}`, driversJoined: [], status: 'open', createdAt: new Date().toISOString() }); 
                         setNewMission({ location: '', description: '', entryFee: 5 }); 
                      }} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-[9px] uppercase transition-all">Deploy Mission</button>
                  </div>
              </div>
              <div className="space-y-2">
                 {missions.map((m: any) => (
                    <div key={m.id} className="glass p-4 rounded-2xl flex justify-between items-center border border-white/5">
                        <div>
                           <p className="text-sm font-black text-white">{m.location}</p>
                           <p className="text-[10px] text-slate-400">{m.driversJoined.length} Drivers Stationed • Fee: ₵{m.entryFee}</p>
                        </div>
                        <button onClick={() => onDeleteMission(m.id)} className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><i className="fas fa-trash text-xs"></i></button>
                    </div>
                 ))}
              </div>
           </div>
       )}
       
       {activeTab === 'rides' && (
           <div className="space-y-4">
              {nodes.length === 0 && <p className="text-center text-slate-600 text-xs py-4">No rides in system.</p>}
              {nodes.map((n: any) => (
                  <div key={n.id} className="glass p-4 rounded-2xl border border-white/5 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-2">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${n.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>{n.status}</span>
                                  <span className="text-[8px] font-bold text-slate-500 uppercase">{n.id}</span>
                              </div>
                              <p className="text-sm font-black text-white">{n.destination}</p>
                              <p className="text-[10px] text-slate-400">From: {n.origin}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-sm font-black text-white">₵ {n.farePerPerson}</p>
                              <p className="text-[9px] text-slate-500">{n.passengers.length} Pax</p>
                          </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                          {n.status !== 'completed' && (
                             <>
                               <button onClick={() => onCancelRide(n.id)} className="flex-1 py-2 bg-rose-500/10 text-rose-500 rounded-lg text-[9px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all">Cancel</button>
                               <button onClick={() => onSettleRide(n.id)} className="flex-1 py-2 bg-emerald-500/10 text-emerald-500 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all">Settle</button>
                             </>
                          )}
                      </div>
                  </div>
              ))}
           </div>
       )}
    </div>
  );
};
