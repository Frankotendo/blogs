
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { compressImage } from '../utils';
import { Driver, AppSettings, RideNode, Transaction, HubMission, TopupRequest, RegistrationRequest } from '../types';

export const AdminLogin = ({ onLogin }: any) => {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  return (
    <div className="max-w-sm mx-auto glass p-8 rounded-[2.5rem] border border-white/10 text-center space-y-6 animate-in zoom-in">
       <div className="w-16 h-16 bg-rose-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl">
          <i className="fas fa-shield-halved text-2xl"></i>
       </div>
       <div>
          <h2 className="text-xl font-black italic uppercase text-white">Restricted Access</h2>
          <p className="text-[10px] font-black text-rose-500 uppercase mt-1">Admin Credentials Required</p>
       </div>
       <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none focus:border-rose-500" />
       <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Password" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none focus:border-rose-500" />
       <button onClick={() => onLogin(email, pass)} className="w-full py-4 bg-rose-600 text-white rounded-xl font-black text-xs uppercase shadow-xl">Authenticate</button>
    </div>
  );
};

interface AdminPortalProps {
  activeTab: string;
  setActiveTab: (v: string) => void;
  nodes: RideNode[];
  drivers: Driver[];
  missions: HubMission[];
  transactions: Transaction[];
  topupRequests: TopupRequest[];
  registrationRequests: RegistrationRequest[];
  onLock: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  hubRevenue: number;
  adminEmail: string;
  onApproveTopup?: (id: string, did: string, amt: number) => void;
  onRejectTopup?: (id: string) => void;
  onApproveRegistration?: (req: RegistrationRequest) => void;
  onRejectRegistration?: (id: string) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ 
  activeTab, 
  setActiveTab, 
  nodes, 
  drivers, 
  missions, 
  transactions, 
  topupRequests,
  registrationRequests,
  onLock, 
  settings, 
  onUpdateSettings, 
  hubRevenue, 
  adminEmail,
  onApproveTopup,
  onRejectTopup,
  onApproveRegistration,
  onRejectRegistration
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [pulseAnalysis, setPulseAnalysis] = useState<any>(null);
  const [isAnalyzingPulse, setIsAnalyzingPulse] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

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

  const handlePulseAnalysis = async () => {
      setIsAnalyzingPulse(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const activeRides = nodes.filter(n => n.status !== 'completed').length;
          const onlineDrivers = drivers.filter(d => d.status === 'online').length;
          
          const prompt = `Analyze NexRyde Market (Uni Campus Logistics): 
          - Online Drivers: ${onlineDrivers}
          - Active Pool Requests: ${activeRides}
          - Current Pricing: Pragia ₵${settings.farePerPragia}, Taxi ₵${settings.farePerTaxi}. 
          
          Recommend strategy (Surge/Quiet) for pricing and supply management. 
          Return ONLY JSON: {"status": "string", "reason": "string", "suggestedAction": "string", "demandScore": number (0-100)}`;
          
          const response = await ai.models.generateContent({
             model: 'gemini-3-pro-preview',
             contents: prompt,
             config: { 
                 responseMimeType: 'application/json',
                 thinkingConfig: { thinkingBudget: 0 }
             }
          });
          setPulseAnalysis(JSON.parse(response.text || '{}'));
      } catch (e) { 
          console.error("AI Analysis Error:", e); 
      } finally { 
          setIsAnalyzingPulse(false); 
      }
  };

  const handleCreateVideo = async () => {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
      }
      setIsGeneratingVideo(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          let op = await ai.models.generateVideos({
              model: 'veo-3.1-fast-generate-preview',
              prompt: `A high-end cinematic advertisement for NexRyde campus logistics: ${videoPrompt}`,
              config: { resolution: '1080p', aspectRatio: '16:9' }
          });
          while (!op.done) {
              await new Promise(r => setTimeout(r, 10000));
              op = await ai.operations.getVideosOperation({operation: op});
          }
          if (op.response?.generatedVideos?.[0]?.video?.uri) {
              window.open(`${op.response.generatedVideos[0].video.uri}&key=${process.env.API_KEY}`, '_blank');
          }
      } catch (e) { console.error("Video Gen Error:", e); } finally { setIsGeneratingVideo(false); }
  };

  return (
    <div className="space-y-6">
       <div className="glass p-6 rounded-[2.5rem] border border-white/10 flex justify-between items-center bg-rose-900/10">
          <div>
             <h2 className="text-xl font-black italic uppercase text-white">Admin Vault</h2>
             <p className="text-[10px] font-black text-rose-500 uppercase">{adminEmail}</p>
          </div>
          <button onClick={onLock} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500"><i className="fas fa-lock"></i></button>
       </div>

       <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
          {['monitor', 'requests', 'marketing', 'config'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[100px] px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest ${activeTab === tab ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>{tab}</button>
          ))}
       </div>

       {activeTab === 'monitor' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass p-6 rounded-[2rem] border border-white/5 text-center bg-gradient-to-b from-white/5 to-transparent">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Rev</p>
                    <p className="text-xl font-black text-white">₵{hubRevenue.toFixed(2)}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5 text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Fleet</p>
                    <p className="text-xl font-black text-emerald-400">{drivers.length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5 text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Requests</p>
                    <p className="text-xl font-black text-amber-500">{registrationRequests.filter(r => r.status === 'pending').length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5 text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Live Nodes</p>
                    <p className="text-xl font-black text-indigo-400">{nodes.filter(n => n.status !== 'completed').length}</p>
                </div>
             </div>
             
             <div className="glass p-8 rounded-[2.5rem] border border-white/10 text-center space-y-4">
                <h3 className="text-sm font-black text-white uppercase flex items-center justify-center gap-2"><i className="fas fa-brain text-indigo-400"></i> Market Pulse AI</h3>
                <button onClick={handlePulseAnalysis} disabled={isAnalyzingPulse} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg disabled:opacity-50">
                    {isAnalyzingPulse ? 'Simulating Market...' : 'Run Diagnostics'}
                </button>
                {pulseAnalysis && (
                   <div className="bg-white/5 p-4 rounded-2xl text-left animate-in slide-in-from-bottom-2 border border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-black text-indigo-400 uppercase">{pulseAnalysis.status} Conditions</p>
                        <span className="text-[10px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded">{pulseAnalysis.demandScore}% Intensity</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-2 leading-relaxed">{pulseAnalysis.reason}</p>
                      <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Recommended Action</p>
                        <p className="text-[11px] text-white font-medium">{pulseAnalysis.suggestedAction}</p>
                      </div>
                   </div>
                )}
             </div>
          </div>
       )}

       {activeTab === 'requests' && (
          <div className="space-y-6 animate-in fade-in">
             <div className="space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Partner Registrations</h3>
                {registrationRequests.filter(r => r.status === 'pending').length === 0 && <p className="text-center text-slate-600 py-8 text-[10px] font-black uppercase">No pending registrations.</p>}
                {registrationRequests.filter(r => r.status === 'pending').map(req => (
                   <div key={req.id} className="glass p-5 rounded-[2rem] border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                         {req.avatarUrl ? <img src={req.avatarUrl} className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white text-lg font-black">{req.name[0]}</div>}
                         <div>
                            <p className="text-sm font-black text-white">{req.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase">{req.vehicleType} • {req.licensePlate}</p>
                            <p className="text-[9px] text-emerald-400 font-bold">Ref: {req.momoReference}</p>
                         </div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => onApproveRegistration?.(req)} className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:scale-105 transition-transform"><i className="fas fa-check"></i></button>
                         <button onClick={() => onRejectRegistration?.(req.id)} className="w-10 h-10 bg-rose-500/20 text-rose-500 rounded-xl flex items-center justify-center hover:scale-105 transition-transform"><i className="fas fa-times"></i></button>
                      </div>
                   </div>
                ))}
             </div>

             <div className="space-y-4 pt-4 border-t border-white/5">
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest px-2">Topup Credits</h3>
                {topupRequests.filter(r => r.status === 'pending').length === 0 && <p className="text-center text-slate-600 py-8 text-[10px] font-black uppercase">No pending topups.</p>}
                {topupRequests.filter(r => r.status === 'pending').map(req => (
                   <div key={req.id} className="glass p-5 rounded-[2rem] border border-white/10 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-white">₵ {req.amount}</p>
                        <p className="text-[10px] text-slate-400">Driver ID: {req.driverId}</p>
                        <p className="text-[9px] text-indigo-400 font-bold">MoMo: {req.momoReference}</p>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => onApproveTopup?.(req.id, req.driverId, req.amount)} className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:scale-105 transition-transform"><i className="fas fa-check"></i></button>
                         <button onClick={() => onRejectTopup?.(req.id)} className="w-10 h-10 bg-rose-500/20 text-rose-500 rounded-xl flex items-center justify-center hover:scale-105 transition-transform"><i className="fas fa-times"></i></button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
       )}

       {activeTab === 'marketing' && (
          <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
              <h3 className="text-lg font-black uppercase text-white flex items-center gap-2"><i className="fas fa-video text-indigo-500"></i> AI Video Ad Engine</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Describe your promo vision below (Veo 3.1 Fast)</p>
              <textarea value={videoPrompt} onChange={e => setVideoPrompt(e.target.value)} placeholder="e.g. A sleek campus shuttle gliding through a high-tech university park at sunset with vibrant purple lighting..." className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-xs h-32 outline-none focus:border-indigo-500 transition-all" />
              <button onClick={handleCreateVideo} disabled={isGeneratingVideo || !videoPrompt} className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-900/40 disabled:opacity-50 hover:scale-[1.01] transition-transform">
                {isGeneratingVideo ? 'Directing Scene...' : 'Generate Veo Promo'}
              </button>
              {isGeneratingVideo && <p className="text-[9px] text-center text-slate-500 italic">This usually takes about 60-90 seconds. Keep tab open.</p>}
          </div>
       )}

       {activeTab === 'config' && (
          <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-8 animate-in fade-in">
             <div className="flex justify-between items-center">
                <h3 className="text-lg font-black uppercase text-white">Hub Controller</h3>
                <button onClick={handleSaveSettings} disabled={isSaving} className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg disabled:opacity-50 hover:bg-emerald-500 transition-colors">
                  {isSaving ? 'Syncing...' : 'Save All Changes'}
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

             <div className="space-y-6 border-t border-white/5 pt-6">
                <h4 className="text-xs font-black text-white uppercase flex items-center gap-2"><i className="fas fa-palette text-rose-500"></i> Visual Identity & Theme</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">Global App Wallpaper</label>
                      <div className="mt-2 flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        {localSettings.appWallpaper ? <img src={localSettings.appWallpaper} className="w-16 h-16 rounded-lg object-cover" /> : <div className="w-16 h-16 bg-white/10 rounded-lg flex items-center justify-center text-slate-600"><i className="fas fa-image"></i></div>}
                        <input type="file" onChange={e => handleImageUpload(e, 'appWallpaper')} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-white/10 file:text-white" />
                      </div>
                   </div>
                   <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">App Icon / Logo</label>
                      <div className="mt-2 flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                        {localSettings.appLogo ? <img src={localSettings.appLogo} className="w-12 h-12 object-contain" /> : <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center text-slate-600"><i className="fas fa-circle-dot"></i></div>}
                        <input type="file" onChange={e => handleImageUpload(e, 'appLogo')} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-white/10 file:text-white" />
                      </div>
                   </div>
                </div>
                <div>
                   <label className="text-[9px] font-bold text-slate-500 uppercase ml-2">About Us Showcase Gallery</label>
                   <div className="mt-2 flex gap-4 overflow-x-auto no-scrollbar py-2">
                      {localSettings.aboutMeImages?.map((img, i) => (
                         <div key={i} className="relative shrink-0 group">
                            <img src={img} className="w-24 h-24 rounded-2xl object-cover border border-white/10 shadow-xl" />
                            <button onClick={() => setLocalSettings(prev => ({...prev, aboutMeImages: prev.aboutMeImages.filter((_, idx) => idx !== i)}))} className="absolute -top-2 -right-2 w-6 h-6 bg-rose-600 rounded-full text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><i className="fas fa-times"></i></button>
                         </div>
                      ))}
                      <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all shrink-0 hover:border-rose-500/50">
                         <i className="fas fa-plus text-slate-600 mb-1"></i>
                         <span className="text-[8px] font-black uppercase text-slate-700">Add Slide</span>
                         <input type="file" multiple accept="image/*" onChange={handlePortfolioUpload} className="hidden" />
                      </label>
                   </div>
                </div>
             </div>
             
             <div className="border-t border-white/5 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <h4 className="text-xs font-black text-white uppercase flex items-center gap-2 mb-4"><i className="fas fa-bullhorn text-amber-500"></i> Global Broadcast</h4>
                   <textarea value={localSettings.hub_announcement} onChange={e => setLocalSettings({...localSettings, hub_announcement: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-xs h-24 outline-none focus:border-amber-500 transition-all" placeholder="Message will appear at the top of all user screens..." />
                </div>
                <div>
                   <h4 className="text-xs font-black text-white uppercase flex items-center gap-2 mb-4"><i className="fas fa-money-bill-transfer text-emerald-500"></i> Financial Details</h4>
                   <div className="space-y-3">
                      <input value={localSettings.adminMomo} onChange={e => setLocalSettings({...localSettings, adminMomo: e.target.value})} placeholder="MoMo Number" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none" />
                      <input value={localSettings.adminMomoName} onChange={e => setLocalSettings({...localSettings, adminMomoName: e.target.value})} placeholder="MoMo Account Name" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none" />
                   </div>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};
