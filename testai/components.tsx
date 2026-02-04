
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type, Chat, LiveServerMessage, Modality, FunctionDeclaration } from "@google/genai";
import { ai, createBlob, decode, decodeAudioData, PortalMode, RideNode, Driver, Transaction, AppSettings } from './lib';

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
    }, (err: any) => {
        // ignore errors
    });
    
    return () => {
        try { scanner.clear(); } catch(e) {}
    };
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

export const GlobalVoiceOrb = ({ 
  mode,
  user,
  contextData,
  actions,
  triggerRef
}: { 
  mode: PortalMode,
  user: any,
  contextData: {
    nodes: RideNode[],
    drivers: Driver[],
    transactions?: Transaction[],
    settings: AppSettings,
    pendingRequests?: number,
  },
  actions: {
    onUpdateStatus?: (s: string) => void,
    onAcceptRide?: (id: string) => void,
    onFillRideForm?: (data: any) => void,
    onConfirmRide?: () => void,
    onFillAuth?: (data: any) => void,
  },
  triggerRef?: React.MutableRefObject<() => void>
}) => {
  const [isActive, setIsActive] = useState(false);
  const [state, setState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    if (triggerRef) {
      triggerRef.current = () => toggleSession();
    }
  }, [triggerRef, isActive]);

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let frameId = 0;
    const startTime = Date.now();

    const draw = () => {
      const time = (Date.now() - startTime) / 1000;
      const width = canvasRef.current!.width;
      const height = canvasRef.current!.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      let r = 99, g = 102, b = 241; 
      if (mode === 'admin') { r = 244; g = 63; b = 94; } 
      if (mode === 'driver') { r = 245; g = 158; b = 11; } 
      if (mode === 'public') { r = 34; g = 197; b = 94; } 
      
      if (state === 'listening') { r = 16, g = 185, b = 129; } 
      if (state === 'speaking') { r = 255; g = 255; b = 255; } 

      const baseRadius = 60;
      const pulse = Math.sin(time * 3) * 5;
      const ripple = (time * 50) % 50;

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + ripple + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${1 - ripple/50})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
      ctx.shadowBlur = 20;
      ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      frameId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frameId);
  }, [isActive, state, mode]);

  const toggleSession = async () => {
    if (isActive) {
      setIsActive(false);
      setState('idle');
      if (sessionRef.current) {
        sessionRef.current.then((session: any) => session.close()).catch((err: any) => console.error("Failed to close session:", err));
      }
      audioContextRef.current?.close();
      inputAudioContextRef.current?.close();
      return;
    }

    setIsActive(true);
    setState('listening');

    let tools: FunctionDeclaration[] = [];
    let systemInstruction = "";

    const ghanaianPersona = `
      You are "Kofi", the NexRyde Polyglot Assistant.
      LANGUAGE CAPABILITIES:
      - You can speak and understand English, Twi, Ga, Ewe, Hausa, and Ghanaian Pidgin.
      - DETECT the user's language immediately and respond in that same language/dialect.
      - Use Ghanaian mannerisms like "Charley", "Bossu", "Maa", "Bra", "Mepaakyɛw" (Please), "Akwaaba" (Welcome).
      
      ROLE:
      - You are not just a chatbot. You are a CO-PILOT. You fill forms and press buttons for the user.
      - Be patient, helpful, and respectful to elders.
    `;

    if (mode === 'driver') {
      systemInstruction = `${ghanaianPersona}
      You help drivers hands-free. Keep responses under 20 words for safety while driving.
      Current Driver: ${user?.name || 'Partner'}.`;
      
      tools = [
        {
          name: 'update_status',
          description: 'Update the driver availability status (online, busy, offline).',
          parameters: {
             type: Type.OBJECT,
             properties: { status: { type: Type.STRING, enum: ['online', 'busy', 'offline'] } },
             required: ['status']
          }
        },
        { name: 'check_wallet', description: 'Check current wallet balance and earnings.' },
        { 
          name: 'scan_for_rides', 
          description: 'Search for available rides near a location.',
          parameters: {
             type: Type.OBJECT,
             properties: { location: { type: Type.STRING, description: 'Location keyword like "Casford" or "Science".' } }
          }
        }
      ];
    } else if (mode === 'admin') {
      systemInstruction = `You are the Nexus Security Overseer. 
      You analyze system health, detect financial anomalies, and scan for cyber threats.
      You speak with authority and precision.`;
      
      tools = [
        { name: 'analyze_security_threats', description: 'Scans system logs for high-frequency requests, bot patterns, and potential attacks.' },
        { name: 'get_revenue_report', description: 'Get the total hub revenue and financial status.' },
        { name: 'system_health_check', description: 'Get count of active users, drivers, and pending requests.' }
      ];
    } else if (mode === 'public') {
       systemInstruction = `${ghanaianPersona}
       You are helping a new user Log In or Sign Up.
       CRITICAL: Use the tool 'fill_auth_details' IMMEDIATELY when the user provides ANY piece of information (phone, name, or pin). 
       Do not wait for the full form to be described. Call the tool incrementally.
       Encourage them to join NexRyde.`;
       tools = [
         {
           name: 'fill_auth_details',
           description: 'Fill the login/signup form for the user. Call this even with partial info.',
           parameters: {
             type: Type.OBJECT,
             properties: {
               phone: { type: Type.STRING, description: "Phone number" },
               username: { type: Type.STRING, description: "Username (for signup)" },
               pin: { type: Type.STRING, description: "4 digit PIN" }
             }
           }
         }
       ]
    } else {
      systemInstruction = `${ghanaianPersona}
      You help students find rides.
      CRITICAL: If a user says "I want to go to [Place]" or asks to find a location like "Best Waakye spot", use the 'find_destination' tool to get the real address, then call 'fill_ride_form'.
      If they say "Confirm" or "Call the driver", call 'confirm_ride'.
      Pricing: Pragia ₵${contextData.settings.farePerPragia}, Taxi ₵${contextData.settings.farePerTaxi}.
      `;
      tools = [
        { 
          name: 'fill_ride_form', 
          description: 'Fill the ride request form.',
          parameters: {
             type: Type.OBJECT,
             properties: { 
               origin: { type: Type.STRING, description: "Pickup point (optional)" },
               destination: { type: Type.STRING, description: "Dropoff point" },
               vehicleType: { type: Type.STRING, enum: ['Pragia', 'Taxi', 'Shuttle'] },
               isSolo: { type: Type.BOOLEAN, description: "True for solo/express ride, False for pool." }
             },
             required: ['destination']
          }
        },
        {
          name: 'find_destination',
          description: 'Use Google Maps to find a place or business name when the user is unsure of the address or asks for a recommendation (e.g., "Find food", "Take me to Casford").',
          parameters: {
             type: Type.OBJECT,
             properties: { query: { type: Type.STRING, description: "The search query for the place." } },
             required: ['query']
          }
        },
        { name: 'confirm_ride', description: 'Submit the ride request currently on screen.' },
        { name: 'check_pricing', description: 'Get current fare prices for different vehicle types.' }
      ];
    }

    try {
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputAudioContext;
      inputAudioContextRef.current = inputAudioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputNode = inputAudioContext.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          systemInstruction,
          tools: [{ functionDeclarations: tools }]
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            inputNode.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setState('speaking');
              const buffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
              const source = outputAudioContext.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAudioContext.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setState('listening');
              };
            }

            if (msg.serverContent?.interrupted) {
               sourcesRef.current.forEach(s => s.stop());
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setState('listening');
            }

            if (msg.toolCall) {
              const session = await sessionPromise;
              for (const fc of msg.toolCall.functionCalls) {
                 let result: any = { result: "Done" };
                 
                 const cleanArgs = (args: any) => {
                    const clean: any = {};
                    for (const key in args) {
                        if (args[key] !== undefined && args[key] !== null) {
                            clean[key] = args[key];
                        }
                    }
                    return clean;
                 };
                 
                 if (fc.name === 'update_status' && actions.onUpdateStatus) {
                    const s = (fc.args as any).status;
                    actions.onUpdateStatus(s);
                    result = { result: `Status updated to ${s}` };
                 } else if (fc.name === 'check_wallet') {
                    result = { result: `Balance: ${user?.walletBalance || 0} cedis.` };
                 } else if (fc.name === 'scan_for_rides') {
                    const loc = (fc.args as any).location?.toLowerCase();
                    const rides = contextData.nodes.filter(n => {
                       if (!loc) return true;
                       return n.origin.toLowerCase().includes(loc) || n.destination.toLowerCase().includes(loc);
                    }).slice(0, 3);
                    if (rides.length === 0) result = { result: "No rides found." };
                    else result = { result: `Found ${rides.length} rides. ` + rides.map(r => r.destination).join(", ") };
                 
                 } else if (fc.name === 'find_destination' && actions.onFillRideForm) {
                    const query = (fc.args as any).query;
                    // Use standard GenerateContent with Maps tool for retrieval
                    try {
                        const searchAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
                        const mapsResp = await searchAi.models.generateContent({
                            model: "gemini-2.5-flash",
                            contents: `Find the best match for: ${query}. Return the name and address.`,
                            config: {
                                tools: [{ googleMaps: {} }]
                            }
                        });
                        
                        // Heuristic to extract grounding
                        const chunks = mapsResp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                        const mapChunk = chunks.find((c: any) => c.web?.title || c.web?.uri); // Maps grounding structure fallback
                        
                        let placeName = query;
                        if (mapChunk && mapChunk.web) {
                            placeName = mapChunk.web.title;
                        } else {
                            // Fallback to text
                            placeName = mapsResp.text?.split('\n')[0] || query;
                        }
                        
                        // Clean up text response if it's chatty
                        placeName = placeName.replace("The best match is ", "").replace(".", "");

                        actions.onFillRideForm({ destination: placeName });
                        result = { result: `Found ${placeName}. Ride form updated.` };
                    } catch (err) {
                        console.error("Maps grounding failed", err);
                        result = { result: "Could not find location data. Please try again." };
                    }

                 } else if (fc.name === 'analyze_security_threats') {
                    const recentTx = contextData.transactions?.slice(0, 10).map(t => `${t.type}: ${t.amount}`).join(', ');
                    try {
                        const securityAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
                        const resp = await securityAi.models.generateContent({
                            model: 'gemini-3-flash-preview',
                            contents: `Analyze these recent transactions for security threats (e.g. rapid high amounts, odd patterns). Data: ${recentTx || 'No recent data'}. Return a short status summary.`
                        });
                        result = { status: "Analyzed", analysis: resp.text || "System Nominal." };
                    } catch (e) {
                        result = { status: "Error", analysis: "AI Analysis Failed." };
                    }
                 } else if (fc.name === 'get_revenue_report') {
                     const total = contextData.transactions?.reduce((a, b) => a + b.amount, 0) || 0;
                     result = { result: `Total Hub Revenue is ${total.toFixed(2)} cedis.` };
                 } else if (fc.name === 'system_health_check') {
                     result = { result: `Active Drivers: ${contextData.drivers.length}. Total Rides: ${contextData.nodes.length}. Pending: ${contextData.pendingRequests}.` };

                 } else if (fc.name === 'fill_ride_form' && actions.onFillRideForm) {
                     const safeArgs = cleanArgs(fc.args);
                     if (safeArgs.destination || safeArgs.origin) {
                         actions.onFillRideForm(safeArgs);
                         result = { result: `Form updated. Destination: ${safeArgs.destination || 'Unset'}, Origin: ${safeArgs.origin || 'Unset'}. Ask for missing details.` };
                     } else {
                         result = { result: "No location data found in request." };
                     }
                 } else if (fc.name === 'confirm_ride' && actions.onConfirmRide) {
                     actions.onConfirmRide();
                     result = { result: "Ride confirmed and requested." };
                 } else if (fc.name === 'fill_auth_details' && actions.onFillAuth) {
                     const safeArgs = cleanArgs(fc.args);
                     actions.onFillAuth(safeArgs);
                     result = { result: `Auth form updated with provided details.` };
                 } else if (fc.name === 'check_pricing') {
                     result = { result: `Pragia: ${contextData.settings.farePerPragia}. Taxi: ${contextData.settings.farePerTaxi}.` };
                 }

                 session.sendToolResponse({
                    functionResponses: {
                       id: fc.id,
                       name: fc.name,
                       response: result
                    }
                 });
              }
            }
          },
          onclose: () => {
             console.log("Session Closed");
             setIsActive(false);
          },
          onerror: (e) => {
             console.error("Gemini Live Error", e);
             setIsActive(false);
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (e: any) {
      console.error("Failed to start voice session", e);
      setIsActive(false);
      alert("Failed to access microphone.");
    }
  };

  const getOrbColor = () => {
     if (mode === 'admin') return 'from-rose-600 to-pink-600';
     if (mode === 'driver') return 'from-amber-500 to-orange-600';
     if (mode === 'public') return 'from-emerald-500 to-teal-600';
     return 'from-indigo-600 to-purple-600';
  };

  return (
    <>
      <button 
        onClick={toggleSession}
        className={`fixed bottom-24 left-6 lg:bottom-12 lg:left-12 z-[500] w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all ${isActive ? 'bg-rose-500 scale-110 animate-pulse' : `bg-gradient-to-tr ${getOrbColor()}`}`}
      >
        <i className={`fas ${isActive ? 'fa-microphone-slash' : 'fa-microphone'} text-white text-2xl`}></i>
      </button>

      {isActive && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[450] flex flex-col items-center justify-center animate-in fade-in duration-300">
           <canvas ref={canvasRef} width={400} height={400} className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]" />
           <div className="mt-8 text-center px-4">
              <h3 className="text-2xl font-black italic uppercase text-white tracking-widest animate-pulse">
                {state === 'listening' ? 'Tie me...' : state === 'speaking' ? 'Kofi (AI)' : 'Thinking...'}
              </h3>
              <p className="text-xs font-bold opacity-70 uppercase mt-2 tracking-[0.2em]" style={{ color: mode === 'admin' ? '#f43f5e' : '#94a3b8' }}>
                {mode === 'admin' ? 'Security Protocol Active' : mode === 'driver' ? 'Partner Hands-Free' : 'Polyglot Assistant'}
              </p>
              
              <div className="mt-8 grid grid-cols-2 gap-4 max-w-xs mx-auto text-[10px] text-slate-400 font-bold uppercase">
                 {mode === 'public' && (
                    <>
                       <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400">"Help me login"</div>
                       <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400">"My phone is..."</div>
                    </>
                 )}
                 {mode === 'passenger' && (
                    <>
                       <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">"I want Waakye"</div>
                       <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">"Call Pragia"</div>
                    </>
                 )}
              </div>
           </div>
           <button onClick={toggleSession} className="mt-12 px-8 py-3 bg-white/10 rounded-full text-white font-black uppercase text-xs hover:bg-white/20 transition-all">End Call</button>
        </div>
      )}
    </>
  );
};

export const InlineAd = ({ className, settings }: { className?: string, settings: AppSettings }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings.adSenseStatus !== 'active' || !settings.adSenseClientId || !settings.adSenseSlotId) return;

    try {
      if (adRef.current && adRef.current.innerHTML !== "") {
         return; 
      }
      setTimeout(() => {
         try {
           (window as any).adsbygoogle = (window as any).adsbygoogle || [];
           (window as any).adsbygoogle.push({});
         } catch(e) { console.debug("AdSense Push", e); }
      }, 500);
    } catch (e) {
      console.error("AdSense Init Error", e);
    }
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
        if (adRef.current && adRef.current.innerHTML !== "") {
        } else {
            setTimeout(() => {
               try {
                 (window as any).adsbygoogle = (window as any).adsbygoogle || [];
                 (window as any).adsbygoogle.push({});
               } catch(e) { console.error("AdSense Push Error", e); }
            }, 100);
        }
      } catch (e) {
        console.error("AdSense Init Error", e);
      }
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

         <button 
           onClick={onUnlock} 
           disabled={timeLeft > 0}
           className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${timeLeft > 0 ? 'bg-white/5 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 text-white shadow-xl hover:scale-105'}`}
         >
           {timeLeft > 0 ? `Unlocking in ${timeLeft}s` : 'Continue to Feature'}
         </button>
      </div>
    </div>
  );
};

export const NavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all group ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
  >
    <div className="flex items-center gap-4">
       <i className={`fas ${icon} text-lg w-6 text-center ${active ? 'text-white' : 'group-hover:scale-110 transition-transform'}`}></i>
       <span className="text-sm font-bold">{label}</span>
    </div>
    {badge && <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full">{badge}</span>}
  </button>
);

export const MobileNavItem = ({ active, icon, label, onClick, badge }: any) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 relative ${active ? 'text-indigo-400' : 'text-slate-500'}`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-indigo-600 text-white shadow-lg translate-y-[-10px]' : 'bg-transparent'}`}>
      <i className={`fas ${icon} text-lg`}></i>
    </div>
    <span className={`text-[9px] font-black uppercase tracking-wide ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
    {badge && <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 border border-[#020617] rounded-full"></span>}
  </button>
);

export const SearchHub = ({ searchConfig, setSearchConfig, portalMode }: any) => {
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
            systemInstruction: `You are a helpful support assistant for NexRyde, a ride-sharing app for university students in Ghana. 
        App Details:
        - Currency: Cedis (₵)
        - Vehicle Types: Pragia (Tricycle), Taxi, Shuttle.
        - Fares: Pragia (₵${settings.farePerPragia}), Taxi (₵${settings.farePerTaxi}). Solo rides are x${settings.soloMultiplier}.
        - Commission: ₵${settings.commissionPerSeat} per seat.
        - Features: Pooling (cheaper), Solo (express), Hotspots (drivers station there).
        - Admin Contact: ${settings.adminMomo} (${settings.adminMomoName})
        
        Keep answers short, friendly and helpful. Use emojis.`
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
      const response = await chatRef.current.sendMessage({
        message: userMsg
      });
      
      const text = response.text;
      setMessages(prev => [...prev, {role: 'model', text: text || "I didn't catch that."}]);
    } catch (err) {
      setMessages(prev => [...prev, {role: 'model', text: "I'm having trouble connecting right now. Please try again later."}]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#020617] w-full max-w-lg h-[80vh] sm:h-[600px] sm:rounded-[2.5rem] flex flex-col border border-white/10 shadow-2xl relative animate-in slide-in-from-bottom">
         <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-indigo-900/20 to-purple-900/20 sm:rounded-t-[2.5rem]">
            <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white shadow-lg animate-pulse">
                  <i className="fas fa-sparkles"></i>
               </div>
               <div>
                  <h3 className="text-lg font-black italic uppercase text-white">NexRyde AI</h3>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Support Agent</p>
               </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
         </div>
         
         <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
            {messages.map((m, i) => (
               <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white/10 text-slate-200 rounded-bl-none'}`}>
                     {m.text}
                  </div>
               </div>
            ))}
            {loading && (
               <div className="flex justify-start">
                  <div className="bg-white/5 px-4 py-3 rounded-2xl rounded-bl-none flex gap-1">
                     <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                     <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-100"></span>
                     <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-200"></span>
                  </div>
               </div>
            )}
         </div>

         <div className="p-4 border-t border-white/5">
            <div className="flex gap-2 bg-white/5 p-2 rounded-[1.5rem] border border-white/5 focus-within:border-indigo-500/50 transition-colors">
               <input 
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleSend()}
                 className="flex-1 bg-transparent px-4 text-white text-sm outline-none placeholder:text-slate-600"
                 placeholder="Ask about rides, prices..."
               />
               <button onClick={handleSend} disabled={loading || !input.trim()} className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform">
                  <i className="fas fa-paper-plane text-xs"></i>
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};
