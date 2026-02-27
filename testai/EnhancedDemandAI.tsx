import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

interface DemandMetrics {
  currentDemand: 'Low' | 'Normal' | 'High' | 'Surge';
  supplyRatio: number;
  peakHours: string[];
  recommendations: string[];
  fareAdjustments: {
    vehicle: string;
    currentFare: number;
    suggestedFare: number;
    reason: string;
  }[];
  competitorAnalysis: {
    name: string;
    estimatedMarketShare: number;
    pricing: string;
    strengths: string[];
  }[];
  weatherImpact: {
    condition: string;
    impact: string;
    recommendation: string;
  };
  eventsImpact: {
    events: string[];
    impact: string;
    action: string;
  };
}

const EnhancedDemandAI: React.FC<{
  nodes: any[];
  drivers: any[];
  settings: any;
}> = ({ nodes, drivers, settings }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metrics, setMetrics] = useState<DemandMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Enhanced demand analysis with multiple factors
  const analyzeDemand = async () => {
    setIsAnalyzing(true);
    try {
      const activeRides = nodes.filter(n => n.status !== 'completed').length;
      const onlineDrivers = drivers.filter(d => d.status === 'online').length;
      const completedRides = nodes.filter(n => n.status === 'completed').length;
      const totalRides = nodes.length;
      
      const hour = new Date().getHours();
      const dayOfWeek = new Date().getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Simulate weather data (in real app, would fetch from weather API)
      const weatherConditions = ['Sunny', 'Rainy', 'Cloudy', 'Hazy'];
      const currentWeather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
      
      // Simulate campus events
      const campusEvents = hour >= 17 && hour <= 21 ? ['Evening Lectures', 'Study Groups', 'Sports Events'] : [];
      
      const prompt = `
You are an advanced demand analysis AI for NexRyde ride-sharing in Ghana.

CURRENT METRICS:
- Active Rides: ${activeRides}
- Online Drivers: ${onlineDrivers}
- Completed Today: ${completedRides}
- Total Rides: ${totalRides}
- Time: ${hour}:00
- Day: ${isWeekend ? 'Weekend' : 'Weekday'}
- Weather: ${currentWeather}
- Campus Events: ${campusEvents.join(', ') || 'None'}

CURRENT PRICING:
- Pragia: ₵${settings.farePerPragia}
- Taxi: ₵${settings.farePerTaxi}
- Solo Multiplier: ${settings.soloMultiplier}x
- Commission: ₵${settings.commissionPerSeat} per seat

COMPETITORS:
- Uber (if available in area)
- Bolt
- Local Taxis
- Walking/Alternative transport

Analyze and provide comprehensive insights in JSON format:
{
  "currentDemand": "Low|Normal|High|Surge",
  "supplyRatio": 1.5,
  "peakHours": ["7-9 AM", "5-7 PM"],
  "recommendations": [
    "Increase pragia fleet during morning rush",
    "Offer weekend discounts for long trips"
  ],
  "fareAdjustments": [
    {
      "vehicle": "Pragia",
      "currentFare": 5,
      "suggestedFare": 6,
      "reason": "High demand during rush hour"
    }
  ],
  "competitorAnalysis": [
    {
      "name": "Bolt",
      "estimatedMarketShare": 25,
      "pricing": "Similar to NexRyde",
      "strengths": ["Brand recognition", "App reliability"]
    }
  ],
  "weatherImpact": {
    "condition": "Rainy",
    "impact": "Demand increases by 30%",
    "recommendation": "Add rain surge pricing"
  },
  "eventsImpact": {
    "events": ["Campus festival"],
    "impact": "High demand expected",
    "action": "Deploy extra drivers"
  }
}

Consider Ghanaian context: student behavior, campus patterns, weather, economic factors.
`;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const result = JSON.parse(response.text || '{}');
      setMetrics(result);
      
      // Store in historical data
      const historicalEntry = {
        timestamp: new Date().toISOString(),
        demand: result.currentDemand,
        supplyRatio: result.supplyRatio,
        activeRides,
        onlineDrivers
      };
      setHistoricalData(prev => [...prev.slice(-23), historicalEntry]); // Keep last 24 entries
    } catch (error) {
      console.error('Demand analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(analyzeDemand, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, nodes, drivers, settings]);

  // Initial analysis on mount
  useEffect(() => {
    analyzeDemand();
  }, []);

  const getDemandColor = (demand: string) => {
    const colors = {
      'Low': 'text-blue-400',
      'Normal': 'text-emerald-400',
      'High': 'text-amber-400',
      'Surge': 'text-rose-400 animate-pulse'
    };
    return colors[demand as keyof typeof colors] || 'text-slate-400';
  };

  const getDemandBg = (demand: string) => {
    const colors = {
      'Low': 'bg-blue-500/20 border-blue-500/30',
      'Normal': 'bg-emerald-500/20 border-emerald-500/30',
      'High': 'bg-amber-500/20 border-amber-500/30',
      'Surge': 'bg-rose-500/20 border-rose-500/30'
    };
    return colors[demand as keyof typeof colors] || 'bg-slate-500/20 border-slate-500/30';
  };

  if (!metrics) {
    return (
      <div className="glass p-6 rounded-[2rem] border border-white/10">
        <div className="text-center py-8">
          <i className="fas fa-brain text-4xl text-indigo-400 mb-4"></i>
          <p className="text-slate-400">Initializing demand analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="glass p-4 rounded-[2rem] border border-white/10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-black text-white uppercase flex items-center gap-2">
              <i className="fas fa-brain text-indigo-400"></i>
              Advanced Demand AI
            </h3>
            <p className="text-[10px] text-indigo-400 uppercase tracking-widest">Real-time Market Intelligence</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-colors ${
                autoRefresh 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-white/10 text-slate-400 hover:bg-white/20'
              }`}
            >
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>
            <button
              onClick={analyzeDemand}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase disabled:opacity-50"
            >
              {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Current Demand Status */}
      <div className={`glass p-6 rounded-[2rem] border ${getDemandBg(metrics.currentDemand)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-400 uppercase mb-2">Current Market State</h4>
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-black ${getDemandColor(metrics.currentDemand)}`}>
                {metrics.currentDemand}
              </span>
              <div className="text-left">
                <p className="text-sm text-slate-300">Supply Ratio: {metrics.supplyRatio.toFixed(1)}</p>
                <p className="text-[10px] text-slate-500">Drivers per active ride</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase mb-1">Peak Hours</p>
            <div className="flex flex-wrap gap-1 justify-end">
              {metrics.peakHours?.map((hour, i) => (
                <span key={i} className="px-2 py-1 bg-white/10 rounded text-[9px] text-white">
                  {hour}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {metrics.recommendations?.length > 0 && (
        <div className="glass p-6 rounded-[2rem] border border-white/10">
          <h4 className="text-sm font-black text-emerald-400 uppercase mb-4">
            <i className="fas fa-lightbulb mr-2"></i>
            AI Recommendations
          </h4>
          <div className="space-y-2">
            {metrics.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-300">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fare Adjustments */}
      {metrics.fareAdjustments?.length > 0 && (
        <div className="glass p-6 rounded-[2rem] border border-white/10">
          <h4 className="text-sm font-black text-amber-400 uppercase mb-4">
            <i className="fas fa-coins mr-2"></i>
            Dynamic Pricing Suggestions
          </h4>
          <div className="space-y-3">
            {metrics.fareAdjustments.map((adj, i) => (
              <div key={i} className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-sm font-black text-white">{adj.vehicle}</span>
                    <p className="text-[10px] text-slate-400">{adj.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400 line-through">₵{adj.currentFare}</p>
                    <p className="text-lg font-black text-amber-400">₵{adj.suggestedFare}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-[9px] font-medium ${
                    adj.suggestedFare > adj.currentFare 
                      ? 'bg-rose-500/20 text-rose-400' 
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {adj.suggestedFare > adj.currentFare ? '+' : ''}{((adj.suggestedFare - adj.currentFare) / adj.currentFare * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* External Factors */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Weather Impact */}
        {metrics.weatherImpact && (
          <div className="glass p-6 rounded-[2rem] border border-white/10">
            <h4 className="text-sm font-black text-blue-400 uppercase mb-4">
              <i className="fas fa-cloud mr-2"></i>
              Weather Impact
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Condition:</span>
                <span className="text-sm font-medium text-white">{metrics.weatherImpact.condition}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Impact:</span>
                <span className="text-sm font-medium text-blue-400">{metrics.weatherImpact.impact}</span>
              </div>
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-blue-300">{metrics.weatherImpact.recommendation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Events Impact */}
        {metrics.eventsImpact && (
          <div className="glass p-6 rounded-[2rem] border border-white/10">
            <h4 className="text-sm font-black text-purple-400 uppercase mb-4">
              <i className="fas fa-calendar mr-2"></i>
              Events Impact
            </h4>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-slate-400">Active Events:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {metrics.eventsImpact.events.map((event, i) => (
                    <span key={i} className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-[9px] text-purple-400">
                      {event}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <p className="text-xs text-purple-300 font-medium">{metrics.eventsImpact.action}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Competitor Analysis */}
      {metrics.competitorAnalysis?.length > 0 && (
        <div className="glass p-6 rounded-[2rem] border border-white/10">
          <h4 className="text-sm font-black text-rose-400 uppercase mb-4">
            <i className="fas fa-chart-pie mr-2"></i>
            Competitor Intelligence
          </h4>
          <div className="space-y-4">
            {metrics.competitorAnalysis.map((competitor, i) => (
              <div key={i} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="text-sm font-black text-white">{competitor.name}</h5>
                  <span className="px-2 py-1 bg-rose-500/20 text-rose-400 rounded text-[9px] font-medium">
                    {competitor.estimatedMarketShare}% share
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-2">Pricing: {competitor.pricing}</p>
                <div className="flex flex-wrap gap-1">
                  {competitor.strengths.map((strength, j) => (
                    <span key={j} className="px-2 py-1 bg-white/10 rounded text-[9px] text-slate-300">
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Trend */}
      {historicalData.length > 1 && (
        <div className="glass p-6 rounded-[2rem] border border-white/10">
          <h4 className="text-sm font-black text-indigo-400 uppercase mb-4">
            <i className="fas fa-chart-line mr-2"></i>
            24-Hour Trend
          </h4>
          <div className="grid grid-cols-12 gap-1">
            {historicalData.map((entry, i) => (
              <div key={i} className="text-center">
                <div 
                  className={`h-16 rounded ${
                    entry.demand === 'Surge' ? 'bg-rose-500' :
                    entry.demand === 'High' ? 'bg-amber-500' :
                    entry.demand === 'Normal' ? 'bg-emerald-500' :
                    'bg-blue-500'
                  }`}
                  style={{ opacity: 0.3 + (entry.supplyRatio / 2) }}
                ></div>
                <p className="text-[8px] text-slate-500 mt-1">
                  {new Date(entry.timestamp).getHours()}h
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedDemandAI;
