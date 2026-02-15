import React, { useState, useEffect } from 'react';
import { Sparkles, Rocket, Target, Megaphone, RefreshCw, TrendingUp, Users, Clock, MapPin, Heart } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type Tip = {
  icon: LucideIcon;
  text: string;
};

interface SmartGrowthTipsProps {
  tips?: Tip[];
  autoRotateInterval?: number; // in milliseconds
  className?: string;
}

// Default tips if none provided
const defaultTips: Tip[] = [
  {
    icon: Sparkles,
    text: "Post Reels between 6PM–8PM for 12% more reach."
  },
  {
    icon: Rocket,
    text: "Use 3-5 hashtags per post for optimal discoverability."
  },
  {
    icon: Target,
    text: "Engage with 20+ posts daily to boost your visibility."
  },
  {
    icon: Megaphone,
    text: "Share behind-the-scenes content to build authentic connections."
  },
  {
    icon: TrendingUp,
    text: "Post carousel content on Tuesdays for 23% higher engagement."
  },
  {
    icon: Users,
    text: "Reply to comments within 1 hour to increase engagement rate."
  },
  {
    icon: Clock,
    text: "Stories posted at 7AM get 40% more views than other times."
  },
  {
    icon: MapPin,
    text: "Add location tags to increase local discoverability by 60%."
  },
  {
    icon: Heart,
    text: "Ask questions in captions to boost comment engagement by 3x."
  }
];

export default function SmartGrowthTips({ 
  tips = defaultTips, 
  autoRotateInterval = 8000,
  className = ""
}: SmartGrowthTipsProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const nextTip = () => {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
      setIsVisible(true);
    }, 300);
  };

  const refreshTip = async () => {
    setIsLoading(true);
    // Simulate async behavior
    await new Promise(resolve => setTimeout(resolve, 500));
    nextTip();
    setIsLoading(false);
  };

  // Auto-rotate effect
  useEffect(() => {
    const interval = setInterval(() => {
      nextTip();
    }, autoRotateInterval);

    return () => clearInterval(interval);
  }, [autoRotateInterval, tips.length]);

  const currentTip = tips[currentTipIndex];
  const Icon = currentTip.icon;

  return (
    <div className={`w-full max-w-2xl mx-auto px-4 ${className}`}>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/80 via-white/60 to-white/40 backdrop-blur-sm border border-white/20 shadow-xl">
        {/* Loading shimmer overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse z-10" />
        )}
        
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900">
                Smart Growth Tip
              </h3>
            </div>
            
            <button
              onClick={refreshTip}
              disabled={isLoading}
              className="p-2 rounded-full bg-white/50 hover:bg-white/80 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Tip content with fade animation */}
          <div 
            className={`transition-all duration-300 ease-in-out ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-md flex-shrink-0">
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-gray-800 text-base md:text-lg leading-relaxed font-medium">
                  {currentTip.text}
                </p>
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex justify-center gap-1 mt-6">
            {tips.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentTipIndex 
                    ? 'bg-gradient-to-r from-[#f9ce34] to-[#ee2a7b] scale-125' 
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 