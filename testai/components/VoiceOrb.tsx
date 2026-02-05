
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

  // Haptic Helper
  const vibrate = (pattern: number | number[]) => {
      if ('vibrate' in navigator) {
          navigator.vibrate(pattern);
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
      vibrate(10);
      if (sessionRef.current) {
        sessionRef.current.then((session: any) => session.close()).catch((err: any) => console.error("Failed to close session:", err));
      }
      audioContextRef.current?.close();
      inputAudioContextRef.current?.close();
      return;
    }

    setIsActive(true);
    setState('connecting');
    vibrate([40, 40, 40]); // Sharp double pulse for start

    let tools: FunctionDeclaration[] = [];
    let systemInstruction = "";

    const ghanaianPersona = `You are Kofi, the NexRyde Ghanaian Assistant. Speak English, Twi, or Pidgin. Call tools incrementally. Be fast.`;

    if (mode === 'driver') {
      systemInstruction = `${ghanaianPersona} Driver: ${user?.name || 'Partner'}. Update status or check wallet.`;
      tools = [
        {
          name: 'update_status',
          description: 'Update availability.',
          parameters: {
             type: Type.OBJECT, properties: { status: { type: Type.STRING, enum: ['online', 'busy', 'offline'] } },
             required: ['status']
          }
        },
        { name: 'check_wallet', description: 'Check balance.' }
      ];
    } else if (mode === 'admin') {
      systemInstruction = `Authorize protocol. Access logs and revenue. Be precise.`;
      tools = [
        { name: 'get_revenue_report', description: 'Total hub revenue.' },
        { name: 'system_health_check', description: 'System counts.' }
      ];
    } else if (mode === 'public') {
       systemInstruction = `${ghanaianPersona} Help with Login/Signup. Capture phone/name/pin via fill_auth_details immediately.`;
       tools = [
         {
           name: 'fill_auth_details',
           description: 'Fill auth form.',
           parameters: {
             type: Type.OBJECT,
             properties: {
               phone: { type: Type.STRING },
               username: { type: Type.STRING },
               pin: { type: Type.STRING }
             }
           }
         }
       ]
    } else {
      systemInstruction = `${ghanaianPersona} Help students find rides. Confirm or fill_ride_form.`;
      tools = [
        { 
          name: 'fill_ride_form', 
          description: 'Fill request.',
          parameters: {
             type: Type.OBJECT,
             properties: { 
               origin: { type: Type.STRING },
               destination: { type: Type.STRING },
               vehicleType: { type: Type.STRING, enum: ['Pragia', 'Taxi', 'Shuttle'] },
               isSolo: { type: Type.BOOLEAN }
             },
             required: ['destination']
          }
        },
        { name: 'confirm_ride', description: 'Submit request.' }
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
          tools: [{ functionDeclarations: tools }],
          // CRITICAL: Disable thinking budget for ultra-low latency response
          thinkingConfig: { thinkingBudget: 0 } 
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setState('listening');
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
              if (state !== 'speaking') vibrate(30); // Haptic feedback when AI starts talking
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
               vibrate(10);
            }

            if (msg.toolCall) {
              const session = await sessionPromise;
              for (const fc of msg.toolCall.functionCalls) {
                 vibrate(20); // Small pulse for tool action
                 let result: any = { result: "Done" };
                 const cleanArgs = (args: any) => {
                    const clean: any = {};
                    for (const key in args) if (args[key] !== undefined && args[key] !== null) clean[key] = args[key];
                    return clean;
                 };
                 
                 if (fc.name === 'update_status' && actions.onUpdateStatus) {
                    const s = (fc.args as any).status;
                    actions.onUpdateStatus(s);
                    result = { result: `Status is now ${s}` };
                 } else if (fc.name === 'check_wallet') {
                    result = { result: `Balance: ${user?.walletBalance || 0} cedis.` };
                 } else if (fc.name === 'get_revenue_report') {
                     const total = contextData.transactions?.reduce((a, b) => a + b.amount, 0) || 0;
                     result = { result: `Revenue: ${total.toFixed(2)}.` };
                 } else if (fc.name === 'system_health_check') {
                     result = { result: `Drivers: ${contextData.drivers.length}. Rides: ${contextData.nodes.length}.` };
                 } else if (fc.name === 'fill_ride_form' && actions.onFillRideForm) {
                     actions.onFillRideForm(cleanArgs(fc.args));
                     result = { result: "Updated." };
                 } else if (fc.name === 'confirm_ride' && actions.onConfirmRide) {
                     actions.onConfirmRide();
                     result = { result: "Requested." };
                 } else if (fc.name === 'fill_auth_details' && actions.onFillAuth) {
                     actions.onFillAuth(cleanArgs(fc.args));
                     result = { result: "Form updated." };
                 }

                 session.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: result }
                 });
              }
            }
          },
          onclose: () => setIsActive(false),
          onerror: (e) => {
             setState('error');
             vibrate([100, 50, 100]);
             setTimeout(() => setIsActive(false), 2000);
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (e: any) {
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
        className={`fixed bottom-24 left-6 lg:bottom-12 lg:left-12 z-[500] w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all ${isActive ? 'bg-rose-500 scale-110 animate-pulse' : `bg-gradient-to-tr ${getOrbColor()}`}`}
      >
        <i className={`fas ${isActive ? 'fa-microphone-slash' : 'fa-microphone'} text-white text-2xl`}></i>
      </button>

      {isActive && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[450] flex flex-col items-center justify-center animate-in fade-in duration-300">
           <canvas ref={canvasRef} width={400} height={400} className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px]" />
           <div className="mt-8 text-center px-4">
              <h3 className="text-2xl font-black italic uppercase text-white tracking-widest animate-pulse">
                {state === 'connecting' ? 'Link Start...' : state === 'listening' ? 'Mepaakyɛw...' : state === 'speaking' ? 'Kofi AI' : '...'}
              </h3>
              <p className="text-xs font-bold opacity-70 uppercase mt-2 tracking-[0.2em]" style={{ color: mode === 'admin' ? '#f43f5e' : '#94a3b8' }}>
                Ultra-Low Latency Mode Active
              </p>
           </div>
           <button onClick={toggleSession} className="mt-12 px-8 py-3 bg-white/10 rounded-full text-white font-black uppercase text-xs hover:bg-white/20 transition-all">End Call</button>
        </div>
      )}
    </>
  );
};
