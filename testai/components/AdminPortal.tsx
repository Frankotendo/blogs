
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { compressImage, supabase } from '../utils';
import { HubMission, Driver } from '../types';

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
  adminEmail 
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
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Total Revenue</p>
                    <p className="text-2xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Active Drivers</p>
                    <p className="text-2xl font-black text-emerald-400">{drivers.filter((d:any) => d.status === 'online').length} / {drivers.length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Active Rides</p>
                    <p className="text-2xl font-black text-amber-500">{nodes.filter((n:any) => n.status !== 'completed').length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Pending Regs</p>
                    <p className="text-2xl font-black text-indigo-400">{registrationRequests.filter((r:any) => r.status === 'pending').length}</p>
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

       {activeTab === 'config' && (
           <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-8">
              <div>
                  <h3 className="text-lg font-black italic uppercase text-white">System Config</h3>
                  <p className="text-[10px] text-slate-400 uppercase">Update pricing, contacts, and branding</p>
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
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Solo Multiplier (x)</label>
                      <input type="number" value={localSettings.soloMultiplier} onChange={e => setLocalSettings({...localSettings, soloMultiplier: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Seat Commission (₵)</label>
                      <input type="number" value={localSettings.commissionPerSeat} onChange={e => setLocalSettings({...localSettings, commissionPerSeat: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                 <h4 className="text-sm font-black text-white uppercase">Brand & Portfolio</h4>
                 
                 <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase">App Logo</label>
                    <div className="flex items-center gap-4 mt-2">
                       {localSettings.appLogo && <img src={localSettings.appLogo} className="w-12 h-12 rounded-lg object-contain bg-white/5" />}
                       <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'appLogo')} className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-white/10 file:text-white hover:file:bg-white/20" />
                    </div>
                 </div>

                 <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase">About Me / Portfolio Images</label>
                    <p className="text-[9px] text-slate-600 mb-2">Upload images to showcase in the passenger "About" section.</p>
                    <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
                       {localSettings.aboutMeImages?.map((img, i) => (
                           <div key={i} className="relative shrink-0 group">
                              <img src={img} className="w-20 h-20 rounded-xl object-cover border border-white/10" />
                              <button onClick={() => setLocalSettings({...localSettings, aboutMeImages: localSettings.aboutMeImages.filter((_, idx) => idx !== i)})} className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-times"></i></button>
                           </div>
                       ))}
                       <label className="w-20 h-20 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-white/30 transition-all shrink-0">
                          <i className="fas fa-plus text-slate-500"></i>
                          <input type="file" multiple accept="image/*" onChange={handlePortfolioUpload} className="hidden" />
                       </label>
                    </div>
                 </div>
                 
                 <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase">Welcome Message / Announcement</label>
                    <textarea value={localSettings.hub_announcement} onChange={e => setLocalSettings({...localSettings, hub_announcement: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs mt-2 h-20" placeholder="Broadcast message to all users..." />
                 </div>
              </div>

              <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 hover:bg-emerald-500 transition-all">
                  {isSaving ? 'Saving Changes...' : 'Save Configuration'}
              </button>
           </div>
       )}
    </div>
  );
};
