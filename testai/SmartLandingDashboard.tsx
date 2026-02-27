import React from 'react';

interface SmartLandingDashboardProps {
  currentUser: any;
  activeDriver: any;
  myRideIds: string[];
  onNavigateToPortal: (portal: 'passenger' | 'driver' | 'admin' | 'tracking') => void;
  onCreateRide: () => void;
  onShowHelp: () => void;
  settings: any;
}

const SmartLandingDashboard: React.FC<SmartLandingDashboardProps> = ({
  currentUser,
  activeDriver,
  myRideIds,
  onNavigateToPortal,
  onCreateRide,
  onShowHelp,
  settings
}) => {
  const hasActiveRides = myRideIds.length > 0;
  const isDriver = !!activeDriver;
  const isNewUser = !currentUser || !currentUser.username;

  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getPersonalizedMessage = () => {
    if (isDriver) {
      return "Ready to serve passengers today?";
    }
    if (hasActiveRides) {
      return "You have rides in progress";
    }
    if (isNewUser) {
      return "Let's get you moving";
    }
    return "Where would you like to go today?";
  };

  const QuickActionCard = ({ 
    icon, 
    title, 
    description, 
    onClick, 
    color = "indigo",
    badge 
  }: {
    icon: string;
    title: string;
    description: string;
    onClick: () => void;
    color?: string;
    badge?: string;
  }) => (
    <button
      onClick={onClick}
      className={`glass p-6 rounded-[2rem] border border-white/10 hover:border-${color}-500/30 hover:bg-${color}-600/5 transition-all duration-300 text-left group relative overflow-hidden`}
    >
      {badge && (
        <div className={`absolute top-4 right-4 px-2 py-1 bg-${color}-500 text-white text-[8px] font-black uppercase rounded-full`}>
          {badge}
        </div>
      )}
      <div className={`w-12 h-12 bg-${color}-500/20 rounded-2xl flex items-center justify-center text-${color}-400 text-xl mb-4 group-hover:scale-110 transition-transform`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <h3 className="text-lg font-black text-white mb-2">{title}</h3>
      <p className="text-xs text-slate-400 font-medium">{description}</p>
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black italic text-white mb-2">
            {getGreetingTime()}, {currentUser?.username || 'Explorer'}!
          </h1>
          <p className="text-lg text-slate-300 font-medium">
            {getPersonalizedMessage()}
          </p>
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!isDriver && (
          <QuickActionCard
            icon="fa-route"
            title="Book a Ride"
            description="Request a trip or join existing rides"
            onClick={() => onNavigateToPortal('passenger')}
            color="emerald"
            badge="Popular"
          />
        )}

        {!isDriver && (
          <QuickActionCard
            icon="fa-plus-circle"
            title="Create Trip"
            description="Start a new ride and invite others"
            onClick={onCreateRide}
            color="amber"
          />
        )}

        {isDriver ? (
          <QuickActionCard
            icon="fa-id-card-clip"
            title="Driver Terminal"
            description="Manage your rides and earnings"
            onClick={() => onNavigateToPortal('driver')}
            color="blue"
            badge="Active"
          />
        ) : (
          <QuickActionCard
            icon="fa-car"
            title="Become a Partner"
            description="Start earning as a driver"
            onClick={() => onNavigateToPortal('driver')}
            color="rose"
          />
        )}

        <QuickActionCard
          icon="fa-location-dot"
          title="Live Tracking"
          description="Track rides in real-time"
          onClick={() => onNavigateToPortal('tracking')}
          color="purple"
        />

        <QuickActionCard
          icon="fa-question-circle"
          title="Need Help?"
          description="Quick guide and support"
          onClick={onShowHelp}
          color="slate"
        />

        {hasActiveRides && (
          <QuickActionCard
            icon="fa-list-check"
            title="My Rides"
            description={`${myRideIds.length} active ride${myRideIds.length > 1 ? 's' : ''}`}
            onClick={() => onNavigateToPortal('passenger')}
            color="indigo"
            badge={myRideIds.length.toString()}
          />
        )}
      </div>

      {/* Market Pulse */}
      <div className="glass p-6 rounded-[2rem] border border-white/10">
        <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          Market Pulse
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-black text-white italic">--</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Active Partners</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-white italic">--</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Open Trips</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-white italic">--</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Avg Wait Time</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-white italic">--</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Hot Zones</p>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="bg-gradient-to-r from-amber-600/10 to-orange-600/10 p-6 rounded-[2rem] border border-amber-500/20">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 flex-shrink-0">
            <i className="fas fa-lightbulb"></i>
          </div>
          <div>
            <h4 className="font-black text-white mb-2">Pro Tip</h4>
            <p className="text-sm text-slate-300">
              {isDriver 
                ? "Station at popular hotspots during peak hours (7-9 AM, 5-7 PM) for more ride requests."
                : "Share rides with Pool mode to save up to 60% on fares while meeting new people."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartLandingDashboard;
