
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
  activeTab, setActiveTab, nodes, drivers, onAddDriver, onDeleteDriver, onCancelRide, onSettleRide, missions, onCreateMission, onDeleteMission, transactions, topupRequests, registrationRequests, onApproveTopup, onRejectTopup, onApproveRegistration, onRejectRegistration, onLock, settings, onUpdateSettings, hubRevenue, adminEmail, onManualCredit, pendingRequestsCount
}: any) => {
  const [newMission, setNewMission] = useState({ location: '', description: '', entryFee: 5 });
  const [newDriver, setNewDriver] = useState({ name: '', contact: '', vehicleType: 'Pragia', licensePlate: '', pin: '1234', avatarUrl: '' });
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);
  
  // Marketing AI (Image Gen instead of Video for simplicity/speed)
  const [promoPrompt, setPromoPrompt] = useState('');
  const [isGeneratingPromo, setIsGeneratingPromo] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  // Pulse AI (Flash model for speed)
  const [pulseAnalysis, setPulseAnalysis] = useState<any>(null);
  const [isAnalyzingPulse, setIsAnalyzingPulse] = useState(false);

  const [manualCreditData, setManualCreditData] = useState({ identifier: '', amount: 0 });
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);

  useEffect(() => { setLocalSettings(settings); }, [settings]);

  const handleSaveSettings = async () => {
      setIsSaving(true);
      await onUpdateSettings(localSettings);
      setIsSaving(false);
  };

  const handleCreatePromo = async () => {
      if (!promoPrompt) return;
      setIsGeneratingPromo(true);
      try {
          const promoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await promoAi.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: `Digital marketing banner for NexRyde campus app: ${promoPrompt}` }] },
              config: { imageConfig: { aspectRatio: "16:9" } }
          });
          
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              setGeneratedImage(`data:image/png;base64,${part.inlineData.data}`);
              break;
            }
          }
      } catch (err) {
          console.error(err);
          alert("Generation failed. Check prompt safety.");
      } finally {
          setIsGeneratingPromo(false);
      }
  };

  const handlePulseAnalysis = async () => {
      setIsAnalyzingPulse(true);
      try {
          const stats = `Active: ${nodes.length}, Online: ${drivers.filter((d:any)=>d.status==='online').length}`;
          const prompt = `Analyze: ${stats}. Current Pragia Fare: ₵${settings.farePerPragia}. Output JSON: {status:string, reason:string, suggestedAction:string}`;
          
          const pulseAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await pulseAi.models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: prompt,
             config: { responseMimeType: 'application/json' }
          });
          setPulseAnalysis(JSON.parse(response.text || '{}'));
      } catch (e) { console.error(e); } finally { setIsAnalyzingPulse(false); }
  };

  return (
    <div className="space-y-6">
       <div className="glass p-6 rounded-[2.5rem] border border-white/10 flex justify-between items-center">
          <div>
             <h2 className="text-xl font-black italic uppercase text-white">Command Center</h2>
             <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">{adminEmail}</p>
          </div>
          <button onClick={onLock} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 transition-all"><i className="fas fa-lock"></i></button>
       </div>

       <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
          {['monitor', 'drivers', 'rides', 'finance', 'missions', 'marketing', 'config'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[80px] px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-white'}`}>{tab}</button>
          ))}
       </div>

       {activeTab === 'monitor' && (
          <div className="space-y-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass p-6 rounded-[2rem] border border-rose-500/20 bg-rose-900/5">
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-2">Revenue</p>
                    <p className="text-2xl font-black text-white">₵ {hubRevenue.toFixed(2)}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Partners</p>
                    <p className="text-2xl font-black text-emerald-400">{drivers.filter((d:any) => d.status === 'online').length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Ongoing</p>
                    <p className="text-2xl font-black text-amber-500">{nodes.filter((n:any) => n.status !== 'completed').length}</p>
                </div>
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Pending Tasks</p>
                    <p className="text-2xl font-black text-indigo-400">{pendingRequestsCount}</p>
                </div>
             </div>
             <div className="glass p-8 rounded-[2rem] border border-white/10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-black text-white uppercase">Market Pulse (AI)</h3>
                    <button onClick={handlePulseAnalysis} disabled={isAnalyzingPulse} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-50">{isAnalyzingPulse ? 'Processing...' : 'Analyze Network'}</button>
                </div>
                {pulseAnalysis && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 animate-in fade-in">
                        <p className="text-sm font-black text-white uppercase mb-1">{pulseAnalysis.status}</p>
                        <p className="text-xs text-slate-300 mb-2">{pulseAnalysis.reason}</p>
                        <p className="text-[10px] text-indigo-400 font-bold uppercase">Idea: {pulseAnalysis.suggestedAction}</p>
                    </div>
                )}
             </div>
          </div>
       )}

       {activeTab === 'finance' && (
           <div className="space-y-6">
               <div className="glass p-6 rounded-[2rem] border border-white/10">
                   <h3 className="text-sm font-black text-white uppercase mb-4">Manual Credit</h3>
                   <div className="flex gap-2">
                       <input value={manualCreditData.identifier} onChange={e => setManualCreditData({...manualCreditData, identifier: e.target.value})} placeholder="Phone Number" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none" />
                       <input type="number" placeholder="₵" className="w-24 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none" onChange={e => setManualCreditData({...manualCreditData, amount: parseFloat(e.target.value)})} />
                       <button onClick={() => onManualCredit(manualCreditData.identifier, manualCreditData.amount)} className="px-6 bg-emerald-500 text-[#020617] rounded-xl font-black text-[9px] uppercase">Inject</button>
                   </div>
               </div>
               <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-500 px-2">Topup Verification</h3>
                  {topupRequests.filter((r:any) => r.status === 'pending').map((r: any) => (
                      <div key={r.id} className="glass p-4 rounded-2xl border border-indigo-500/30 flex justify-between items-center">
                          <div>
                              <p className="text-sm font-black text-white">₵ {r.amount}</p>
                              <p className="text-[9px] text-slate-500">{r.momoReference}</p>
                          </div>
                          <div className="flex gap-2">
                             {r.proofImage && <button onClick={() => setViewReceipt(r.proofImage)} className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-indigo-400"><i className="fas fa-image"></i></button>}
                             <button onClick={() => onApproveTopup(r.id)} className="px-4 py-2 bg-emerald-500 text-black text-[9px] font-black rounded-lg">Approve</button>
                             <button onClick={() => onRejectTopup(r.id)} className="px-4 py-2 bg-rose-500/20 text-rose-500 text-[9px] font-black rounded-lg">Reject</button>
                          </div>
                      </div>
                  ))}
               </div>
           </div>
       )}

       {activeTab === 'marketing' && (
           <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
               <div>
                   <h3 className="text-xl font-black italic uppercase text-white">Hub Banners (AI)</h3>
                   <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">High-Efficiency Image Gen</p>
               </div>
               <div className="space-y-4">
                   <textarea value={promoPrompt} onChange={(e) => setPromoPrompt(e.target.value)} placeholder="Describe a promotional hub banner..." className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold text-xs outline-none focus:border-indigo-500" />
                   <button onClick={handleCreatePromo} disabled={isGeneratingPromo || !promoPrompt} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl disabled:opacity-50">{isGeneratingPromo ? 'Rendering...' : 'Generate Banner'}</button>
               </div>
               {generatedImage && (
                   <div className="mt-4 animate-in zoom-in">
                        <img src={generatedImage} className="w-full rounded-2xl border border-white/10 shadow-2xl" />
                        <button onClick={() => setGeneratedImage(null)} className="mt-2 text-[9px] font-black text-rose-500 uppercase">Clear</button>
                   </div>
               )}
           </div>
       )}

       {activeTab === 'config' && (
           <div className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Pragia (₵)</label>
                      <input type="number" value={localSettings.farePerPragia} onChange={e => setLocalSettings({...localSettings, farePerPragia: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
                  <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Taxi (₵)</label>
                      <input type="number" value={localSettings.farePerTaxi} onChange={e => setLocalSettings({...localSettings, farePerTaxi: parseFloat(e.target.value)})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold" />
                  </div>
              </div>
              <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase">Announcement</label>
                  <textarea value={localSettings.hub_announcement || ''} onChange={e => setLocalSettings({...localSettings, hub_announcement: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold text-xs h-20" />
              </div>
              <button onClick={handleSaveSettings} disabled={isSaving} className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl disabled:opacity-50">{isSaving ? 'Saving...' : 'Update Settings'}</button>
           </div>
       )}

       {viewReceipt && (
           <div className="fixed inset-0 bg-black/98 z-[1000] flex items-center justify-center p-4 backdrop-blur-xl" onClick={() => setViewReceipt(null)}>
               <div className="max-w-xl w-full flex flex-col items-center">
                   <img src={viewReceipt} className="max-h-[80vh] w-auto rounded-3xl border border-white/10 shadow-2xl" />
                   <button className="mt-8 text-white font-black uppercase text-xs">Close</button>
               </div>
           </div>
       )}
    </div>
  );
};
