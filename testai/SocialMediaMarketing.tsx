import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';

interface SocialPost {
  platform: 'instagram' | 'twitter' | 'tiktok' | 'whatsapp';
  content: string;
  hashtags: string[];
  mediaType: 'image' | 'video' | 'story';
  engagement: string;
}

interface CampaignMetrics {
  reach: number;
  engagement: number;
  conversions: number;
  costPerAcquisition: number;
}

const SocialMediaMarketing: React.FC = () => {
  const [campaignGoal, setCampaignGoal] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [budget, setBudget] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [campaignStrategy, setCampaignStrategy] = useState('');
  const [metrics, setMetrics] = useState<CampaignMetrics>({
    reach: 0,
    engagement: 0,
    conversions: 0,
    costPerAcquisition: 0
  });

  const generateSocialCampaign = async () => {
    if (!campaignGoal.trim() || !targetAudience.trim()) return;

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const prompt = `
You are a social media marketing expert for NexRyde (ride-sharing app in Ghana).

Campaign Details:
- Goal: ${campaignGoal}
- Target Audience: ${targetAudience}
- Budget: ${budget || 'Not specified'}

Generate a comprehensive social media campaign with:
1. Overall strategy (2-3 sentences)
2. Platform-specific content for Instagram, Twitter, TikTok, WhatsApp
3. Relevant hashtags for Ghanaian market
4. Media type suggestions
5. Estimated engagement metrics

Respond in JSON format:
{
  "strategy": "Overall campaign strategy",
  "posts": [
    {
      "platform": "instagram",
      "content": "Post content with emojis",
      "hashtags": ["#nexryde", "#ghana", "#rideshare"],
      "mediaType": "image",
      "engagement": "High/Medium/Low with brief explanation"
    }
  ],
  "metrics": {
    "estimatedReach": 5000,
    "estimatedEngagement": 15,
    "estimatedConversions": 50,
    "costPerAcquisition": 2.5
  }
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const result = JSON.parse(response.text || '{}');
      setCampaignStrategy(result.strategy || '');
      setSocialPosts(result.posts || []);
      setMetrics(result.metrics || metrics);
    } catch (error) {
      console.error('Campaign generation failed:', error);
      alert('Failed to generate campaign. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons = {
      instagram: 'fab fa-instagram',
      twitter: 'fab fa-twitter',
      tiktok: 'fab fa-tiktok',
      whatsapp: 'fab fa-whatsapp'
    };
    return icons[platform as keyof typeof icons] || 'fas fa-share';
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      instagram: 'from-purple-600 to-pink-600',
      twitter: 'from-sky-500 to-blue-600',
      tiktok: 'from-black to-gray-800',
      whatsapp: 'from-emerald-500 to-green-600'
    };
    return colors[platform as keyof typeof colors] || 'from-gray-600 to-gray-800';
  };

  const downloadCampaignReport = () => {
    const report = `
NEXRYDE SOCIAL MEDIA CAMPAIGN REPORT
===================================

Campaign Strategy:
${campaignStrategy}

Target Audience: ${targetAudience}
Goal: ${campaignGoal}
Budget: ${budget}

PLATFORM-SPECIFIC CONTENT:
${socialPosts.map(post => `
${post.platform.toUpperCase()}
Content: ${post.content}
Hashtags: ${post.hashtags.join(', ')}
Media Type: ${post.mediaType}
Expected Engagement: ${post.engagement}
`).join('\n')}

ESTIMATED METRICS:
- Reach: ${metrics.estimatedReach?.toLocaleString() || 0} people
- Engagement Rate: ${metrics.estimatedEngagement || 0}%
- Conversions: ${metrics.estimatedConversions || 0} signups
- Cost Per Acquisition: ₵${metrics.costPerAcquisition || 0}

Generated on: ${new Date().toLocaleDateString()}
`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexryde-campaign-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Campaign Input Section */}
      <div className="glass p-6 rounded-[2rem] border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 to-pink-600 rounded-xl flex items-center justify-center text-white">
            <i className="fas fa-bullhorn"></i>
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase">Social Media Campaign</h3>
            <p className="text-[10px] text-purple-400 uppercase tracking-widest">AI-Powered Marketing</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Campaign Goal</label>
            <textarea
              value={campaignGoal}
              onChange={(e) => setCampaignGoal(e.target.value)}
              placeholder="e.g., Increase student signups by 30%, promote weekend shuttle service, launch new pragia routes..."
              className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-purple-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Target Audience</label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., University students, campus residents, weekend travelers..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Budget (Optional)</label>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g., ₵500, ₵1000, Not specified"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <button
            onClick={generateSocialCampaign}
            disabled={isGenerating || !campaignGoal.trim() || !targetAudience.trim()}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-black text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            {isGenerating ? 'Generating Campaign...' : 'Generate Social Campaign'}
          </button>
        </div>
      </div>

      {/* Campaign Strategy */}
      {campaignStrategy && (
        <div className="glass p-6 rounded-[2rem] border border-white/10 animate-in fade-in">
          <h4 className="text-sm font-black text-purple-400 uppercase mb-3">Campaign Strategy</h4>
          <p className="text-sm text-slate-300 leading-relaxed">{campaignStrategy}</p>
        </div>
      )}

      {/* Social Posts */}
      {socialPosts.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-black text-white uppercase">Platform-Specific Content</h4>
          {socialPosts.map((post, index) => (
            <div key={index} className="glass p-6 rounded-[2rem] border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 bg-gradient-to-tr ${getPlatformColor(post.platform)} rounded-xl flex items-center justify-center text-white`}>
                  <i className={getPlatformIcon(post.platform)}></i>
                </div>
                <div>
                  <h5 className="text-sm font-black text-white uppercase">{post.platform}</h5>
                  <p className="text-[9px] text-slate-500 uppercase">Media: {post.mediaType}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-slate-300 leading-relaxed">{post.content}</p>
                
                <div className="flex flex-wrap gap-2">
                  {post.hashtags.map((tag, tagIndex) => (
                    <span key={tagIndex} className="px-2 py-1 bg-purple-600/20 border border-purple-500/30 rounded-lg text-[9px] text-purple-400 font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center gap-2">
                  <i className="fas fa-chart-line text-emerald-400 text-xs"></i>
                  <span className="text-[9px] text-emerald-400 font-medium">Expected: {post.engagement}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metrics */}
      {metrics.estimatedReach > 0 && (
        <div className="glass p-6 rounded-[2rem] border border-white/10">
          <h4 className="text-sm font-black text-emerald-400 uppercase mb-4">Estimated Campaign Metrics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{(metrics.estimatedReach || 0).toLocaleString()}</p>
              <p className="text-[9px] text-slate-500 uppercase">Reach</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400">{metrics.estimatedEngagement || 0}%</p>
              <p className="text-[9px] text-slate-500 uppercase">Engagement</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-purple-400">{metrics.estimatedConversions || 0}</p>
              <p className="text-[9px] text-slate-500 uppercase">Conversions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-amber-400">₵{metrics.costPerAcquisition || 0}</p>
              <p className="text-[9px] text-slate-500 uppercase">CPA</p>
            </div>
          </div>
        </div>
      )}

      {/* Download Report */}
      {campaignStrategy && (
        <button
          onClick={downloadCampaignReport}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
        >
          <i className="fas fa-download"></i>
          Download Campaign Report
        </button>
      )}
    </div>
  );
};

export default SocialMediaMarketing;
