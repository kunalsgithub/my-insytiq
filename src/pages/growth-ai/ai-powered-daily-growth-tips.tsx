import React, { useState, useEffect } from 'react';
import { BrainCircuit, RefreshCw, Clock, MapPin, TrendingUp, Target, Users, Sparkles, Info, Lock, Calendar, Hash, BarChart3, MessageSquare, Zap, Eye, Heart, Share2, Filter } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';

// AI Feature data
const aiFeatures = [
  {
    id: 1,
    icon: Clock,
    title: "Optimal Post Timing",
    description: "Post at 6PM today for 23% more engagement. Your audience is most active during this window.",
    metric: "+23% engagement",
    color: "from-blue-400 to-blue-600",
    tooltip: "Based on your last 30 days of posting data and audience timezone analysis."
  },
  {
    id: 2,
    icon: MapPin,
    title: "Location Strategy",
    description: "Add #NYC and #Manhattan to your next post. Location tags increase discoverability by 40%.",
    metric: "+40% discoverability",
    color: "from-green-400 to-green-600",
    tooltip: "Your audience is 65% from NYC area, and location hashtags perform 2.3x better for you."
  },
  {
    id: 3,
    icon: TrendingUp,
    title: "Content Type Optimization",
    description: "Your carousel posts get 3x more saves than single images. Create a 5-slide carousel this week.",
    metric: "3x more saves",
    color: "from-purple-400 to-purple-600",
    tooltip: "Analysis shows your carousel content has 89% higher engagement rate than single posts."
  },
  {
    id: 4,
    icon: Hash,
    title: "Hashtag Optimization",
    description: "Use #indiefashion and #ootdstyle instead of #fashion. Lower competition, higher reach.",
    metric: "+60% reach",
    color: "from-pink-400 to-pink-600",
    tooltip: "These hashtags have 40% less competition while maintaining high engagement potential."
  },
  {
    id: 5,
    icon: Calendar,
    title: "Content Calendar",
    description: "Schedule 3 posts this week: Tuesday (carousel), Thursday (reel), Saturday (story).",
    metric: "Optimal schedule",
    color: "from-orange-400 to-orange-600",
    tooltip: "Based on your audience's weekly activity patterns and content performance history."
  },
  {
    id: 6,
    icon: MessageSquare,
    title: "Engagement Strategy",
    description: "Reply to comments within 1 hour to increase engagement rate by 2.5x.",
    metric: "2.5x engagement",
    color: "from-teal-400 to-teal-600",
    tooltip: "Quick responses signal active presence and encourage more interactions."
  },
  {
    id: 7,
    icon: BarChart3,
    title: "Audience Insights",
    description: "Your audience is 78% female, 18-34 age group. Create content that resonates with this demographic.",
    metric: "78% female audience",
    color: "from-indigo-400 to-indigo-600",
    tooltip: "Demographic analysis based on your follower growth and engagement patterns."
  },
  {
    id: 8,
    icon: Zap,
    title: "Trending Opportunities",
    description: "Jump on #SummerVibes trend. Posts with this hashtag are getting 3x more reach this week.",
    metric: "3x more reach",
    color: "from-yellow-400 to-yellow-600",
    tooltip: "Real-time trend analysis shows this hashtag is gaining momentum rapidly."
  },
  {
    id: 9,
    icon: Eye,
    title: "Story Optimization",
    description: "Post stories at 7AM for 40% more views. Your audience checks stories early morning.",
    metric: "+40% story views",
    color: "from-red-400 to-red-600",
    tooltip: "Story viewing patterns show peak activity between 7-9 AM for your audience."
  }
];

export default function AIPoweredDailyGrowthTips() {
  const [features, setFeatures] = useState(aiFeatures);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const refreshFeatures = async () => {
    if (!isLoggedIn) {
      setShowLoginPrompt(true);
      setTimeout(() => setShowLoginPrompt(false), 3000);
      return;
    }
    
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setFeatures([...aiFeatures].sort(() => 0.5 - Math.random()));
    setIsLoading(false);
    toast({ title: 'AI insights refreshed!' });
  };

  const handleFeatureClick = () => {
    if (!isLoggedIn) {
      setShowLoginPrompt(true);
      setTimeout(() => setShowLoginPrompt(false), 3000);
    }
  };

  return (
    <TooltipProvider>
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 w-full md:pl-16">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 md:ml-16 md:max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] flex items-center justify-center shadow-lg">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-1">Your AI-Powered Growth Tips</h1>
              <p className="text-gray-500 text-lg md:text-xl">
                {isLoggedIn 
                  ? "Smart, daily suggestions to boost your growth based on your performance patterns."
                  : "Unlock personalized AI insights by connecting your Instagram account."
                }
              </p>
            </div>
          </div>
          <button
            onClick={refreshFeatures}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white font-semibold shadow hover:scale-105 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoggedIn ? 'Refresh Insights' : 'Preview Mode'}
          </button>
        </div>

        {/* Login Banner (if not logged in) */}
        {!isLoggedIn && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 mb-8 md:ml-16 md:max-w-6xl">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-amber-800 font-medium">Connect your Instagram account to unlock personalized AI insights and actionable growth strategies.</p>
              </div>
              <button 
                onClick={() => setIsLoggedIn(true)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow hover:scale-105 hover:shadow-lg transition-all"
              >
                🔓 Connect Instagram
              </button>
            </div>
          </div>
        )}

        {/* AI Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12 relative md:ml-16">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className={`bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer ${
                  !isLoggedIn ? 'blur-sm hover:blur-none' : ''
                }`}
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeIn 0.6s ease-out forwards'
                }}
                onClick={handleFeatureClick}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg">{feature.title}</h3>
                      {isLoggedIn && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-4 h-4 text-gray-400 hover:text-[#ee2a7b] cursor-pointer transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">{feature.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className={`${!isLoggedIn ? 'blur-sm' : ''}`}>
                      <p className="text-gray-600 text-sm leading-relaxed mb-3">{feature.description}</p>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#f9ce34]/20 via-[#ee2a7b]/10 to-[#6228d7]/20">
                        <Zap className="w-3 h-3 text-[#ee2a7b]" />
                        <span className="text-xs font-semibold text-[#ee2a7b]">{feature.metric}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Login overlay for blurred cards */}
                {!isLoggedIn && (
                  <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-transparent rounded-2xl flex items-center justify-center">
                    <div className="text-center">
                      <Lock className="w-8 h-8 text-[#ee2a7b] mx-auto mb-2" />
                      <p className="text-sm font-medium text-[#ee2a7b]">Login to see details</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Performance Stats Section */}
        <div className={`bg-gradient-to-br from-[#f9fafb] to-[#f3f4f6] rounded-2xl p-6 relative md:ml-16 md:max-w-6xl ${
          !isLoggedIn ? 'blur-sm' : ''
        }`}>
          {!isLoggedIn && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-transparent rounded-2xl flex items-center justify-center z-10">
              <div className="text-center">
                <Lock className="w-8 h-8 text-[#ee2a7b] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#ee2a7b]">Connect Instagram to see your performance</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-[#ee2a7b]" />
            <h3 className="font-bold text-gray-900 text-xl">This Week's Performance</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">+23%</p>
                <p className="text-sm text-gray-600">Engagement Rate</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">+156</p>
                <p className="text-sm text-gray-600">New Followers</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">+89%</p>
                <p className="text-sm text-gray-600">Reach Growth</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-gray-900">+45%</p>
                <p className="text-sm text-gray-600">Save Rate</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login Prompt Toast */}
        {showLoginPrompt && (
          <div className="fixed top-4 right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span className="font-medium">Connect Instagram to unlock full insights!</span>
            </div>
          </div>
        )}

        {/* CSS for animations */}
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </TooltipProvider>
  );
}