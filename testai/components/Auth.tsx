
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, UniUser } from '../types';
import { verifyBiometricMatch, compressImage, hashPin } from '../lib/utils';
import { supabase } from '../lib/clients';

export const HubGateway = ({ 
  onIdentify, 
  settings, 
  formState, 
  setFormState,
  onTriggerVoice 
}: { 
  onIdentify: (username: string, phone: string, pin: string, mode: 'login' | 'signup', plainPin?: string) => void, 
  settings: AppSettings,
  formState: { username: string, phone: string, pin: string, mode: 'login' | 'signup', agreedToTerms: boolean },
  setFormState: any,
  onTriggerVoice: () => void
}) => {
  const [authStage, setAuthStage] = useState<'initial' | 'otp' | 'biometric'>('initial');
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (isCameraOpen && cameraStream && videoRef.current) {
        videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraOpen, cameraStream]);

  // Countdown for resending OTP
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleInitialSubmit = async () => {
    if (!formState.phone || !formState.pin) { alert("Please fill all fields."); return; }
    if (formState.mode === 'signup') {
        if (!formState.agreedToTerms) { alert("You must agree to the Safety Protocol to join."); return; }
        if (!capturedImage) { alert("Live selfie required for security profile."); return; }
        const hashedPin = await hashPin(formState.pin);
        onIdentify(formState.username, formState.phone, hashedPin, 'signup');
        setTimeout(async () => { await supabase.from('unihub_users').update({ biometric_url: capturedImage }).eq('phone', formState.phone); }, 1000);
    } else {
        generateAndShowOtp();
    }
  };

  const generateAndShowOtp = () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setAuthStage('otp');
      setResendTimer(30); // 30 seconds cooldown
      
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-4 rounded-2xl shadow-2xl z-[9999] animate-in slide-in-from-top flex items-center gap-4 border border-slate-200';
      toast.innerHTML = `<div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white"><i class="fas fa-message"></i></div><div><p class="text-[10px] font-bold uppercase text-slate-500">MESSAGES • NOW</p><p class="font-bold text-lg">NexRyde Code: <span class="tracking-widest">${code}</span></p></div>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 6000);
  };

  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 400, height: 400 } });
          setCameraStream(stream);
          setIsCameraOpen(true);
      } catch (err) { alert("Camera denied. Please check permissions."); }
  };

  const capturePhoto = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const context = canvasRef.current.getContext('2d');
      if (context) {
          context.drawImage(videoRef.current, 0, 0, 300, 300);
          const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
          setCapturedImage(dataUrl);
          setIsCameraOpen(false);
          cameraStream?.getTracks().forEach(t => t.stop());
          if (authStage === 'biometric') verifyFace(dataUrl);
      }
  };

  const verifyFace = async (liveImage: string) => {
      setIsVerifying(true);
      setStatusMessage("Analyzing facial features...");
      const { data: user } = await supabase.from('unihub_users').select('biometric_url').eq('phone', formState.phone).single();
      if (!user || !user.biometric_url) {
          await supabase.from('unihub_users').update({ biometric_url: liveImage }).eq('phone', formState.phone);
          const hashedPin = await hashPin(formState.pin);
          onIdentify(formState.username, formState.phone, hashedPin, 'login', formState.pin);
          return;
      }
      const analysis = await verifyBiometricMatch(liveImage, user.biometric_url);
      if (analysis.match && analysis.confidence > 70) {
          setBiometricStatus('success');
          const hashedPin = await hashPin(formState.pin);
          onIdentify(formState.username, formState.phone, hashedPin, 'login', formState.pin);
      } else {
          setBiometricStatus('failed');
          setStatusMessage(`Mismatch: ${analysis.reason}`);
          setIsVerifying(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4 relative overflow-hidden">
      <canvas ref={canvasRef} width="300" height="300" className="hidden" />
      <div className="glass-bright w-full max-w-md p-8 rounded-[3rem] border border-white/10 relative z-10 animate-in zoom-in">
        <div className="text-center mb-8">
          <img src={settings.appLogo || "https://api.dicebear.com/7.x/shapes/svg?seed=nexryde"} className="w-20 h-20 object-contain mx-auto mb-4" alt="Logo" />
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">NexRyde</h1>
          <p className="text-xs font-black text-amber-500 uppercase tracking-widest mt-2">Transit Identity Hub</p>
        </div>

        {authStage === 'initial' && (
            <div className="space-y-4">
                {formState.mode === 'signup' && (
                    <div className="space-y-4">
                        <input value={formState.username} onChange={e => setFormState({...formState, username: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500" placeholder="Choose Username" />
                        
                        <div onClick={!isCameraOpen ? startCamera : undefined} className={`h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden relative ${capturedImage || isCameraOpen ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                            {isCameraOpen ? (
                                <>
                                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                                    <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
                                        <button onClick={(e) => { e.stopPropagation(); capturePhoto(); }} className="w-full py-2 bg-emerald-500 text-[#020617] rounded-xl font-black text-[10px] uppercase shadow-xl">Capture Profile</button>
                                    </div>
                                    <div className="scanner-line"></div>
                                </>
                            ) : capturedImage ? (
                                <>
                                    <img src={capturedImage} className="w-full h-full object-cover" />
                                    <button onClick={(e) => { e.stopPropagation(); setCapturedImage(null); startCamera(); }} className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full text-white flex items-center justify-center"><i className="fas fa-redo text-[10px]"></i></button>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-camera text-slate-400 mb-2 text-xl"></i>
                                    <span className="text-[9px] font-black uppercase text-slate-500">Live Identity Photo</span>
                                    <span className="text-[7px] text-slate-600 font-bold uppercase mt-1">Tap to Open Lens</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
                <input value={formState.phone} onChange={e => setFormState({...formState, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-indigo-500" placeholder="Phone Number" />
                <input value={formState.pin} type="password" maxLength={4} onChange={e => setFormState({...formState, pin: e.target.value.replace(/\D/g, '')})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold text-center tracking-widest focus:border-indigo-500" placeholder="4-Digit PIN" />
                
                {formState.mode === 'signup' && (
                    <div className="flex items-start gap-3 px-2 py-2">
                        <input type="checkbox" checked={formState.agreedToTerms} onChange={e => setFormState({...formState, agreedToTerms: e.target.checked})} className="mt-1 w-4 h-4 rounded border-white/10 bg-white/5" />
                        <p className="text-[9px] text-slate-400 font-bold uppercase leading-tight">I agree to the <span className="text-amber-500">NexRyde Safety & Privacy Protocol</span> and biometric verification.</p>
                    </div>
                )}

                <button onClick={handleInitialSubmit} disabled={isCameraOpen} className="w-full bg-amber-500 text-[#020617] py-4 rounded-2xl font-black text-xs uppercase shadow-xl disabled:opacity-50">{formState.mode === 'login' ? 'Continue' : 'Create Identity'}</button>
                <div className="mt-4 text-center"><button onClick={() => setFormState({...formState, mode: formState.mode === 'login' ? 'signup' : 'login'})} className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{formState.mode === 'login' ? 'Join NexRyde? Create Profile' : 'Already have a profile? Login'}</button></div>
            </div>
        )}

        {authStage === 'otp' && (
            <div className="text-center space-y-6">
                <div>
                  <p className="text-xs text-slate-400">Enter the 6-digit code sent to your handset.</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Verifying: {formState.phone}</p>
                </div>
                <input value={otpCode} onChange={e => setOtpCode(e.target.value.slice(0, 6).replace(/\D/g, ''))} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-6 text-white font-black text-3xl text-center tracking-[0.5em] outline-none focus:border-indigo-500" placeholder="000000" />
                <div className="space-y-3">
                  <button onClick={() => otpCode === generatedOtp ? setAuthStage('biometric') : alert('Invalid Code')} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-xl">Verify Code</button>
                  <button 
                    disabled={resendTimer > 0} 
                    onClick={generateAndShowOtp} 
                    className={`text-[10px] font-black uppercase tracking-widest ${resendTimer > 0 ? 'text-slate-600' : 'text-amber-500 hover:text-amber-400'}`}
                  >
                    {resendTimer > 0 ? `Resend Code in ${resendTimer}s` : 'Resend Digit Code'}
                  </button>
                </div>
                <button onClick={() => setAuthStage('initial')} className="text-[9px] font-black text-slate-500 uppercase underline">Change Number</button>
            </div>
        )}

        {authStage === 'biometric' && (
            <div className="text-center space-y-6">
                <div className="relative w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-emerald-500 shadow-2xl bg-black">
                    {isCameraOpen ? (
                        <>
                            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                            <div className="scanner-line"></div>
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            {capturedImage ? <img src={capturedImage} className="w-full h-full object-cover" /> : <i className="fas fa-face-viewfinder text-4xl text-slate-600"></i>}
                        </div>
                    )}
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-black text-white uppercase">{biometricStatus === 'idle' ? 'Bio-Verification' : biometricStatus === 'success' ? 'Authenticated' : 'Identity Mismatch'}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{statusMessage || "Align your face in the circle..."}</p>
                </div>
                {!isVerifying && (
                    <button onClick={isCameraOpen ? capturePhoto : startCamera} className="w-full bg-emerald-500 text-[#020617] py-4 rounded-2xl font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2">
                        <i className={isCameraOpen ? "fas fa-camera" : "fas fa-face-viewfinder"}></i>
                        {isCameraOpen ? 'Authenticate Now' : 'Initialize Face-ID'}
                    </button>
                )}
                {biometricStatus === 'failed' && <button onClick={() => setAuthStage('initial')} className="text-[10px] font-black text-slate-500 uppercase underline">Back to Login</button>}
            </div>
        )}
      </div>
    </div>
  );
};
