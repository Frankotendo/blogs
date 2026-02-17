
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
import { AppSettings, SearchConfig, PortalMode } from '../types';
import { ai, shareHub } from '../utils';

// --- MENU MODAL (FIXED) ---
export const MenuModal = ({ onClose, onLogout, currentUser, settings }: { onClose: () => void, onLogout: () => void, currentUser: any, settings: AppSettings }) => {
  return (
    <div className="fixed inset-0 bg-black/95 z-[2000] flex items-end sm:items-center justify-center sm:p-4 animate-in slide-in-from-bottom duration-300">
      <div className="bg-[#020617] w-full max-w-sm sm:rounded-[2.5rem] rounded-t-[2.5rem] border border-white/10 overflow-hidden relative shadow-2xl">
         <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-black italic uppercase text-white">Menu</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
         </div>
         <div className="p-6 space-y-4">
             <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-xl">
                   {currentUser.username[0].toUpperCase()}
                </div>
                <div>
                   <h3 className="text-lg font-bold text-white leading-none">{currentUser.username}</h3>
                   <p className="text-xs text-slate-400">{currentUser.phone}</p>
                </div>
             </div>
             
             <div className="space-y-1">
                <button onClick={shareHub} className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 text-left flex items-center gap-3 transition-colors">
                   <i className="fas fa-share-nodes text-indigo-400 w-6"></i>
                   <span className="text-sm font-bold text-slate-200">Share NexRyde</span>
                </button>
                <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 text-left flex items-center gap-3 transition-colors block">
                   <i className="fab fa-whatsapp text-emerald-400 w-6"></i>
                   <span className="text-sm font-bold text-slate-200">Support Chat</span>
                </a>
             </div>

             <div className="pt-4 border-t border-white/5">
                <button onClick={onLogout} className="w-full p-4 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-left flex items-center gap-3 transition-all group">
                   <i className="fas fa-power-off text-rose-500 group-hover:text-white w-6"></i>
                   <span className="text-sm font-bold text-rose-500 group-hover:text-white">Sign Out</span>
                </button>
             </div>
         </div>
      </div>
    </div>
  );
};

// --- QR SCANNER ---
export const QrScannerModal = ({ onScan, onClose }: { onScan: (text: string) => void, onClose: () => void }) => {
  useEffect(() => {
    if (!(window as any).Html5QrcodeScanner) {
        alert("Scanner library loading... try again.");
        onClose();
        return;
    }
    const scanner = new (window as any).Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
    );
    scanner.render((text: string) => {
        scanner.clear();
        onScan(text);
    }, (err: any) => { /* ignore */ });
    return () => { try { scanner.clear(); } catch(e) {} };
  }, []);
  
  return (
     <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
         <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden relative shadow-2xl">
            <button onClick={onClose} className="absolute top-4 right-4 z-20 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><i className="fas fa-times"></i></button>
            <div className="p-6 text-center">
               <h3 className="text-lg font-black uppercase text-[#020617]">Scan Rider PIN</h3>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Align QR code within frame</p>
               <div id="reader" className="rounded-xl overflow-hidden"></div>
            </div>
         </div>
     </div>
  );
};

// --- ADS ---
export const InlineAd = ({ className, settings }: { className?: string, settings: AppSettings }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings.adSenseStatus !== 'active' || !settings.adSenseClientId || !settings.adSenseSlotId) return;
    try {
      if (adRef.current && adRef.current.innerHTML !== "") return; 
      setTimeout(() => {
         try {
           (window as any).adsbygoogle = (window as any).adsbygoogle || [];
           (window as any).adsbygoogle.push({});
         } catch(e) { console.debug("AdSense Push", e); }
      }, 500);
    } catch (e) { console.error("AdSense Init Error", e); }
  }, [settings.adSenseStatus, settings.adSenseClientId, settings.adSenseSlotId]);

  if (settings.adSenseStatus !== 'active' || !settings.adSenseClientId || !settings.adSenseSlotId) return null;
  return (
    <div className={`glass p-4 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center bg-white/5 overflow-hidden ${className}`}>
        <p className="text-[8px] font-black uppercase text-slate-500 mb-2 tracking-widest">Sponsored</p>
        <div className="w-full flex justify-center bg-transparent" ref={adRef}>
            <ins className="adsbygoogle"
                 style={{display:'block', width: '100%', maxWidth: '300px', height: '100px'}}
                 data-ad-format="fluid"
                 data-ad-layout-key={settings.adSenseLayoutKey || "-fb+5w+4e-db+86"}
                 data-ad-client={settings.adSenseClientId}
                 data-ad-slot={settings.adSenseSlotId}></ins>
        </div>
    </div>
  );
};

export const AdGate = ({ onUnlock, label, settings }: { onUnlock: () => void, label: string, settings: AppSettings }) => {
  const [timeLeft, setTimeLeft] = useState(5);
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    if (settings.adSenseStatus === 'active' && settings.adSenseClientId && settings.adSenseSlotId) {
      try {
        if (adRef.current && adRef.current.innerHTML !== "") {} else {
            setTimeout(() => {
               try {
                 (window as any).adsbygoogle = (window as any).adsbygoogle || [];
                 (window as any).adsbygoogle.push({});
               } catch(e) { console.error("AdSense Push Error", e); }
            }, 100);
        }
      } catch (e) { console.error("AdSense Init Error", e); }
    }
    return () => clearInterval(timer);
  }, [settings.adSenseStatus, settings.adSenseClientId, settings.adSenseSlotId]);

  return (
    <div className="fixed inset-0 bg-black/95 z-[500] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="glass-bright w-full max-w-sm p-6 rounded-[2.5rem] border border-white/10 text-center relative overflow-hidden animate-in zoom-in">
         <div className="absolute top-0 left-0 right-0 h-1 bg-white/10">
            <div className="h-full bg-amber-500 transition-all duration-1000 ease-linear" style={{ width: `${(1 - timeLeft/5) * 100}%` }}></div>
         </div>
         <div className="mb-4">
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] animate-pulse">Sponsored Session</span>
            <h3 className="text-xl font-black italic text-white mt-1">{label}</h3>
            <p className="text-[10px] text-slate-400 mt-1">Watch this ad to unlock premium features.</p>
         </div>
         <div className="bg-white rounded-xl overflow-hidden min-h-[250px] flex items-center justify-center mb-6 relative">
             <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-[10px] font-bold uppercase z-0">
               {settings.adSenseStatus !== 'active' ? 'Ads Disabled' : 'Ad Loading...'}
             </div>
             {settings.adSenseStatus === 'active' && settings.adSenseClientId && (
               <div className="relative z-10 w-full flex justify-center bg-white" ref={adRef}>
                  <ins className="adsbygoogle"
                       style={{display:'inline-block', width:'300px', height:'250px'}}
                       data-ad-client={settings.adSenseClientId}
                       data-ad-slot={settings.adSenseSlotId}></ins>
               </div>
             )}
         </div>
         <button onClick={onUnlock} disabled={timeLeft > 0} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${timeLeft > 0 ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 text-white shadow-xl hover:scale-105'}`}>
           {timeLeft > 0 ? `Unlocking in ${timeLeft}s` : 'Continue to Feature'}
         </button>
      </div>
    </div>
  );
};

// --- AUTH UI ---
export const HubGateway = ({ 
  onIdentify, settings, formState, setFormState, onTriggerVoice 
}: { 
  onIdentify: (username: string, phone: string, pin: string, mode: 'login' | 'signup') => void, 
  settings: AppSettings,
  formState: { username: string, phone: string, pin: string, mode: 'login' | 'signup' },
  setFormState: any,
  onTriggerVoice: () => void
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/20 to-purple-900/20"></div>
      <div className="glass-bright w-full max-md:mt-12 max-w-md p-8 rounded-[3rem] border border-white/10 relative z-10 animate-in zoom-in duration-500">
        <div className="text-center mb-8">
          {settings.appLogo ? (
            <img src={settings.appLogo} className="w-24 h-24 object-contain mx-auto mb-4 drop-shadow-2xl" alt="Logo" />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-orange-500/20 mb-4">
               <i className="fas fa-route text-[#020617] text-3xl"></i>
            </div>
          )}
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">NexRyde</h1>
          <p className="text-xs font-black text-amber-500 uppercase tracking-widest mt-2">Transit Excellence</p>
        </div>

        <button 
          onClick={onTriggerVoice}
          className="w-full mb-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform shadow-xl shadow-emerald-900/20 group"
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <i className="fas fa-microphone"></i>
          </div>
          <div className="text-left">
             <span className="block text-[10px] font-black uppercase tracking-widest opacity-80">Local Language Support</span>
             <span className="block text-sm font-black italic">Kasa (Speak to Login)</span>
          </div>
        </button>

        <div className="space-y-4">
           {formState.mode === 'signup' && (
             <input 
               value={formState.username} 
               onChange={e => setFormState({...formState, username: e.target.value})}
               className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
               placeholder="Choose Username"
             />
           )}
           <input 
             value={formState.phone} 
             onChange={e => setFormState({...formState, phone: e.target.value})}
             className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
             placeholder="Phone Number"
           />
           <input 
             value={formState.pin}
             type="password"
             maxLength={4} 
             onChange={e => setFormState({...formState, pin: e.target.value.replace(/\D/g, '').slice(0, 4)})}
             className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600 tracking-widest text-center"
             placeholder="4-Digit Security PIN"
           />
           <button 
             onClick={() => onIdentify(formState.username, formState.phone, formState.pin, formState.mode)}
             className="w-full bg-amber-500 text-[#020617] py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl"
           >
             {formState.mode === 'login' ? 'Enter Hub' : 'Create Identity'}
           </button>
        </div>
        <div className="mt-6 text-center">
          <button onClick={() => setFormState({...formState, mode: formState.mode === 'login' ? 'signup' : 'login'})} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors">
            {formState.mode === 'login' ? 'New here? Create Account' : 'Have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- NAVIGATION ---
export const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all group ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>
    <div className="flex items-center gap-4">
       <i className={`fas ${icon} text-lg w-6 text-center ${active ? 'text-white' : 'group-hover:scale-110 transition-transform'}`}></i>
       <span className="text-sm font-bold">{label}</span>
    </div>
    {badge && <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full">{badge}</span>}
  </button>
);

export const MobileNavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 relative ${active ? 'text-indigo-400' : 'text-slate-500'}`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600 text-white shadow-lg translate-y-[-10px]' : 'bg-transparent'}`}>
      <i className={`fas ${icon} text-lg`}></i>
    </div>
    <span className={`text-[9px] font-black uppercase tracking-wide ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    {badge && <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 border border-[#020617] rounded-full"></span>}
  </button>
);

export const SearchHub = ({ searchConfig, setSearchConfig, portalMode }: { searchConfig: SearchConfig, setSearchConfig: (c: SearchConfig) => void, portalMode: PortalMode }) => {
  return (
    <div className="bg-white/5 border border-white/5 p-2 rounded-[2rem] flex flex-col md:flex-row gap-2">
      <div className="flex-1 relative">
         <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-slate-500"></i>
         <input 
           value={searchConfig.query}
           onChange={(e) => setSearchConfig({...searchConfig, query: e.target.value})}
           className="w-full bg-[#020617]/50 rounded-[1.5rem] pl-14 pr-6 py-4 text-white font-bold outline-none border border-transparent focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
           placeholder={portalMode === 'driver' ? "Find routes or passengers..." : "Where to?"}
         />
      </div>
      {portalMode === 'passenger' && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
           {['All', 'Pragia', 'Taxi', 'Shuttle'].map(type => (
             <button 
               key={type}
               onClick={() => setSearchConfig({...searchConfig, vehicleType: type as any})}
               className={`px-6 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all ${searchConfig.vehicleType === type ? 'bg-white text-[#020617]' : 'bg-[#020617]/50 text-slate-500 hover:bg-white/10'}`}
             >
               {type}
             </button>
           ))}
        </div>
      )}
    </div>
  );
};

export const HelpSection = ({ icon, title, color, points }: any) => (
  <div className="glass p-6 rounded-[2rem] border border-white/5">
     <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
           <i className={`fas ${icon}`}></i>
        </div>
        <h4 className="text-sm font-black uppercase text-white">{title}</h4>
     </div>
     <ul className="space-y-2">
        {points.map((p: string, i: number) => (
           <li key={i} className="text-[10px] text-slate-400 font-medium leading-relaxed flex gap-2">
              <span className={`mt-1 w-1 h-1 rounded-full shrink-0 ${color.replace('text-', 'bg-')}`}></span>
              {p}
           </li>
        ))}
     </ul>
  </div>
);

export const AiHelpDesk = ({ onClose, settings }: any) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    {role: 'model', text: `Hello! I'm the NexRyde AI Assistant. I can help you with app features, pricing, and safety tips. How can I help you today?`}
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<Chat | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
     chatRef.current = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
            systemInstruction: `You are a helpful support assistant for NexRyde. 
        App Details:
        - Currency: Cedis (₵)
        - Fares: Pragia (₵${settings.farePerPragia}), Taxi (₵${settings.farePerTaxi}). Solo x${settings.soloMultiplier}.
        - Commission: ₵${settings.commissionPerSeat} per seat.
        - Admin Contact: ${settings.adminMomo} (${settings.adminMomoName})
        Keep answers short.`
        }
     });
  }, [settings]);

  const handleSend = async () => {
    if (!input.trim() || !chatRef.current) return;
    const userMsg = input;
    setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
    setInput('');
    setLoading(true);
    try {
      const response = await chatRef.current.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, {role: 'model', text: response.text || "I didn't catch that."}]);
    } catch (err) {
      setMessages(prev => [...prev, {role: 'model', text: "Connection error. Try again."}]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#020617] w-full max-w-lg h-[80vh] sm:h-[600px] sm:rounded-[2.5rem] flex flex-col border border-white/10 shadow-2xl relative animate-in slide-in-from-bottom">
         <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-900/20 to-purple-900/20 sm:rounded-t-[2.5rem]">
            <h3 className="text-lg font-black italic uppercase text-white">NexRyde AI</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
         </div>
         <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
            {messages.map((m, i) => (
               <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white/10 text-slate-200 rounded-bl-none'}`}>{m.text}</div>
               </div>
            ))}
            {loading && <div className="text-xs text-slate-500">Typing...</div>}
         </div>
         <div className="p-4 border-t border-white/5 flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 bg-white/5 rounded-full px-4 text-white text-sm outline-none" placeholder="Ask something..." />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white"><i className="fas fa-paper-plane"></i></button>
         </div>
      </div>
    </div>
  );
};
