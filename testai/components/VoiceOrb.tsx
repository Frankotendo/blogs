
import React, { useEffect, useRef, useState } from 'react';
import { Type, Modality, FunctionDeclaration, LiveServerMessage, GoogleGenAI } from "@google/genai";
import { PortalMode, RideNode, Driver, Transaction, AppSettings } from '../types';
import { ai, createBlob, decode, decodeAudioData } from '../lib/clients';

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
  const [state, setState] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
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
      
      if (state === 'connecting') { r = 250; g = 204; b = 21; } // Yellow
      if (state === 'listening') { r = 16; g = 185; b = 129; } 
      if (state === 'speaking') { r = 255; g = 255; b = 255; } 
      if (state === 'error') { r = 239; g = 68; b = 68; } 

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
    setState('connecting');

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
            setState('listening'); // Connection successful
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
                    result = { status: "Safe", analysis: "System Nominal.", action: "None." };
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
             setState('error');
             setTimeout(() => setIsActive(false), 2000);
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (e: any) {
      console.error("Failed to start voice session", e);
      setState('error');
      setTimeout(() => setIsActive(false), 2000);
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
                {state === 'connecting' ? 'Establishing Link...' : state === 'listening' ? 'Tie me...' : state === 'speaking' ? 'Kofi (AI)' : state === 'error' ? 'Link Failed' : 'Thinking...'}
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
