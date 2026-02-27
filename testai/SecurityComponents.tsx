import React, { useState, useEffect } from 'react';

interface SecurityQuestion {
  id: string;
  question: string;
  is_active: boolean;
}

interface ForgotPasswordProps {
  userType: 'user' | 'driver' | 'admin';
  onBack: () => void;
  onSuccess: () => void;
  supabase: any;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordProps> = ({ 
  userType, 
  onBack, 
  onSuccess,
  supabase
}) => {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [questions, setQuestions] = useState<SecurityQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      const { data } = await supabase
        .from('security_questions')
        .select('*')
        .eq('is_active', true);
      
      if (data) {
        setQuestions(data);
      }
    };

    fetchQuestions();
  }, [supabase]);

  const handleLookupUser = async () => {
    if (!phone) {
      alert('Please enter your phone number');
      return;
    }

    setLoading(true);
    try {
      const tableName = userType === 'driver' ? 'unihub_drivers' : 'unihub_users';
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(userType === 'driver' ? 'id' : 'phone', phone)
        .maybeSingle();

      if (error || !data) {
        alert('Account not found. Please check your phone number.');
        setLoading(false);
        return;
      }

      // Check if user has security questions set up
      const answerTable = userType === 'driver' ? 'driver_security_answers' : 'user_security_answers';
      const { data: answers } = await supabase
        .from(answerTable)
        .select('question_id')
        .eq(userType === 'driver' ? 'driver_id' : 'user_id', phone);

      if (!answers || answers.length === 0) {
        alert('No security questions found for this account. Please contact support.');
        setLoading(false);
        return;
      }

      setStep(2);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswer = async () => {
    if (!selectedQuestion || !answer) {
      alert('Please select a security question and provide an answer.');
      return;
    }

    setLoading(true);
    try {
      const functionName = userType === 'driver' 
        ? 'verify_driver_security_answer_and_reset_pin' 
        : 'verify_security_answer_and_reset_pin';
      
      const { data, error } = await supabase.rpc(functionName, {
        p_user_id: phone,
        p_question_id: selectedQuestion,
        p_answer: answer,
        p_new_pin: newPin
      });

      if (error) {
        alert(`Error: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data && data[0] && data[0].success) {
        setStep(3);
      } else {
        alert(data[0]?.message || 'Security answer verification failed');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (!newPin || !confirmPin) {
      alert('Please enter and confirm your new PIN');
      return;
    }

    if (newPin.length !== 4) {
      alert('PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      alert('PINs do not match');
      return;
    }

    await handleVerifyAnswer();
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-black text-white">Find Your Account</h3>
      <p className="text-sm text-slate-400">
        Enter your {userType === 'driver' ? 'Driver ID' : 'phone number'} to locate your account
      </p>
      <input
        type="text"
        placeholder={userType === 'driver' ? 'Driver ID' : 'Phone Number'}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
      />
      <button
        onClick={handleLookupUser}
        disabled={loading}
        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? 'Searching...' : 'Continue'}
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-black text-white">Verify Your Identity</h3>
      <p className="text-sm text-slate-400">
        Answer your security question to reset your PIN
      </p>
      <select
        value={selectedQuestion}
        onChange={(e) => setSelectedQuestion(e.target.value)}
        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-emerald-500"
      >
        <option value="">Select a security question</option>
        {questions.map((q) => (
          <option key={q.id} value={q.id}>
            {q.question}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Your answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
      />
      <input
        type="password"
        placeholder="New 4-digit PIN"
        value={newPin}
        onChange={(e) => setNewPin(e.target.value)}
        maxLength={4}
        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
      />
      <input
        type="password"
        placeholder="Confirm new PIN"
        value={confirmPin}
        onChange={(e) => setConfirmPin(e.target.value)}
        maxLength={4}
        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
      />
      <button
        onClick={handleResetPin}
        disabled={loading}
        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? 'Verifying...' : 'Reset PIN'}
      </button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4 text-center">
      <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <i className="fas fa-check text-white text-2xl"></i>
      </div>
      <h3 className="text-lg font-black text-white">PIN Reset Successful!</h3>
      <p className="text-sm text-slate-400">
        Your PIN has been updated. You can now login with your new 4-digit PIN.
      </p>
      <button
        onClick={onSuccess}
        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700"
      >
        Back to Login
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl p-6 border border-white/10 relative">
        <button
          onClick={onBack}
          className="absolute top-4 right-4 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
        >
          <i className="fas fa-times text-sm"></i>
        </button>
        
        <div className="mb-6">
          <h2 className="text-xl font-black text-white mb-2">
            Reset {userType === 'driver' ? 'Driver' : 'User'} PIN
          </h2>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
};
