
export type VehicleType = 'Pragia' | 'Taxi' | 'Shuttle';
export type NodeStatus = 'forming' | 'qualified' | 'dispatched' | 'completed'; 
export type PortalMode = 'passenger' | 'driver' | 'admin' | 'public';

export interface SearchConfig {
  query: string;
  vehicleType: VehicleType | 'All';
  status: NodeStatus | 'All';
  sortBy: 'newest' | 'price' | 'capacity';
  isSolo: boolean | null;
}

export interface UniUser {
  id: string;
  username: string;
  phone: string;
  pin?: string;
  walletBalance: number; // New field for passenger funds
  biometricUrl?: string; // Base64 or URL of reference selfie
}

export interface Passenger {
  id: string;
  name: string;
  phone: string;
  verificationCode?: string;
}

export interface HubMission {
  id: string;
  location: string;
  description: string;
  entryFee: number;
  driversJoined: string[]; // List of driver IDs
  status: 'open' | 'closed';
  createdAt: string;
}

export interface RideNode {
  id: string;
  destination: string;
  origin: string;
  capacityNeeded: number;
  passengers: Passenger[];
  status: NodeStatus;
  leaderName: string;
  leaderPhone: string;
  farePerPerson: number;
  createdAt: string;
  assignedDriverId?: string;
  verificationCode?: string;
  isSolo?: boolean;
  isLongDistance?: boolean;
  negotiatedTotalFare?: number;
  vehicleType?: VehicleType; 
  driverNote?: string;
}

export interface Driver {
  id: string;
  name: string;
  vehicleType: VehicleType;
  licensePlate: string;
  contact: string;
  walletBalance: number; // Represents Earnings
  rating: number;
  status: 'online' | 'busy' | 'offline';
  pin: string; 
  avatarUrl?: string; 
}

export interface TopupRequest {
  id: string;
  driverId?: string; // Optional now
  userId?: string; // New: For passenger topups
  amount: number;
  momoReference: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
  proofImage?: string; // Base64 for audit
}

export interface RegistrationRequest {
  id: string;
  name: string;
  vehicleType: VehicleType;
  licensePlate: string;
  contact: string;
  pin: string;
  amount: number;
  momoReference: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
  avatarUrl?: string; 
}

export interface Transaction {
  id: string;
  driverId?: string;
  userId?: string;
  amount: number;
  type: 'commission' | 'topup' | 'registration' | 'refund' | 'fare_payment' | 'withdrawal'; 
  timestamp: string;
  reference?: string;
}

export interface AppSettings {
  id?: number;
  adminMomo: string;
  adminMomoName: string;
  whatsappNumber: string;
  commissionPerSeat: number;
  shuttleCommission: number; 
  adminSecret?: string;
  farePerPragia: number;
  farePerTaxi: number;
  soloMultiplier: number;
  aboutMeText: string;
  aboutMeImages: string[]; // Base64 strings
  appWallpaper?: string; // Base64 string
  appLogo?: string; // Base64 string for custom logo
  registrationFee: number;
  hub_announcement?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  adSenseClientId?: string;
  adSenseSlotId?: string;
  adSenseLayoutKey?: string;
  adSenseStatus?: 'active' | 'inactive';
}
