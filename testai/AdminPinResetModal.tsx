import React, { useState, useEffect } from 'react';

interface PinResetRequest {
  id: string;
  user_type: 'user' | 'driver';
  user_id: string;
  user_name: string;
  user_phone: string;
  request_reason: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

interface AdminPinResetModalProps {
  onRequestClose: () => void;
  supabase: any;
}

export const AdminPinResetModal: React.FC<AdminPinResetModalProps> = ({ 
  onRequestClose, 
  supabase 
}) => {
  const [requests, setRequests] = useState<PinResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<{[key: string]: string}>({});
  const [tempPins, setTempPins] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  const fetchPendingRequests = async () => {
    try {
      const { data, error } = await supabase.rpc('get_pending_pin_reset_requests');
      
      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { data, error } = await supabase.rpc('approve_pin_reset_request', {
        p_request_id: requestId,
        p_admin_notes: adminNotes[requestId] || 'Approved by admin',
        p_temporary_pin: tempPins[requestId] || null
      });

      if (error) throw error;
      
      if (data && data[0]?.success) {
        alert(`Request approved! Temporary PIN: ${data[0].temporary_pin}`);
        fetchPendingRequests(); // Refresh the list
      } else {
        alert('Failed to approve request');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Error approving request');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { data, error } = await supabase.rpc('reject_pin_reset_request', {
        p_request_id: requestId,
        p_admin_notes: adminNotes[requestId] || 'Rejected by admin'
      });

      if (error) throw error;
      
      if (data && data[0]?.success) {
        alert('Request rejected successfully');
        fetchPendingRequests(); // Refresh the list
      } else {
        alert('Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Error rejecting request');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md">
        <div className="bg-slate-900 w-full max-w-2xl rounded-2xl p-6 border border-white/10">
          <div className="text-center py-8">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">Loading PIN reset requests...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-slate-900 w-full max-w-4xl rounded-2xl p-6 border border-white/10 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white">PIN Reset Requests</h2>
          <button
            onClick={onRequestClose}
            className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-check-circle text-green-500 text-2xl"></i>
            </div>
            <h3 className="text-lg font-black text-white mb-2">No Pending Requests</h3>
            <p className="text-sm text-slate-400">All PIN reset requests have been processed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="bg-slate-800 rounded-xl p-4 border border-white/10">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-black rounded ${
                        request.user_type === 'driver' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-green-600 text-white'
                      }`}>
                        {request.user_type.toUpperCase()}
                      </span>
                      <span className="text-white font-black">{request.user_name}</span>
                    </div>
                    <div className="text-sm text-slate-400 space-y-1">
                      <p><i className="fas fa-id-badge mr-2"></i>ID: {request.user_id}</p>
                      <p><i className="fas fa-phone mr-2"></i>{request.user_phone}</p>
                      <p><i className="fas fa-clock mr-2"></i>{new Date(request.requested_at).toLocaleString()}</p>
                      <p><i className="fas fa-comment mr-2"></i>{request.request_reason}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <textarea
                    placeholder="Admin notes (optional)"
                    value={adminNotes[request.id] || ''}
                    onChange={(e) => setAdminNotes(prev => ({
                      ...prev,
                      [request.id]: e.target.value
                    }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm resize-none"
                    rows={2}
                  />
                  
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Custom 4-digit PIN (optional)"
                      value={tempPins[request.id] || ''}
                      onChange={(e) => setTempPins(prev => ({
                        ...prev,
                        [request.id]: e.target.value.replace(/\D/g, '').slice(0, 4)
                      }))}
                      className="flex-1 px-3 py-2 bg-slate-700 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm"
                      maxLength={4}
                    />
                    <span className="text-xs text-slate-500">Leave blank for random PIN</span>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(request.id)}
                      disabled={processing === request.id}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg font-black text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {processing === request.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        'Approve & Reset PIN'
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(request.id)}
                      disabled={processing === request.id}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg font-black text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {processing === request.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        'Reject Request'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
