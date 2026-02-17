
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { compressImage, supabase } from '../utils';
import { HubMission, Driver, AppSettings } from '../types';

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
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  
  // Marketing / Veo
  const [videoPrompt, setVideoPrompt] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  // Pulse
  const [pulseAnalysis, setPulseAnalysis] = useState<any>(null);
  const [isAnalyzingPulse, setIsAnalyzingPulse] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSaveSettings = async () => {
      setIsSaving(true);
      try {
        await onUpdateSettings(localSettings);
      } finally {
        setIsSaving(false);
      }
  };

  const handleImageUpload = async (e: any, field: keyof AppSettings) => {
      const file = e.target.files[0];
      if(file) {
          const base64 = await compressImage(file, 0.7, 1200);
          setLocalSettings(prev => ({...prev, [field]: base64}));
      }
  };
  
  const handlePortfolioUpload = async (e: any) => {
      const files = Array.from(e.target.files);
      const newImages = await Promise.all(files.map((f: any) => compressImage(f, 0.6, 800)));
      setLocalSettings(prev => ({...prev, aboutMeImages: [...(prev.aboutMeImages || []), ...newImages]}));
  };

  const handleCreatePromo = async () => {
      if (!videoPrompt) return;
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
          // Procedurally continue assuming key selection was triggered
      }

      setIsGeneratingVideo(true);
      try {
          const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
          let operation = await videoAi.models.generateVideos({
              model: 'veo-3.1-fast-generate-preview',
              prompt: `A high-end cinematic advertisement for NexRyde campus logistics: ${videoPrompt}. Vibrant colors, neon accents, fast-paced transitions.`,
              config: {
                 numberOfVideos: 1,
                 resolution: '1080p',
                 aspectRatio: '16:9'
              }
          });
          
          while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await videoAi.operations.getVideosOperation({operation: operation});
          }

          const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (uri) {
              const videoUrl = `${uri}&key=${process.env.API_KEY}`;
              window.open(videoUrl, '_blank');
              setVideoPrompt('');
              alert("Promo Video Generated Successfully!");
          }
      } catch (err: any) {
          console.error("Video Gen Error", err);
          if (err.message.includes("Requested entity was not found")) {
             alert("API Key Issue. Please select a paid project API key.");
             await (window as any).aistudio.openSelectKey();
          } else {
             alert("Video generation failed: " + err.message);
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
            Analyze these ride-sharing stats for NexRyde Hub:
            - Active Rides in System: ${activeRides}
            - Online Partners: ${onlineDrivers}
            - Current Hour: ${hour}:00
            - Pricing Config: Pragia (₵${settings.farePerPragia}), Taxi (₵${settings.farePerTaxi}).
            - Multiplier: ${settings.soloMultiplier}x.

            Provide strategic insight. Return JSON only:
            {
              "status": "Surge" | "Normal" | "Quiet",
              "reason": "text",
              "suggestedAction": "text",
              "demandScore": 1-100
            }
          `;
          
          const pulseAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await pulseAi.models.generateContent({
             model: 'gemini-3-pro-preview',
             contents: prompt,
             config: { 
                 responseMimeType: 'application/json',
                 thinkingConfig: { thinkingBudget: 0 }
             }
          });
          
          const json = JSON.parse(response.text || '{}');
          setPulseAnalysis(json);
      } catch (e) {
          console.error("Pulse Analysis Failed", e);
      } finally {
          setIsAnalyzingPulse(false);
      }
  };

  return (
    <div className="space-y-6">
       <div className="glass p-6 rounded-[2.5rem] border border-white/10 flex justify-between items-center bg-gradient-to-r from-rose-900/10 to-transparent">
          <div>
             <h2 className="text-xl font-black italic uppercase text-white">Command Vault</h2>
             <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Active Admin: {adminEmail}</p>
          </div>
          <button onClick={onLock} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-white/10 transition-all">
             <i className="fas fa-lock"></i>
          </button>
       </div>

       <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
          {['monitor', 'drivers', 'finance', 'missions', 'marketing', 'config'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                 {tab}
              </button>
          ))}
       </div>

       {activeTab === 'monitor' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Hub Revenue</p>
                    <p className="text-2xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Live Fleet</p>
                    <p className="text-2xl font-black text-emerald-400">{drivers.filter((d:any) => d.status === 'online').length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Global Queue</p>
                    <p className="text-2xl font-black text-amber-500">{nodes.filter((n:any) => n.status !== 'completed').length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Waitlist</p>
                    <p className="text-2xl font-black text-indigo-400">{registrationRequests.filter((r:any) => r.status === 'pending').length}</p>
                </div>
             </div>

             <div className="glass p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <i className="fas fa-brain text-8xl text-indigo-400"></i>
                </div>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">AI Market Analysis</h3>
                        <p className="text-[10px] text-slate-400">Powered by Gemini 3 Pro</p>
                    </div>
                    <button onClick={handlePulseAnalysis} disabled={isAnalyzingPulse} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-50 shadow-lg shadow-indigo-900/40">
                        {isAnalyzingPulse ? 'Processing...' : 'Run Diagnostics'}
                    </button>
                </div>
                {pulseAnalysis ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-bottom-2">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                               <div className={`w-3 h-3 rounded-full ${pulseAnalysis.status === 'Surge' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                               <span className="text-sm font-black text-white uppercase">{pulseAnalysis.status} Conditions</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">{pulseAnalysis.reason}</p>
                        </div>
                        <div className="bg-indigo-600/10 p-4 rounded-2xl border border-indigo-500/20">
                            <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1">Strategic Advice</p>
                            <p className="text-xs text-white font-medium">{pulseAnalysis.suggestedAction}</p>
                            <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{ width: `${pulseAnalysis.demandScore}%` }}></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center">
                        <i className="fas fa-chart-line text-3xl text-slate-700 mb-2"></i>
                        <p className="text-[10px] font-bold text-slate-600 uppercase">Awaiting Data Analysis</p>
                    </div>
                )}
             </div>
          </div>
       )}

       {activeTab === 'marketing' && (
           <div className="space-y-6 animate-in fade-in">
                <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white">
                            <i className="fas fa-video"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-black italic uppercase text-white">AI Promo Engine</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Generate high-quality video ads</p>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-2">Promo Concept</label>
                        <textarea 
                            value={videoPrompt} 
                            onChange={e => setVideoPrompt(e.target.value)}
                            placeholder="e.g. A futuristic shuttle gliding through a high-tech university campus at sunset, happy students boarding..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-xs h-32 focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>

                    <button 
                        onClick={handleCreatePromo} 
                        disabled={isGeneratingVideo || !videoPrompt}
                        className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-900/40 disabled:opacity-50 hover:scale-[1.01] transition-transform"
                    >
                        {isGeneratingVideo ? 'Directing Scene...' : 'Generate Cinematic Ad'}
                    </button>
                    
                    {isGeneratingVideo && (
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center space-y-2">
                            <p className="text-[10px] font-black text-indigo-400 uppercase animate-pulse">Veo 3.1 Fast AI Generating...</p>
                            <p className="text-[9px] text-slate-500 italic">This usually takes about 60-90 seconds. Please keep this tab open.</p>
                        </div>
                    )}
                </div>
           </div>
       )}

       {activeTab === 'config' && (
           <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-8 animate-in fade-in">
              <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-lg font-black italic uppercase text-white">System Settings</h3>
                    <p className="text-[10px] text-slate-400 uppercase">Core pricing and branding assets</p>
                </div>
                <button onClick={handleSaveSettings} disabled={isSaving} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg disabled:opacity-50">
                  {isSaving ? 'Syncing...' : 'Push Changes'}
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Pragia Base (₵)</label>
                      <input type="number" value={localSettings.farePerPragia} onChange={e => setLocalSettings({...localSettings, farePerPragia: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-black outline-none focus:border-emerald-500" />
                  </div>
                  <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Taxi Base (₵)</label>
                      <input type="number" value={localSettings.farePerTaxi} onChange={e => setLocalSettings({...localSettings, farePerTaxi: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-black outline-none focus:border-emerald-500" />
                  </div>
                  <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Solo Multiplier</label>
                      <input type="number" step="0.1" value={localSettings.soloMultiplier} onChange={e => setLocalSettings({...localSettings, soloMultiplier: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-black outline-none focus:border-emerald-500" />
                  </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-white/5">
                 <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-palette text-rose-500"></i> Visual Branding
                 </h4>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">App Logo</label>
                        <div className="mt-2 flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                            {localSettings.appLogo ? <img src={localSettings.appLogo} className="w-16 h-16 object-contain" /> : <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center text-slate-600"><i className="fas fa-image"></i></div>}
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'appLogo')} className="text-[9px] text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-white/10 file:text-white" />
                        </div>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">App Wallpaper</label>
                        <div className="mt-2 flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                            {localSettings.appWallpaper ? <img src={localSettings.appWallpaper} className="w-16 h-16 object-cover rounded-lg" /> : <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center text-slate-600"><i className="fas fa-image"></i></div>}
                            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'appWallpaper')} className="text-[9px] text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[9px] file:font-black file:uppercase file:bg-white/10 file:text-white" />
                        </div>
                    </div>
                 </div>

                 <div>
                    <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Portfolio Gallery (Showcase)</label>
                    <div className="mt-2 flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
                       {localSettings.aboutMeImages?.map((img, i) => (
                           <div key={i} className="relative shrink-0 group">
                              <img src={img} className="w-24 h-24 rounded-2xl object-cover border border-white/10 shadow-lg" />
                              <button onClick={() => setLocalSettings(prev => ({...prev, aboutMeImages: prev.aboutMeImages.filter((_, idx) => idx !== i)}))} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-600 rounded-full flex items-center justify-center text-white text-[10px] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-times"></i></button>
                           </div>
                       ))}
                       <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500/50 hover:bg-white/5 transition-all shrink-0">
                          <i className="fas fa-plus text-slate-500 mb-1"></i>
                          <span className="text-[8px] font-black uppercase text-slate-600">Add</span>
                          <input type="file" multiple accept="image/*" onChange={handlePortfolioUpload} className="hidden" />
                       </label>
                    </div>
                 </div>
              </div>

              <div className="pt-6 border-t border-white/5 space-y-4">
                 <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-bullhorn text-amber-500"></i> Global Broadcast
                 </h4>
                 <textarea 
                    value={localSettings.hub_announcement} 
                    onChange={e => setLocalSettings({...localSettings, hub_announcement: e.target.value})} 
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-xs h-24 outline-none focus:border-amber-500 transition-all" 
                    placeholder="Message will appear at the top of all user screens..." 
                 />
              </div>

              <div className="pt-6 border-t border-white/5 space-y-4">
                 <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <i className="fas fa-wallet text-emerald-500"></i> Financial Contacts
                 </h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Admin MoMo Number</label>
                        <input value={localSettings.adminMomo} onChange={e => setLocalSettings({...localSettings, adminMomo: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-black outline-none" />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">MoMo Display Name</label>
                        <input value={localSettings.adminMomoName} onChange={e => setLocalSettings({...localSettings, adminMomoName: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-black outline-none" />
                    </div>
                 </div>
              </div>
           </div>
       )}
    </div>
  );
};
