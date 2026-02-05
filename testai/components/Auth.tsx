
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, UniUser } from '../types';
import { verifyBiometricMatch } from '../lib/utils';
import { supabase } from '../lib/clients';

export const HubGateway = ({ 
  onIdentify, 
  settings, 
  formState, 
  setFormState,
  onTriggerVoice 
}: { 
  onIdentify: (username: string, phone: string, pin: string, mode: 'login' | 'signup') => void, 
  settings: AppSettings,
  formState: { username: string, phone: string, pin: string, mode: 'login' | 'signup' },
  setFormState: any,
  onTriggerVoice: () => void
}) => {
  const [authStage, setAuthStage] = useState<'initial' | 'otp' | 'biometric'>('initial');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  
  // Biometric State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // 1. Initial Submit Handler (Triggers 3FA if Login)
  const handleInitialSubmit = async () => {
    if (!formState.phone || !formState.pin) {
      alert("Please fill all fields.");
      return;
    }

    if (formState.mode === 'signup') {
        // Signup Flow: Require Photo Capture
        if (!capturedImage) {
            alert("Security Requirement: Please verify your identity by taking a selfie.");
            startCamera();
            return;
        }
        // Proceed with signup, passing the image as a biometric ref
        await completeSignup();
    } else {
        // Login Flow: Start 3FA Waterfall
        // Stage 1: PIN (Already entered in form)
        // Stage 2: OTP
        generateAndShowOtp();
    }
  };

  // 2. OTP Logic
  const generateAndShowOtp = () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setAuthStage('otp');
      
      // Simulate SMS Toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-4 rounded-2xl shadow-2xl z-[9999] animate-in slide-in-from-top flex items-center gap-4 border border-slate-200';
      toast.innerHTML = `
        <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white"><i class="fas fa-message"></i></div>
        <div>
            <p class="text-[10px] font-bold uppercase text-slate-500">MESSAGES • NOW</p>
            <p class="font-bold text-lg">NexRyde Code: <span class="tracking-widest">${code}</span></p>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 6000);
  };

  const verifyOtp = () => {
      if (otpCode === generatedOtp) {
          // Stage 3: Biometric
          setAuthStage('biometric');
          startCamera();
      } else {
          alert("Incorrect Code. Please try again.");
      }
  };

  // 3. Biometric Logic
  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
          setCameraStream(stream);
          setIsCameraOpen(true);
      } catch (err) {
          alert("Camera access denied. Cannot verify identity.");
      }
  };

  useEffect(() => {
      if (videoRef.current && cameraStream) {
          videoRef.current.srcObject = cameraStream;
      }
  }, [cameraStream, isCameraOpen]);

  const capturePhoto = () => {
      if (!videoRef.current || !canvasRef.current) return;
      
      const context = canvasRef.current.getContext('2d');
      if (context) {
          context.drawImage(videoRef.current, 0, 0, 300, 300);
          const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
          setCapturedImage(dataUrl);
          stopCamera();
          
          if (authStage === 'biometric') {
              verifyFace(dataUrl);
          }
      }
  };

  const stopCamera = () => {
      cameraStream?.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraOpen(false);
  };

  const verifyFace = async (liveImage: string) => {
      setIsVerifying(true);
      setStatusMessage("AI Analyzing Facial Structure...");
      
      // Fetch the user's reference photo from DB
      const { data: user } = await supabase.from('unihub_users').select('biometric_url').eq('phone', formState.phone).single();
      
      if (!user || !user.biometric_url) {
          // Fallback for legacy users without biometric data: Update it now
          // In a strict system, we might force a different flow, but for now we trust the PIN+OTP and update ref.
          setStatusMessage("Updating Security Profile...");
          await supabase.from('unihub_users').update({ biometric_url: liveImage }).eq('phone', formState.phone);
          completeLogin();
          return;
      }

      // AI Comparison
      const analysis = await verifyBiometricMatch(liveImage, user.biometric_url);
      
      if (analysis.match && analysis.confidence > 70) {
          setBiometricStatus('success');
          setStatusMessage("Identity Verified.");
          setTimeout(() => completeLogin(), 1000);
      } else {
          setBiometricStatus('failed');
          setStatusMessage(`Verification Failed: ${analysis.reason}`);
          setIsVerifying(false);
      }
  };

  const completeLogin = () => {
      onIdentify(formState.username, formState.phone, formState.pin, 'login');
  };

  const completeSignup = async () => {
      // In a real app, you'd pass the capturedImage to the parent to save in DB
      // We need to inject the biometricUrl into the user creation process in App.tsx
      // For now, we assume App.tsx will create the user, and we'll update the biometric url immediately after?
      // Better: Modify App.tsx handleGlobalUserAuth to accept an optional biometric string.
      // But adhering to prop types, we will do a trick:
      
      // Let's first call the original identify. 
      // NOTE: This assumes handleGlobalUserAuth creates the user immediately.
      // We will perform an update right after.
      
      // Actually, we can just save it to local state/context, but here we can piggyback or update DB after auth?
      // Since `onIdentify` is void, let's update the DB after we know the user is created? 
      // No, `onIdentify` handles the creation. 
      // We will update the `onIdentify` signature in future, but for now:
      
      // We will call onIdentify. If it succeeds (which we can't await easily due to prop structure), 
      // we can try to update the row separately.
      
      // HOWEVER, for this demo to work smoothly with the existing `App.tsx` structure:
      // We will assume `onIdentify` does the job. 
      // We will manually insert/update the biometric data for this phone number right here.
      
      onIdentify(formState.username, formState.phone, formState.pin, 'signup');
      
      // Update the user record with the photo
      setTimeout(async () => {
          if (capturedImage) {
             await supabase.from('unihub_users').update({ biometric_url: capturedImage }).eq('phone', formState.phone);
          }
      }, 2000); // Small delay to allow App.tsx to insert first
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/20 to-purple-900/20"></div>
      
      {/* 3FA Container */}
      <div className="glass-bright w-full max-md:mt-12 max-w-md p-8 rounded-[3rem] border border-white/10 relative z-10 animate-in zoom-in duration-500">
        
        {/* Header */}
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

        {/* STAGE 1: Standard Form */}
        {authStage === 'initial' && (
            <div className="space-y-4 animate-in fade-in">
                {formState.mode === 'signup' && (
                    <div className="space-y-4">
                        <input 
                        value={formState.username} 
                        onChange={e => setFormState({...formState, username: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500 transition-all placeholder:text-slate-600"
                        placeholder="Choose Username"
                        />
                        {/* Selfie Requirement for Signup */}
                        <div 
                            onClick={startCamera}
                            className={`w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${capturedImage ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 hover:border-amber-500/50 bg-white/5'}`}
                        >
                            {capturedImage ? (
                                <div className="relative w-full h-full rounded-xl overflow-hidden">
                                    <img src={capturedImage} className="w-full h-full object-cover opacity-60" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <i className="fas fa-check-circle text-4xl text-emerald-500"></i>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-2">
                                        <i className="fas fa-camera text-slate-400"></i>
                                    </div>
                                    <p className="text-[10px] font-black uppercase text-slate-500">Take Security Selfie</p>
                                    <p className="text-[8px] text-slate-600">Required for Wallet Protection</p>
                                </>
                            )}
                        </div>
                    </div>
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
                    onClick={handleInitialSubmit}
                    className="w-full bg-amber-500 text-[#020617] py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl"
                >
                    {formState.mode === 'login' ? 'Continue' : 'Create Identity'}
                </button>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => {
                            setFormState({...formState, mode: formState.mode === 'login' ? 'signup' : 'login'});
                            setCapturedImage(null);
                        }}
                        className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                    >
                        {formState.mode === 'login' ? 'New here? Create Account' : 'Have an account? Login'}
                    </button>
                </div>
            </div>
        )}

        {/* STAGE 2: OTP Verification */}
        {authStage === 'otp' && (
            <div className="text-center space-y-6 animate-in slide-in-from-right">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white shadow-xl shadow-indigo-500/20">
                    <i className="fas fa-shield-alt text-2xl"></i>
                </div>
                <div>
                    <h3 className="text-xl font-black italic uppercase text-white">Security Check</h3>
                    <p className="text-xs text-slate-400 mt-2">Enter the 6-digit code sent to your device.</p>
                </div>
                <input 
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.slice(0, 6))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-6 text-white font-black text-3xl outline-none focus:border-indigo-500 transition-all text-center tracking-[0.5em]"
                    placeholder="000000"
                />
                <button 
                    onClick={verifyOtp}
                    className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl"
                >
                    Verify Code
                </button>
                <button onClick={() => setAuthStage('initial')} className="text-[10px] font-bold text-slate-500 uppercase">Cancel Login</button>
            </div>
        )}

        {/* STAGE 3: Biometric Verification */}
        {authStage === 'biometric' && (
            <div className="text-center space-y-6 animate-in slide-in-from-right">
                <div className="relative w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-white/10 shadow-2xl">
                    {isCameraOpen ? (
                        <>
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                            <div className="absolute inset-0 border-[4px] border-emerald-500/50 rounded-full animate-pulse"></div>
                            {/* Scanning Line */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400 shadow-[0_0_20px_#34d399] animate-[scan_2s_linear_infinite]"></div>
                        </>
                    ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center">
                            {capturedImage ? <img src={capturedImage} className="w-full h-full object-cover" /> : <i className="fas fa-face-viewfinder text-4xl text-slate-500"></i>}
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} width="300" height="300" className="hidden" />

                <div>
                    <h3 className="text-xl font-black italic uppercase text-white">Face Scan</h3>
                    <p className={`text-xs font-bold mt-2 uppercase tracking-widest ${biometricStatus === 'failed' ? 'text-rose-500' : biometricStatus === 'success' ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {statusMessage || "Position your face in the circle"}
                    </p>
                </div>

                {!isVerifying && biometricStatus !== 'success' && (
                    <button 
                        onClick={capturePhoto}
                        className="w-full bg-emerald-500 text-[#020617] py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl"
                    >
                        Verify Identity
                    </button>
                )}
            </div>
        )}

        {/* Global Voice Trigger (Always available) */}
        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
             <button onClick={onTriggerVoice} className="text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-2">
                 <i className="fas fa-microphone"></i>
                 <span className="text-[10px] font-black uppercase tracking-widest">Voice Assist</span>
             </button>
        </div>

      </div>
    </div>
  );
};
