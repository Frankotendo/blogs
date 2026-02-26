import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

interface SecurityQuestion {
  id: string;
  question: string;
  is_active: boolean;
}

interface ForgotPasswordProps {
  userType: 'user' | 'driver' | 'admin';
  onBack: () => void;
  onSuccess: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordProps> = ({ 
  userType, 
  onBack, 
  onSuccess 
}) => {
  const [step, setStep] = useState<'identify' | 'questions' | 'reset'>('identify');
  const [identifier, setIdentifier] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    loadSecurityQuestions();
  }, []);

  const loadSecurityQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('security_questions')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setSecurityQuestions(data || []);
    } catch (err) {
      console.error('Error loading security questions:', err);
    }
  };

  const handleIdentitySubmit = async () => {
    setLoading(true);
    setError('');

    try {
      let query;
      if (userType === 'user') {
        query = supabase
          .from('unihub_users')
          .select('*')
          .or(`phone.eq.${identifier},username.eq.${identifier}`)
          .single();
      } else if (userType === 'driver') {
        query = supabase
          .from('unihub_drivers')
          .select('*')
          .or(`contact.eq.${identifier},email.eq.${identifier},name.eq.${identifier}`)
          .single();
      } else {
        query = supabase
          .from('unihub_settings')
          .select('*')
          .eq('adminSecret', identifier)
          .single();
      }

      const { data, error } = await query;

      if (error || !data) {
        setError('Account not found. Please check your identifier.');
        return;
      }

      setUserId(data.id);
      setStep('questions');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityQuestionSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.rpc('verify_security_answer', {
        p_user_id: userId,
        p_question_id: selectedQuestion,
        p_answer: answer,
        p_user_type: userType
      });

      if (error) throw error;

      if (!data[0]?.success) {
        setError('Incorrect security answer. Please try again.');
        return;
      }

      setStep('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let updateQuery;
      if (userType === 'user') {
        updateQuery = supabase
          .from('unihub_users')
          .update({ 
            password: newPassword,
            failed_attempts: 0,
            locked_until: null
          })
          .eq('id', userId);
      } else if (userType === 'driver') {
        updateQuery = supabase
          .from('unihub_drivers')
          .update({ 
            password: newPassword,
            failed_attempts: 0,
            locked_until: null
          })
          .eq('id', userId);
      } else {
        updateQuery = supabase
          .from('unihub_settings')
          .update({ adminSecret: newPassword })
          .eq('id', 1);
      }

      const { error } = await updateQuery;

      if (error) throw error;

      // Log successful password reset
      await supabase.rpc('log_login_attempt', {
        p_identifier: identifier,
        p_attempt_type: `${userType}_password_reset`,
        p_status: 'success',
        p_ip_address: '127.0.0.1',
        p_user_agent: navigator.userAgent
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderIdentifyStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">
        Reset {userType === 'admin' ? 'Admin' : userType === 'driver' ? 'Driver' : 'User'} Password
      </h3>
      
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">
          {userType === 'admin' ? 'Admin Secret' : 
           userType === 'driver' ? 'Contact, Email, or Name' : 
           'Phone or Username'}
        </label>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={userType === 'admin' ? 'Enter admin secret' : 
                     userType === 'driver' ? 'Contact, email, or name' : 
                     'Phone or username'}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleIdentitySubmit}
          disabled={loading || !identifier}
          className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Verifying...' : 'Continue'}
        </button>
      </div>
    </div>
  );

  const renderQuestionsStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">
        Security Question
      </h3>
      
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">
          Select Security Question
        </label>
        <select
          value={selectedQuestion}
          onChange={(e) => setSelectedQuestion(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Choose a question...</option>
          {securityQuestions.map((q) => (
            <option key={q.id} value={q.id} className="bg-slate-800">
              {q.question}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">
          Your Answer
        </label>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Enter your answer"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setStep('identify')}
          className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSecurityQuestionSubmit}
          disabled={loading || !selectedQuestion || !answer}
          className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify Answer'}
        </button>
      </div>
    </div>
  );

  const renderResetStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">
        Set New Password
      </h3>
      
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">
          New Password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Enter new password"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setStep('questions')}
          className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handlePasswordReset}
          disabled={loading || !newPassword || !confirmPassword}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
        {step === 'identify' && renderIdentifyStep()}
        {step === 'questions' && renderQuestionsStep()}
        {step === 'reset' && renderResetStep()}
      </div>
    </div>
  );
};

// Passenger Tracking Component
interface PassengerTrackingProps {
  onClose: () => void;
}

export const PassengerTrackingModal: React.FC<PassengerTrackingProps> = ({ onClose }) => {
  const [passengers, setPassengers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPassenger, setSelectedPassenger] = useState<any | null>(null);

  useEffect(() => {
    loadPassengerLocations();
  }, []);

  const loadPassengerLocations = async () => {
    try {
      // Get all active rides with passengers
      const { data: rides, error: ridesError } = await supabase
        .from('unihub_nodes')
        .select('*')
        .in('status', ['forming', 'qualified', 'dispatched']);

      if (ridesError) throw ridesError;

      // Get passenger locations
      const { data: locations, error: locationsError } = await supabase
        .from('passenger_locations')
        .select('*');

      if (locationsError) throw locationsError;

      // Combine passenger data with locations
      const allPassengers = rides?.flatMap(ride => 
        ride.passengers.map((passenger: any) => ({
          ...passenger,
          ride_id: ride.id,
          origin: ride.origin,
          destination: ride.destination,
          status: ride.status
        }))
      ) || [];

      // Add location data
      const passengersWithLocations = allPassengers.map(passenger => {
        const location = locations?.find(loc => loc.passenger_id === passenger.id);
        return {
          ...passenger,
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            last_updated: location.last_updated
          } : null
        };
      });

      setPassengers(passengersWithLocations);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = (latitude: number, longitude: number, name: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    window.open(url, '_blank');
  };

  const getDirections = (passenger: any) => {
    if (!passenger.location) return;
    
    // Get driver's current location (you'd need to implement this)
    const driverLat = 5.6037; // Example driver location
    const driverLng = -0.1869;
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${driverLat},${driverLng}&destination=${passenger.location.latitude},${passenger.location.longitude}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 rounded-2xl p-6 max-w-2xl w-full border border-white/10">
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">Loading passenger locations...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 rounded-2xl p-6 max-w-4xl w-full border border-white/10 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Passenger Location Tracking</h3>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg mb-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="grid gap-4">
          {passengers.map((passenger, index) => (
            <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-white">{passenger.name || 'Passenger'}</h4>
                  <p className="text-sm text-slate-400">{passenger.phone}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="px-2 py-1 bg-indigo-600/20 text-indigo-400 text-xs rounded-full">
                      {passenger.status}
                    </span>
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full">
                      {passenger.ride_id}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Route</p>
                  <p className="text-sm text-white">{passenger.origin} → {passenger.destination}</p>
                </div>
              </div>

              {passenger.location ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => openInMaps(passenger.location.latitude, passenger.location.longitude, passenger.name)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <i className="fas fa-map-marker-alt mr-2"></i>
                    View Location
                  </button>
                  <button
                    onClick={() => getDirections(passenger)}
                    className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <i className="fas fa-directions mr-2"></i>
                    Get Directions
                  </button>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-slate-400 text-sm">Location not available</p>
                </div>
              )}

              {passenger.location && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-slate-400">
                    Last updated: {new Date(passenger.location.last_updated).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ))}

          {passengers.length === 0 && (
            <div className="text-center py-8">
              <i className="fas fa-users text-4xl text-slate-600 mb-4"></i>
              <p className="text-slate-400">No active passengers found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
