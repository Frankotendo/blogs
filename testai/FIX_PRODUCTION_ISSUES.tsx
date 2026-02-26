// ============================================================
// PRODUCTION FIXES - CAPACITY LIMITS & DIRECTION LOGIC
// ============================================================

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw'
);

// Vehicle capacity configuration
const VEHICLE_CAPACITIES = {
  'Pragia': 4,
  'Taxi': 4,
  'Shuttle': 60 // Large bus capacity
};

interface CapacityCheck {
  vehicleType: string;
  maxCapacity: number;
  currentLoad: number;
  availableSeats: number;
  canAcceptRequest: boolean;
  requestedSeats: number;
}

interface DriverDirection {
  driverId: string;
  driverLocation: {lat: number, lng: number};
  passengerLocation: {lat: number, lng: number};
  destination: {lat: number, lng: number};
  directionsUrl: string;
  timestamp: string;
}

// Production capacity validation
export const validateVehicleCapacity = async (
  driverId: string, 
  requestedSeats: number
): Promise<CapacityCheck> => {
  try {
    // Get driver details
    const { data: driver, error: driverError } = await supabase
      .from('unihub_drivers')
      .select('*')
      .eq('id', driverId)
      .single();

    if (driverError || !driver) {
      throw new Error(`Driver not found: ${driverId}`);
    }

    // Get current active trips for this driver
    const { data: activeTrips, error: tripsError } = await supabase
      .from('unihub_nodes')
      .select('*')
      .eq('assignedDriverId', driverId)
      .in('status', ['forming', 'qualified', 'dispatched']);

    if (tripsError) {
      throw new Error(`Failed to check active trips: ${tripsError.message}`);
    }

    // Calculate current load from active trips
    const currentLoad = activeTrips?.reduce((total, trip) => {
      return total + (trip.passengers?.length || 0);
    }, 0) || 0;

    // Get vehicle capacity
    const maxCapacity = VEHICLE_CAPACITIES[driver.vehicleType as keyof typeof VEHICLE_CAPACITIES] || 4;
    const availableSeats = maxCapacity - currentLoad;

    return {
      vehicleType: driver.vehicleType,
      maxCapacity,
      currentLoad,
      availableSeats,
      canAcceptRequest: availableSeats >= requestedSeats,
      requestedSeats
    };

  } catch (error) {
    console.error('Capacity validation error:', error);
    return {
      vehicleType: 'Unknown',
      maxCapacity: 4,
      currentLoad: 0,
      availableSeats: 0,
      canAcceptRequest: false,
      requestedSeats
    };
  }
};

// Enhanced broadcast function with capacity validation
export const handleEnhancedBroadcast = async (
  data: any,
  activeDriverId: string,
  getLatestDriver: (id: string) => Promise<any>,
  settings: any
) => {
  if (!activeDriverId) {
    throw new Error('No active driver');
  }

  const latestDriver = await getLatestDriver(activeDriverId);
  if (!latestDriver) {
    throw new Error('Driver not found');
  }

  // Check for existing active rides
  const { data: activeRides } = await supabase
    .from('unihub_nodes')
    .select('*')
    .eq('assignedDriverId', activeDriverId)
    .in('status', ['forming', 'qualified', 'dispatched']);

  if (activeRides && activeRides.length > 0) {
    throw new Error('You already have an active trip. Complete it before creating a new one.');
  }

  const isShuttle = latestDriver.vehicleType === 'Shuttle';
  const rawSeats = parseInt(data.seats);
  
  // ENFORCED CAPACITY LIMITS
  const maxCapacity = VEHICLE_CAPACITIES[latestDriver.vehicleType as keyof typeof VEHICLE_CAPACITIES];
  const requestedCapacity = rawSeats > 0 ? Math.min(rawSeats, maxCapacity) : maxCapacity;
  
  // Validate capacity doesn't exceed vehicle limits
  if (rawSeats > maxCapacity) {
    console.warn(`Requested seats (${rawSeats}) exceeded vehicle capacity (${maxCapacity}). Using maximum capacity.`);
  }

  const rate = isShuttle
    ? settings.shuttleCommission || settings.commissionPerSeat
    : settings.commissionPerSeat;
  const commissionAmount = isShuttle ? requestedCapacity * rate : 0;

  // Check wallet balance for shuttles
  if (isShuttle && latestDriver.walletBalance < commissionAmount) {
    throw new Error(
      `Insufficient Wallet Balance. Shuttle broadcasts require prepaid commission of ₵${commissionAmount.toFixed(2)}. Current balance: ₵${latestDriver.walletBalance.toFixed(2)}`
    );
  }

  // Create the ride node with validated capacity
  const node: any = {
    id: `NODE-DRV-${Date.now()}`,
    origin: data.origin,
    destination: data.destination,
    capacityNeeded: requestedCapacity,
    passengers: [],
    status: 'forming',
    leaderName: latestDriver.name,
    leaderPhone: latestDriver.contact,
    farePerPerson: data.fare,
    createdAt: new Date().toISOString(),
    assignedDriverId: activeDriverId,
    vehicleType: latestDriver.vehicleType,
    driverNote: data.note,
    maxCapacity: maxCapacity, // Store max capacity for reference
  };

  try {
    // Process commission for shuttles
    if (isShuttle) {
      const { error: updError } = await supabase
        .from('unihub_drivers')
        .update({
          walletBalance: latestDriver.walletBalance - commissionAmount,
        })
        .eq('id', latestDriver.id);
      
      if (updError) throw updError;

      // Record commission transaction
      await supabase.from('unihub_transactions').insert([
        {
          id: `TX-COMM-PRE-${Date.now()}`,
          driverId: latestDriver.id,
          amount: commissionAmount,
          type: 'commission',
          timestamp: new Date().toLocaleString(),
          description: `Prepaid commission for ${requestedCapacity} seats`
        },
      ]);
    }

    // Create the ride node
    const { error: insError } = await supabase
      .from('unihub_nodes')
      .insert([node]);
    
    if (insError) {
      // Rollback commission if node creation fails
      if (isShuttle) {
        const reLatest = await getLatestDriver(activeDriverId);
        await supabase
          .from('unihub_drivers')
          .update({
            walletBalance: reLatest.walletBalance + commissionAmount,
          })
          .eq('id', latestDriver.id);
        
        await supabase.from('unihub_transactions').insert([
          {
            id: `TX-ROLLBACK-${Date.now()}`,
            driverId: latestDriver.id,
            amount: commissionAmount,
            type: 'refund',
            timestamp: new Date().toLocaleString(),
            description: 'Commission rollback due to failed broadcast'
          },
        ]);
      }
      throw insError;
    }

    return {
      success: true,
      message: isShuttle
        ? `Route broadcasted! ₵${commissionAmount.toFixed(2)} commission prepaid for ${requestedCapacity} seats.`
        : `Route broadcasted! Capacity: ${requestedCapacity}/${maxCapacity} seats.`,
      node,
      commissionAmount
    };

  } catch (error: any) {
    console.error('Enhanced broadcast error:', error);
    throw new Error(`Broadcast failed: ${error.message}. Funds protected.`);
  }
};

// Enhanced passenger request with capacity validation
export const handleEnhancedPassengerRequest = async (
  nodeId: string,
  passenger: any,
  settings: any
) => {
  try {
    // Get the ride node
    const { data: node, error: nodeError } = await supabase
      .from('unihub_nodes')
      .select('*')
      .eq('id', nodeId)
      .single();

    if (nodeError || !node) {
      throw new Error('Ride not found');
    }

    // Check if ride is still accepting passengers
    if (node.status !== 'forming' && node.status !== 'qualified') {
      throw new Error('This ride is no longer accepting passengers');
    }

    // Check capacity
    const currentPassengers = node.passengers?.length || 0;
    const maxCapacity = node.maxCapacity || VEHICLE_CAPACITIES[node.vehicleType as keyof typeof VEHICLE_CAPACITIES] || 4;
    
    if (currentPassengers >= maxCapacity) {
      throw new Error(`Ride is full (${currentPassengers}/${maxCapacity} seats)`);
    }

    // Check if passenger is already in the ride
    const isAlreadyJoined = node.passengers?.some((p: any) => p.phone === passenger.phone);
    if (isAlreadyJoined) {
      throw new Error('You have already joined this ride');
    }

    // Add passenger to the ride
    const updatedPassengers = [...(node.passengers || []), {
      ...passenger,
      joinedAt: new Date().toISOString()
    }];

    const { error: updateError } = await supabase
      .from('unihub_nodes')
      .update({
        passengers: updatedPassengers,
        status: updatedPassengers.length >= maxCapacity ? 'qualified' : 'forming'
      })
      .eq('id', nodeId);

    if (updateError) {
      throw new Error(`Failed to join ride: ${updateError.message}`);
    }

    return {
      success: true,
      message: `Successfully joined ride! Seat ${updatedPassengers.length}/${maxCapacity}`,
      seatsLeft: maxCapacity - updatedPassengers.length
    };

  } catch (error: any) {
    console.error('Passenger request error:', error);
    throw error;
  }
};

// Driver direction assignment
export const assignDriverDirections = async (
  driverId: string,
  passengerLocation: {lat: number, lng: number},
  destination?: {lat: number, lng: number}
): Promise<DriverDirection> => {
  try {
    // Get driver's current location
    const { data: driverLocation, error: locationError } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (locationError || !driverLocation) {
      // Fallback to driver's last known location from driver table
      const { data: driver, error: driverError } = await supabase
        .from('unihub_drivers')
        .select('latitude, longitude')
        .eq('id', driverId)
        .single();

      if (driverError || !driver) {
        throw new Error('Driver location not found');
      }

      driverLocation = {
        latitude: driver.latitude || 5.6037, // Default to Legon
        longitude: driver.longitude || -0.1870
      };
    }

    const driverCoords = {
      lat: driverLocation.latitude,
      lng: driverLocation.longitude
    };

    // Create Google Maps directions URL
    const finalDestination = destination || passengerLocation;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${driverCoords.lat},${driverCoords.lng}&destination=${finalDestination.lat},${finalDestination.lng}&waypoints=${passengerLocation.lat},${passengerLocation.lng}`;

    const directionData: DriverDirection = {
      driverId,
      driverLocation: driverCoords,
      passengerLocation,
      destination: finalDestination,
      directionsUrl,
      timestamp: new Date().toISOString()
    };

    // Store direction assignment for tracking
    await supabase.from('driver_directions').insert([
      {
        driverId,
        passengerLocation,
        destination: finalDestination,
        directionsUrl,
        assignedAt: new Date().toISOString(),
        status: 'assigned'
      }
    ]).catch(error => {
      console.warn('Failed to store direction assignment:', error);
      // Continue even if storage fails
    });

    return directionData;

  } catch (error: any) {
    console.error('Direction assignment error:', error);
    throw new Error(`Failed to assign directions: ${error.message}`);
  }
};

// Production monitoring component
const ProductionFixes: React.FC = () => {
  const [capacityChecks, setCapacityChecks] = useState<CapacityCheck[]>([]);
  const [directionAssignments, setDirectionAssignments] = useState<DriverDirection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Monitor capacity violations
  const checkAllDriverCapacities = async () => {
    setIsLoading(true);
    try {
      const { data: drivers } = await supabase
        .from('unihub_drivers')
        .select('id, vehicleType');

      if (!drivers) return;

      const checks: CapacityCheck[] = [];
      for (const driver of drivers) {
        const check = await validateVehicleCapacity(driver.id, 1); // Check for 1 seat availability
        checks.push(check);
      }

      setCapacityChecks(checks);

    } catch (error) {
      console.error('Capacity check error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get recent direction assignments
  const getRecentDirections = async () => {
    try {
      const { data: directions } = await supabase
        .from('driver_directions')
        .select('*')
        .order('assignedAt', { ascending: false })
        .limit(10);

      setDirectionAssignments(directions || []);

    } catch (error) {
      console.error('Directions fetch error:', error);
    }
  };

  useEffect(() => {
    checkAllDriverCapacities();
    getRecentDirections();

    // Set up periodic checks
    const interval = setInterval(() => {
      checkAllDriverCapacities();
      getRecentDirections();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-black/90 backdrop-blur-md rounded-2xl text-white">
      <h2 className="text-2xl font-bold mb-6">🔧 Production Fixes Monitor</h2>
      
      {/* Vehicle Capacity Status */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">🚗 Vehicle Capacity Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capacityChecks.map((check, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border ${
                check.canAcceptRequest 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{check.vehicleType}</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  check.canAcceptRequest ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {check.canAcceptRequest ? 'Available' : 'Full'}
                </span>
              </div>
              <div className="text-sm text-gray-300">
                <p>Capacity: {check.currentLoad}/{check.maxCapacity}</p>
                <p>Available: {check.availableSeats} seats</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={checkAllDriverCapacities}
          disabled={isLoading}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg text-sm"
        >
          {isLoading ? 'Checking...' : 'Refresh Capacity'}
        </button>
      </div>

      {/* Direction Assignments */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">🗺️ Recent Direction Assignments</h3>
        <div className="space-y-3">
          {directionAssignments.map((direction, index) => (
            <div key={index} className="p-4 bg-white/5 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Driver: {direction.driverId}</span>
                <span className="text-xs text-gray-400">
                  {new Date(direction.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-sm text-gray-300">
                <p>📍 Driver: {direction.driverLocation.lat.toFixed(6)}, {direction.driverLocation.lng.toFixed(6)}</p>
                <p>👤 Passenger: {direction.passengerLocation.lat.toFixed(6)}, {direction.passengerLocation.lng.toFixed(6)}</p>
                <p>🎯 Destination: {direction.destination.lat.toFixed(6)}, {direction.destination.lng.toFixed(6)}</p>
                <a 
                  href={direction.directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Open Directions →
                </a>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={getRecentDirections}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
        >
          Refresh Directions
        </button>
      </div>

      {/* Vehicle Capacity Rules */}
      <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
        <h4 className="font-medium mb-2">📋 Enforced Capacity Rules:</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Pragia: Maximum 4 seats</li>
          <li>• Taxi: Maximum 4 seats</li>
          <li>• Shuttle: Maximum 60 seats</li>
          <li>• Capacity validation on all requests</li>
          <li>• Automatic direction assignment for drivers</li>
        </ul>
      </div>
    </div>
  );
};

export default ProductionFixes;
