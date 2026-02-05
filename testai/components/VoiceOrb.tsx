
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

  // Enhanced Haptic Helper
  const vibrate = (pattern: number | number[]) => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
              navigator.vibrate(pattern);
          } catch (e) {
              console.debug("Vibration failed", e);
          }
      }
  };

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
      
      if (state === 'connecting') { r = 250; g = 204; b = 21; } 
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
      vibrate(20); // Quick end pulse
      if (sessionRef.current) {
        sessionRef.current.then((session: any) => session.close()).catch(() => {});
      }
      sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
      sourcesRef.current.clear();
      audioContextRef.current?.close();
      inputAudioContextRef.current?.close();
      return;
    }

    setIsActive(true);
    setState('connecting');
    
    // Wake up audio and prime vibration
    vibrate([40, 40]); 

    let tools: FunctionDeclaration[] = [];
    let systemInstruction = "";

    const ghanaianPersona = `Ghanaian AI Kofi. Be ultra-concise. English/Twi/Pidgin. Fix forms instantly. No filler words.`;

    if (mode === 'driver') {
      systemInstruction = `${ghanaianPersona} Driver: ${user?.name || 'Partner'}. Available tools: update_status, check_wallet.`;
      tools = [{
          name: 'update_status',
          description: 'Set status to online, busy, or offline.',
          parameters: { type: Type.OBJECT, properties: { status: { type: Type.STRING, enum: ['online', 'busy', 'offline'] } }, required: ['status'] }
        }, { name: 'check_wallet', description: 'Check earnings.' }];
    } else if (mode === 'admin') {
      systemInstruction = `Admin Terminal Kofi. Monitor Revenue & Health. Tools: get_revenue_report, system_health_check.`;
      tools = [{ name: 'get_revenue_report', description: 'Show total money.' }, { name: 'system_health_check', description: 'Show app counts.' }];
    } else if (mode === 'public') {
       systemInstruction = `${ghanaianPersona} Capture credentials fast: name, phone, pin via fill_auth_details.`;
       tools = [{
           name: 'fill_auth_details',
           description: 'Auto-fill login/signup.',
           parameters: { type: Type.OBJECT, properties: { phone: { type: Type.STRING }, username: { type: Type.STRING }, pin: { type: Type.STRING } } }
       }];
    } else {
      systemInstruction = `${ghanaianPersona} Student portal. Tools: fill_ride_form, confirm_ride.`;
      tools = [{ 
          name: 'fill_ride_form', 
          description: 'Fill booking details.',
          parameters: { type: Type.OBJECT, properties: { origin: { type: Type.STRING }, destination: { type: Type.STRING }, vehicleType: { type: Type.STRING, enum: ['Pragia', 'Taxi', 'Shuttle'] }, isSolo: { type: Type.BOOLEAN } }, required: ['destination'] }
        }, { name: 'confirm_ride', description: 'Press book button.' }];
    }

    try {
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // CRITICAL: Explicitly resume on user gesture
      await inputAudioContext.resume();
      await outputAudioContext.resume();
      
      audioContextRef.current = outputAudioContext;
      inputAudioContextRef.current = inputAudioContext;
      nextStartTimeRef.current = 0; // Reset cursor

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputNode = inputAudioContext.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          systemInstruction,
          tools: [{ functionDeclarations: tools }],
          thinkingConfig: { thinkingBudget: 0 } 
        },
        callbacks: {
          onopen: () => {
            setState('listening');
            vibrate(50); // Ready to listen pulse
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
              if (state !== 'speaking') {
                  vibrate(40); // Model starting to speak haptic
                  setState('speaking');
              }
              
              const buffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
              
              // CRITICAL: Cursor sync fix
              const now = outputAudioContext.currentTime;
              if (nextStartTimeRef.current < now) {
                  nextStartTimeRef.current = now + 0.05; // Add small buffer to prevent clipping
              }
              
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
               sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
               sourcesRef.current.clear();
               nextStartTimeRef.current = outputAudioContext.currentTime; // Sync immediately on break
               setState('listening');
               vibrate(10);
            }

            if (msg.toolCall) {
              const session = await sessionPromise;
              for (const fc of msg.toolCall.functionCalls) {
                 vibrate(25);
                 let result: any = { result: "OK" };
                 const cleanArgs = (args: any) => {
                    const clean: any = {};
                    for (const key in args) if (args[key] !== undefined && args[key] !== null) clean[key] = args[key];
                    return clean;
                 };
                 
                 if (fc.name === 'update_status' && actions.onUpdateStatus) {
                    actions.onUpdateStatus((fc.args as any).status);
                 } else if (fc.name === 'check_wallet') {
                    result = { result: `Wallet balance is ${user?.walletBalance || 0} cedis.` };
                 } else if (fc.name === 'get_revenue_report') {
                     const total = contextData.transactions?.reduce((a, b) => a + b.amount, 0) || 0;
                     result = { result: `Platform revenue: ₵${total.toFixed(2)}.` };
                 } else if (fc.name === 'system_health_check') {
                     result = { result: `${contextData.drivers.length} drivers, ${contextData.nodes.length} rides.` };
                 } else if (fc.name === 'fill_ride_form' && actions.onFillRideForm) {
                     actions.onFillRideForm(cleanArgs(fc.args));
                 } else if (fc.name === 'confirm_ride' && actions.onConfirmRide) {
                     actions.onConfirmRide();
                 } else if (fc.name === 'fill_auth_details' && actions.onFillAuth) {
                     actions.onFillAuth(cleanArgs(fc.args));
                 }

                 session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: result } });
              }
            }
          },
          onclose: () => {
              setIsActive(false);
              vibrate(10);
          },
          onerror: () => {
             setState('error');
             vibrate([100, 50, 100]);
             setTimeout(() => setIsActive(false), 2000);
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (e: any) {
      console.error("AI Bridge Failed", e);
      setState('error');
      vibrate([100, 50, 100]);
      setTimeout(() => setIsActive(false), 2000);
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
        className={`fixed bottom-24 left-6 lg:bottom-12 lg:left-12 z-[500] w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all ${isActive ? 'bg-rose-500 scale-110' : `bg-gradient-to-tr ${getOrbColor()}`}`}
      >
        <i className={`fas ${isActive ? 'fa-microphone-slash' : 'fa-microphone'} text-white text-2xl`}></i>
      </button>

      {isActive && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[450] flex flex-col items-center justify-center animate-in fade-in duration-300">
           <canvas ref={canvasRef} width={400} height={400} className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]" />
           <div className="mt-8 text-center px-4">
              <h3 className="text-2xl font-black italic uppercase text-white tracking-widest animate-pulse">
                {state === 'connecting' ? 'SYNCING...' : state === 'listening' ? 'Kofi Listening' : state === 'speaking' ? 'Kofi AI' : '...'}
              </h3>
              <p className="text-xs font-bold text-indigo-400 uppercase mt-2 tracking-[0.2em]">
                {state === 'speaking' ? 'Model Responding' : 'Real-time Voice Active'}
              </p>
           </div>
           <button onClick={toggleSession} className="mt-12 px-8 py-3 bg-white/10 rounded-full text-white font-black uppercase text-xs hover:bg-white/20 transition-all border border-white/10">End Call</button>
        </div>
      )}
    </>
  );
};
