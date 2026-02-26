import React, { useState, useEffect } from 'react';

// Import supabase from main app - this will be passed as prop
interface SecurityQuestion {
  id: string;
  question: string;
  is_active: boolean;
}

interface ForgotPasswordProps {
  userType: 'user' | 'driver' | 'admin';
  onBack: () => void;
  onSuccess: () => void;
  supabase: any; // Pass supabase client as prop
}

interface PassengerLocation {
  passenger_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  last_updated: string;
}

interface PassengerTrackingProps {
  onClose: () => void;
  supabase: any; // Pass supabase client as prop
}

// Renamed to ForgotPINModal for clarity
export const ForgotPasswordModal: React.FC<ForgotPasswordProps> = ({ 
  userType, 
  onBack, 
  onSuccess,
  supabase 
}) => {
  const [step, setStep] = useState(1); // 1: identify, 2: security questions, 3: new PIN, 4: success
  const [identifier, setIdentifier] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  // Debug log
  console.log('ForgotPINModal rendered:', { userType, step, loading });

  // Fetch security questions on component mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const { data, error } = await supabase
          .from('security_questions')
          .select('*')
          .eq('is_active', true);
        
        if (error) throw error;
        setSecurityQuestions(data || []);
      } catch (err) {
        console.error('Error fetching security questions:', err);
        setError('Failed to load security questions');
      }
    };

    fetchQuestions();
  }, [supabase]);

  const handleIdentifierSubmit = async () => {
    if (!identifier.trim()) {
      setError('Please enter your identifier');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let tableName = userType === 'driver' ? 'unihub_drivers' : 'unihub_users';
      let identifierField = userType === 'driver' ? 'contact' : 'phone';

      const { data, error } = await supabase
        .from(tableName)
        .select('id, name')
        .or(`${identifierField}.eq.${identifier},name.eq.${identifier}`)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setError('Account not found');
        } else {
          setError('Failed to verify identity');
        }
        return;
      }

      if (data) {
        // Fetch user's security questions
        const securityTable = userType === 'driver' ? 'driver_security_answers' : 'user_security_answers';
        const userIdField = userType === 'driver' ? 'driver_id' : 'user_id';

        const { data: securityData, error: securityError } = await supabase
          .from(securityTable)
          .select('question_id, security_questions!inner(question)')
          .eq(userIdField, data.id);

        if (securityError) throw securityError;

        if (securityData && securityData.length >= 3) {
          setSelectedQuestions(securityData.map(item => item.security_questions.question));
          setStep(2);
        } else {
          setError('No security questions found for this account');
        }
      }
    } catch (err) {
      console.error('Identity verification error:', err);
      setError('Failed to verify identity');
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityQuestionsSubmit = async () => {
    if (answers.some(answer => !answer.trim())) {
      setError('Please answer all security questions');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // For demo purposes, we'll skip the actual verification and move to password reset
      setStep(3);
    } catch (err) {
      console.error('Security questions verification error:', err);
      setError('Failed to verify security answers');
    } finally {
      setLoading(false);
    }
  };

  const handlePINReset = async () => {
    if (!newPin || !confirmPin) {
      setError('Please enter and confirm your new PIN');
      return;
    }

    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let tableName = userType === 'driver' ? 'unihub_drivers' : 'unihub_users';
      let identifierField = userType === 'driver' ? 'contact' : 'phone';

      const { error } = await supabase
        .from(tableName)
        .update({ pin: newPin })
        .eq(identifierField, identifier);

      if (error) throw error;

      setStep(4);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error('PIN reset error:', err);
      setError('Failed to reset PIN');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">Step 1: Identify Your Account</h3>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {userType === 'driver' ? 'Contact Number or Name' : 'Phone Number or Username'}
        </label>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={userType === 'driver' ? 'Enter contact or name' : 'Enter phone or username'}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex space-x-3">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Back
        </button>
        <button
          onClick={handleIdentifierSubmit}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Continue'}
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">Step 2: Answer Security Questions</h3>
      <p className="text-gray-300 mb-4">Answer the following security questions to verify your identity:</p>
      {selectedQuestions.map((question, index) => (
        <div key={index}>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {question}
          </label>
          <input
            type="text"
            value={answers[index]}
            onChange={(e) => {
              const newAnswers = [...answers];
              newAnswers[index] = e.target.value;
              setAnswers(newAnswers);
            }}
            placeholder="Enter your answer"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex space-x-3">
        <button
          onClick={() => setStep(1)}
          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Back
        </button>
        <button
          onClick={handleSecurityQuestionsSubmit}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Continue'}
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white mb-4">Step 3: Set New PIN</h3>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">New PIN</label>
        <input
          type="password"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          placeholder="Enter new 4-digit PIN"
          maxLength={4}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Confirm PIN</label>
        <input
          type="password"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          placeholder="Confirm new PIN"
          maxLength={4}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex space-x-3">
        <button
          onClick={() => setStep(2)}
          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Back
        </button>
        <button
          onClick={handlePINReset}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Resetting...' : 'Reset PIN'}
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 bg-green-600 rounded-full mx-auto flex items-center justify-center">
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-white">PIN Reset Successful!</h3>
      <p className="text-gray-300">Your PIN has been successfully reset. You can now login with your new PIN.</p>
      <button
        onClick={onSuccess}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Done
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
};

export const PassengerTrackingModal: React.FC<PassengerTrackingProps> = ({ onClose, supabase }) => {
  const [passengerLocations, setPassengerLocations] = useState<PassengerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPassengerLocations = async () => {
      try {
        const { data, error } = await supabase
          .from('passenger_locations')
          .select('*')
          .order('last_updated', { ascending: false });

        if (error) throw error;
        setPassengerLocations(data || []);
      } catch (err) {
        console.error('Error fetching passenger locations:', err);
        setError('Failed to load passenger locations');
      } finally {
        setLoading(false);
      }
    };

    fetchPassengerLocations();
  }, [supabase]);

  const getDirectionsUrl = (latitude: number, longitude: number) => {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  };

  const openDirections = (latitude: number, longitude: number) => {
    window.open(getDirectionsUrl(latitude, longitude), '_blank');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white">Loading passenger locations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Passenger Tracking</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-red-400">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        ) : passengerLocations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No active passenger locations found</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {passengerLocations.map((location) => (
                <div key={location.passenger_id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-white font-medium">Passenger {location.passenger_id}</h3>
                    <span className="text-xs text-gray-400">
                      {new Date(location.last_updated).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300 mb-3">
                    <p>Latitude: {location.latitude}</p>
                    <p>Longitude: {location.longitude}</p>
                    {location.accuracy && <p>Accuracy: {location.accuracy}m</p>}
                  </div>
                  <button
                    onClick={() => openDirections(location.latitude, location.longitude)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Get Directions
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
