// ============================================================
// FIX SHUTTLE REQUEST LIMITS - ENHANCED LOGIC
// ============================================================

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cCI6InR5cCI6IkpXVCJ9.G_hWSgPstbOi9GgnGprZW1IQVFZSGPQnyC80RROmuw'
);

// Enhanced shuttle capacity and request management
interface ShuttleRequest {
  id: string;
  driverId: string;
  shuttleId: string;
  route: string;
  capacity: number;
  currentPassengers: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requestTime: string;
  estimatedFare: number;
  commissionPaid: boolean;
}

interface ShuttleCapacity {
  shuttleId: string;
  maxCapacity: number;
  currentLoad: number;
  availableSeats: number;
  driverId: string;
  route: string;
  status: 'active' | 'full' | 'maintenance';
}

// Enhanced shuttle request manager
const ShuttleRequestManager: React.FC = () => {
  const [shuttleRequests, setShuttleRequests] = useState<ShuttleRequest[]>([]);
  const [shuttleCapacity, setShuttleCapacity] = useState<ShuttleCapacity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load shuttle capacity data
  const loadShuttleCapacity = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('unihub_drivers')
        .select(`
          id,
          name,
          vehicleType,
          status,
          current_load,
          max_capacity
        `)
        .eq('vehicleType', 'Shuttle')
        .eq('status', 'online');

      if (error) throw error;

      const capacityData: ShuttleCapacity[] = (data || []).map(driver => ({
        shuttleId: driver.id,
        maxCapacity: driver.max_capacity || 10, // Default 10 for shuttles
        currentLoad: driver.current_load || 0,
        availableSeats: (driver.max_capacity || 10) - (driver.current_load || 0),
        driverId: driver.id,
        route: 'Active Route', // This would come from route data
        status: driver.current_load >= (driver.max_capacity || 10) ? 'full' : 'active'
      }));

      setShuttleCapacity(capacityData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load shuttle requests
  const loadShuttleRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('shuttle_requests')
        .select('*')
        .order('requestTime', { ascending: false });

      if (error) throw error;
      setShuttleRequests(data || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Validate shuttle request capacity
  const validateShuttleRequest = async (driverId: string, requestedSeats: number) => {
    try {
      const { data: driver, error } = await supabase
        .from('unihub_drivers')
        .select('max_capacity, current_load, wallet_balance')
        .eq('id', driverId)
        .single();

      if (error) throw error;

      const maxCapacity = driver.max_capacity || 10;
      const currentLoad = driver.current_load || 0;
      const availableSeats = maxCapacity - currentLoad;

      return {
        canAccept: availableSeats >= requestedSeats,
        availableSeats,
        maxCapacity,
        currentLoad,
        requestedSeats,
        reason: availableSeats >= requestedSeats 
          ? 'Request valid' 
          : `Insufficient seats. Available: ${availableSeats}, Requested: ${requestedSeats}`
      };
    } catch (err: any) {
      throw new Error(`Validation failed: ${err.message}`);
    }
  };

  // Process shuttle request with capacity limits
  const processShuttleRequest = async (
    driverId: string, 
    passengerId: string, 
    requestedSeats: number,
    route: string
  ) => {
    try {
      setLoading(true);
      setError('');

      // Step 1: Validate capacity
      const validation = await validateShuttleRequest(driverId, requestedSeats);
      if (!validation.canAccept) {
        throw new Error(validation.reason);
      }

      // Step 2: Check commission requirements
      const { data: settings } = await supabase
        .from('unihub_settings')
        .select('shuttle_commission')
        .single();

      const commissionRate = settings?.shuttle_commission || 0.5;
      const requiredCommission = requestedSeats * commissionRate;

      // Step 3: Check driver wallet balance
      const { data: driver } = await supabase
        .from('unihub_drivers')
        .select('wallet_balance')
        .eq('id', driverId)
        .single();

      if ((driver?.wallet_balance || 0) < requiredCommission) {
        throw new Error(`Insufficient balance. Required: ₵${requiredCommission.toFixed(2)}`);
      }

      // Step 4: Create shuttle request
      const { data: request, error: requestError } = await supabase
        .from('shuttle_requests')
        .insert({
          id: crypto.randomUUID(),
          driverId,
          passengerId,
          requestedSeats,
          route,
          status: 'pending',
          requestTime: new Date().toISOString(),
          estimatedFare: requestedSeats * 8.0, // Base fare per seat
          commissionRequired: requiredCommission,
          commissionPaid: false
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Step 5: Update driver load (temporarily reserve seats)
      await supabase
        .from('unihub_drivers')
        .update({
          current_load: (driver?.current_load || 0) + requestedSeats
        })
        .eq('id', driverId);

      return {
        success: true,
        requestId: request.id,
        message: `Shuttle request created. ${requestedSeats} seats reserved.`,
        validation
      };

    } catch (err: any) {
      setError(err.message);
      return {
        success: false,
        error: err.message
      };
    } finally {
      setLoading(false);
    }
  };

  // Auto-cleanup expired requests
  const cleanupExpiredRequests = async () => {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data: expiredRequests } = await supabase
        .from('shuttle_requests')
        .select('*')
        .eq('status', 'pending')
        .lt('requestTime', thirtyMinutesAgo);

      if (expiredRequests && expiredRequests.length > 0) {
        // Release reserved seats
        for (const request of expiredRequests) {
          await supabase
            .from('unihub_drivers')
            .rpc('release_reserved_seats', {
              p_driver_id: request.driverId,
              p_seats: request.requestedSeats
            });
        }

        // Mark requests as expired
        await supabase
          .from('shuttle_requests')
          .update({ status: 'expired' })
          .eq('status', 'pending')
          .lt('requestTime', thirtyMinutesAgo);
      }
    } catch (err: any) {
      console.error('Cleanup error:', err);
    }
  };

  useEffect(() => {
    loadShuttleCapacity();
    loadShuttleRequests();
    
    // Set up cleanup interval
    const cleanupInterval = setInterval(cleanupExpiredRequests, 5 * 60 * 1000); // Every 5 minutes
    
    return () => clearInterval(cleanupInterval);
  }, []);

  return (
    <div className="p-6 bg-black/90 rounded-2xl text-white">
      <h2 className="text-xl font-bold mb-4">Shuttle Request Manager</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Shuttle Capacity Status */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Shuttle Capacity</h3>
          {shuttleCapacity.map(shuttle => (
            <div key={shuttle.shuttleId} className="mb-3 p-3 bg-white/5 rounded-lg">
              <div className="flex justify-between items-center">
                <span>Shuttle {shuttle.shuttleId.slice(-6)}</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  shuttle.status === 'active' ? 'bg-green-500' : 
                  shuttle.status === 'full' ? 'bg-red-500' : 'bg-yellow-500'
                }`}>
                  {shuttle.status}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {shuttle.currentLoad}/{shuttle.maxCapacity} seats
                ({shuttle.availableSeats} available)
              </div>
            </div>
          ))}
        </div>

        {/* Recent Requests */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Recent Requests</h3>
          {shuttleRequests.slice(0, 5).map(request => (
            <div key={request.id} className="mb-3 p-3 bg-white/5 rounded-lg">
              <div className="flex justify-between items-center">
                <span>{request.requestedSeats} seats</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  request.status === 'approved' ? 'bg-green-500' : 
                  request.status === 'pending' ? 'bg-yellow-500' : 
                  request.status === 'rejected' ? 'bg-red-500' : 'bg-gray-500'
                }`}>
                  {request.status}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {new Date(request.requestTime).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="mt-4 text-center">
          <p>Loading shuttle data...</p>
        </div>
      )}
    </div>
  );
};

// Enhanced shuttle capacity validation function
export const validateShuttleCapacity = async (
  driverId: string, 
  requestedSeats: number
): Promise<{
  canAccept: boolean;
  availableSeats: number;
  maxCapacity: number;
  currentLoad: number;
  reason: string;
}> => {
  try {
    const { data: driver, error } = await supabase
      .from('unihub_drivers')
      .select('max_capacity, current_load')
      .eq('id', driverId)
      .single();

    if (error) throw error;

    const maxCapacity = driver.max_capacity || 10;
    const currentLoad = driver.current_load || 0;
    const availableSeats = maxCapacity - currentLoad;

    return {
      canAccept: availableSeats >= requestedSeats,
      availableSeats,
      maxCapacity,
      currentLoad,
      reason: availableSeats >= requestedSeats 
        ? 'Capacity available' 
        : `Insufficient seats. Available: ${availableSeats}, Requested: ${requestedSeats}`
    };
  } catch (err: any) {
    throw new Error(`Capacity validation failed: ${err.message}`);
  }
};

export default ShuttleRequestManager;
