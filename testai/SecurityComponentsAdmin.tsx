import React, { useState, useEffect } from 'react';

interface ForgotPasswordProps {
  userType: 'user' | 'driver';
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
  const [identifier, setIdentifier] = useState(''); // phone for users, ID for drivers
  const [loading, setLoading] = useState(false);
  const [existingRequest, setExistingRequest] = useState<any>(null);

  useEffect(() => {
    // Check if there's already a pending request when component mounts
    if (identifier) {
      checkExistingRequest();
    }
  }, [identifier]);

  const checkExistingRequest = async () => {
    if (!identifier) return;
    
    try {
      const { data, error } = await supabase.rpc('check_pending_reset_request', {
        p_user_id: identifier,
        p_user_type: userType
      });

      if (error) throw error;
      
      if (data && data[0]?.has_pending) {
        setExistingRequest(data[0]);
        setStep(3); // Show pending status
      }
    } catch (error) {
      console.error('Error checking existing request:', error);
    }
  };

  const handleSubmitRequest = async () => {
    if (!identifier) {
      alert(`Please enter your ${userType === 'driver' ? 'Driver ID' : 'phone number'}`);
      return;
    }

    setLoading(true);
    try {
      // Get user info for the request
      let userInfo = null;
      if (userType === 'user') {
        const { data, error } = await supabase
          .from('unihub_users')
          .select('id, name, phone')
          .eq('phone', identifier)
          .single();
        
        if (error) throw error;
        userInfo = data;
      } else {
        const { data, error } = await supabase
          .from('unihub_drivers')
          .select('id, name, contact')
          .eq('id', identifier)
          .single();
        
        if (error) throw error;
        userInfo = { ...data, phone: data.contact };
      }

      if (!userInfo) {
        alert(`${userType === 'driver' ? 'Driver' : 'User'} not found`);
        return;
      }

      // Create PIN reset request
      const { data, error } = await supabase.rpc('create_pin_reset_request', {
        p_user_type: userType,
        p_user_id: userInfo.id,
        p_user_name: userInfo.name,
        p_user_phone: userInfo.phone,
        p_request_reason: `${userType} requested PIN reset via web form`
      });

      if (error) throw error;

      if (data && data[0]?.success) {
        setStep(2); // Show confirmation
      } else {
        alert(data[0]?.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Error submitting PIN reset request');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-key text-white text-2xl"></i>
        </div>
        <h3 className="text-lg font-black text-white mb-2">Reset {userType === 'driver' ? 'Driver' : 'User'} PIN</h3>
        <p className="text-sm text-slate-400">
          Request a PIN reset. An admin will review and approve your request.
        </p>
      </div>

      <div>
        <label className="block text-sm font-black text-white mb-2">
          {userType === 'driver' ? 'Driver ID' : 'Phone Number'}
        </label>
        <input
          type={userType === 'driver' ? 'text' : 'tel'}
          placeholder={userType === 'driver' ? 'Enter your Driver ID' : 'Enter your phone number'}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />
      </div>

      <button
        onClick={handleSubmitRequest}
        disabled={loading}
        className="w-full py-3 bg-amber-600 text-white rounded-xl font-black text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
        ) : (
          'Request PIN Reset'
        )}
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4 text-center">
      <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <i className="fas fa-clock text-white text-2xl"></i>
      </div>
      <h3 className="text-lg font-black text-white">Request Submitted!</h3>
      <p className="text-sm text-slate-400 mb-4">
        Your PIN reset request has been submitted to the admin team.
      </p>
      <div className="bg-slate-800 rounded-lg p-4 text-left">
        <p className="text-xs text-slate-400 mb-2">What happens next:</p>
        <ul className="text-xs text-white space-y-1">
          <li>• Admin will review your request</li>
          <li>• You'll receive a temporary PIN if approved</li>
          <li>• Check back later for status updates</li>
        </ul>
      </div>
      <button
        onClick={onBack}
        className="w-full py-3 bg-slate-700 text-white rounded-xl font-black text-sm hover:bg-slate-600 transition-colors"
      >
        Back to Login
      </button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4 text-center">
      <div className="w-16 h-16 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
        <i className="fas fa-hourglass-half text-white text-2xl"></i>
      </div>
      <h3 className="text-lg font-black text-white">Request Pending</h3>
      <p className="text-sm text-slate-400 mb-4">
        You already have a pending PIN reset request.
      </p>
      {existingRequest && (
        <div className="bg-slate-800 rounded-lg p-4 text-left">
          <p className="text-xs text-slate-400 mb-2">Request Details:</p>
          <p className="text-xs text-white">
            Requested: {new Date(existingRequest.requested_at).toLocaleString()}
          </p>
        </div>
      )}
      <button
        onClick={onBack}
        className="w-full py-3 bg-slate-700 text-white rounded-xl font-black text-sm hover:bg-slate-600 transition-colors"
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
            Admin PIN Reset
          </h2>
          <p className="text-sm text-slate-400">
            {userType === 'driver' ? 'Driver' : 'User'} PIN Management
          </p>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
};
