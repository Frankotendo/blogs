
import React, { useEffect, useRef, useState } from 'react';
import { AppSettings } from '../types';
import { ai } from '../lib/clients';

export const InlineAd = ({ className, settings }: { className?: string, settings: AppSettings }) => {
  const adRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (settings.adSenseStatus !== 'active' || !settings.adSenseClientId || !settings.adSenseSlotId) return;
    try {
      setTimeout(() => {
         try { (window as any).adsbygoogle = (window as any).adsbygoogle || []; (window as any).adsbygoogle.push({}); } catch(e) {}
      }, 500);
    } catch (e) {}
  }, [settings.adSenseStatus, settings.adSenseClientId, settings.adSenseSlotId]);
  if (settings.adSenseStatus !== 'active' || !settings.adSenseClientId || !settings.adSenseSlotId) return null;
  return (
    <div className={`glass p-4 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center bg-white/5 overflow-hidden ${className}`}>
        <p className="text-[8px] font-black uppercase text-slate-500 mb-2 tracking-widest">Sponsored</p>
        <div className="w-full flex justify-center bg-transparent" ref={adRef}>
            <ins className="adsbygoogle" style={{display:'block', width: '100%', maxWidth: '300px', height: '100px'}} data-ad-format="fluid" data-ad-layout-key={settings.adSenseLayoutKey || "-fb+5w+4e-db+86"} data-ad-client={settings.adSenseClientId} data-ad-slot={settings.adSenseSlotId}></ins>
        </div>
    </div>
  );
};

export const AdGate = ({ onUnlock, label, settings }: { onUnlock: () => void, label: string, settings: AppSettings }) => {
  const [timeLeft, setTimeLeft] = useState(5);
  const adRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
    if (settings.adSenseStatus === 'active' && settings.adSenseClientId) {
        setTimeout(() => { try { (window as any).adsbygoogle = (window as any).adsbygoogle || []; (window as any).adsbygoogle.push({}); } catch(e) {} }, 100);
    }
    return () => clearInterval(timer);
  }, [settings.adSenseStatus, settings.adSenseClientId]);
  return (
    <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="glass-bright w-full max-w-sm p-6 rounded-[2.5rem] border border-white/10 text-center relative overflow-hidden animate-in zoom-in">
         <div className="absolute top-0 left-0 right-0 h-1 bg-white/10"><div className="h-full bg-amber-500 transition-all duration-1000 ease-linear" style={{ width: `${(1 - timeLeft/5) * 100}%` }}></div></div>
         <div className="mb-4">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] animate-pulse">Sponsored Session</span>
            <h3 className="text-xl font-black italic text-white mt-1">{label}</h3>
         </div>
         <div className="bg-white rounded-xl overflow-hidden min-h-[250px] flex items-center justify-center mb-6 relative">
             <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-[10px] font-bold uppercase">{settings.adSenseStatus !== 'active' ? 'Ads Disabled' : 'Ad Loading...'}</div>
             {settings.adSenseStatus === 'active' && <div className="relative z-10 w-full flex justify-center bg-white" ref={adRef}><ins className="adsbygoogle" style={{display:'inline-block', width:'300px', height:'250px'}} data-ad-client={settings.adSenseClientId} data-ad-slot={settings.adSenseSlotId}></ins></div>}
         </div>
         <button onClick={onUnlock} disabled={timeLeft > 0} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${timeLeft > 0 ? 'bg-white/5 text-slate-500' : 'bg-emerald-500 text-white shadow-xl'}`}>{timeLeft > 0 ? `Unlocking in ${timeLeft}s` : 'Continue'}</button>
      </div>
    </div>
  );
};

export const QrScannerModal = ({ onScan, onClose }: { onScan: (text: string) => void, onClose: () => void }) => {
  const scannerRef = useRef<any>(null);
  useEffect(() => {
    if (!(window as any).Html5QrcodeScanner) { onClose(); return; }
    const scanner = new (window as any).Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    scannerRef.current = scanner;
    scanner.render((text: string) => { 
        scanner.clear().then(() => onScan(text)).catch(() => onScan(text));
    }, () => {});
    return () => { if (scannerRef.current) scannerRef.current.clear().catch(() => {}); };
  }, []);
  return (
     <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
         <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden relative shadow-2xl">
            <button onClick={onClose} className="absolute top-4 right-4 z-20 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><i className="fas fa-times"></i></button>
            <div className="p-6 text-center">
               <h3 className="text-lg font-black uppercase text-[#020617]">Scanner Active</h3>
               <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">Align QR within frame</p>
               <div id="reader" className="rounded-xl overflow-hidden border border-slate-100"></div>
            </div>
         </div>
     </div>
  );
};

export const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all group ${active ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>
    <div className="flex items-center gap-4"><i className={`fas ${icon} text-lg w-6 text-center`}></i><span className="text-sm font-bold">{label}</span></div>
    {badge && <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full">{badge}</span>}
  </button>
);

export const MobileNavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 relative ${active ? 'text-indigo-400' : 'text-slate-500'}`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600 text-white shadow-lg translate-y-[-10px]' : 'bg-transparent'}`}><i className={`fas ${icon} text-lg`}></i></div>
    <span className={`text-[9px] font-black uppercase tracking-wide ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    {badge && <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 border border-[#020617] rounded-full"></span>}
  </button>
);

export const SearchHub = ({ searchConfig, setSearchConfig, portalMode }: any) => (
  <div className="bg-white/5 border border-white/5 p-2 rounded-[2rem] flex flex-col md:flex-row gap-2">
    <div className="flex-1 relative">
       <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
       <input value={searchConfig.query} onChange={(e) => setSearchConfig({...searchConfig, query: e.target.value})} className="w-full bg-[#020617]/50 rounded-[1.5rem] pl-14 pr-6 py-4 text-white font-bold outline-none border border-transparent focus:border-indigo-500/50" placeholder={portalMode === 'driver' ? "Job feed search..." : "Where to?"} />
    </div>
    {portalMode === 'passenger' && (
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
         {['All', 'Pragia', 'Taxi', 'Shuttle'].map(type => (
           <button key={type} onClick={() => setSearchConfig({...searchConfig, vehicleType: type as any})} className={`px-6 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${searchConfig.vehicleType === type ? 'bg-white text-[#020617]' : 'bg-[#020617]/50 text-slate-500'}`}>{type}</button>
         ))}
      </div>
    )}
  </div>
);

export const HelpSection = ({ icon, title, color, points }: any) => (
  <div className="glass p-6 rounded-[2rem] border border-white/5">
     <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}><i className={`fas ${icon}`}></i></div>
        <h4 className="text-sm font-black uppercase text-white">{title}</h4>
     </div>
     <ul className="space-y-2">{points.map((p: string, i: number) => (<li key={i} className="text-[10px] text-slate-400 font-medium leading-relaxed flex gap-2"><span className={`mt-1 w-1 h-1 rounded-full shrink-0 ${color.replace('text-', 'bg-')}`}></span>{p}</li>))}</ul>
  </div>
);

export const AiHelpDesk = ({ onClose, settings }: any) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([{role: 'model', text: `NexRyde Support AI active. How can I help with your campus commute?`}]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  useEffect(() => { chatRef.current = ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction: `Support agent for NexRyde campus app. Fares: Pragia ₵${settings.farePerPragia}, Taxi ₵${settings.farePerTaxi}. Concisely help students and partners.` } }); }, [settings]);
  const handleSend = async () => {
    if (!input.trim() || !chatRef.current) return;
    const userMsg = input; setMessages(prev => [...prev, {role: 'user', text: userMsg}]); setInput(''); setLoading(true);
    try { const response = await chatRef.current.sendMessage({ message: userMsg }); setMessages(prev => [...prev, {role: 'model', text: response.text || "I'm not sure."}]); }
    catch (err) { setMessages(prev => [...prev, {role: 'model', text: "Error connecting."}]); } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#020617] w-full max-w-lg h-[80vh] sm:h-[600px] sm:rounded-[2.5rem] flex flex-col border border-white/10 shadow-2xl relative animate-in slide-in-from-bottom">
         <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-900/20 to-purple-900/20 sm:rounded-t-[2.5rem]">
            <div className="flex items-center gap-4"><div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white"><i className="fas fa-sparkles"></i></div><div><h3 className="text-lg font-black italic text-white uppercase">NexRyde AI</h3></div></div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
         </div>
         <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>{messages.map((m, i) => (<div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-4 rounded-2xl text-xs font-medium ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-200'}`}>{m.text}</div></div>))}</div>
         <div className="p-4 border-t border-white/5"><div className="flex gap-2 bg-white/5 p-2 rounded-[1.5rem] border border-white/5 focus-within:border-indigo-500/50"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 bg-transparent px-4 text-white text-sm outline-none" placeholder="Message support..." /><button onClick={handleSend} disabled={loading || !input.trim()} className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white"><i className="fas fa-paper-plane text-xs"></i></button></div></div>
      </div>
    </div>
  );
};
