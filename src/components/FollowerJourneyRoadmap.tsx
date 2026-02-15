import React from "react";
import { Eye, Heart, User, UserPlus } from "lucide-react";

interface FollowerJourneyRoadmapProps {
  stats?: {
    viewed: number;
    saved: number;
    profileVisits: number;
    followed: number;
  };
}

export default function FollowerJourneyRoadmap({ stats }: FollowerJourneyRoadmapProps) {
  const checkpoints = [
    {
      label: "Post Viewed",
      stat: stats?.viewed ?? 3210,
      icon: Eye,
      color: "from-green-400 to-green-600",
      tooltip: "Most users saw this post",
    },
    {
      label: "Liked/Saved",
      stat: stats?.saved ?? 1543,
      icon: Heart,
      color: "from-pink-400 to-pink-600",
      tooltip: "High engagement at this stage",
    },
    {
      label: "Profile Visited",
      stat: stats?.profileVisits ?? 732,
      icon: User,
      color: "from-blue-400 to-blue-600",
      tooltip: "Users checked your profile",
    },
    {
      label: "Followed",
      stat: stats?.followed ?? 176,
      icon: UserPlus,
      color: "from-orange-400 to-orange-600",
      tooltip: "New followers gained",
    },
  ];

  // SVG path: start at first bubble, end at last bubble
  // We'll use 100% width and space bubbles evenly with flex
  const svgWidth = 1000;
  const svgHeight = 160;
  const bubbleCount = checkpoints.length;
  const margin = 80;
  const step = (svgWidth - 2 * margin) / (bubbleCount - 1);
  // Path: M x0 y0 Q x1 y1 x2 y2 Q x3 y3 x4 y4
  // We'll use two quadratic curves for a smooth wave
  const path = `M ${margin} 120 Q ${margin + step} 40 ${margin + step * 2} 120 Q ${margin + step * 3} 200 ${margin + step * 3} 120`;

  return (
    <section className="w-full bg-white rounded-xl shadow p-6 md:p-10 flex flex-col items-center">
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">Follower Journey Map</h2>
      <p className="text-gray-500 text-center mb-8 max-w-2xl">
        Visualize how your audience moved from discovering your post to following your profile. Hover over each stage for insights.
      </p>
      <div className="w-full pb-6">
        <div className="relative w-full flex items-center justify-between gap-8 md:gap-16" style={{height: 180}}>
          {/* SVG Wavy Path */}
          <svg className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-40 pointer-events-none" viewBox={`0 0 ${svgWidth} ${svgHeight}`} fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d={path} stroke="#e5e7eb" strokeWidth="6" fill="none" />
          </svg>
          {/* Milestones */}
          {checkpoints.map((cp, idx) => {
            const Icon = cp.icon;
            // Position bubbles evenly using flex
            return (
              <div
                key={cp.label}
                className="group flex flex-col items-center z-10 flex-1"
                style={{ position: 'relative' }}
              >
                <div className={`bg-gradient-to-br ${cp.color} rounded-full w-20 h-20 flex items-center justify-center shadow-lg transition-transform duration-200 hover:scale-105 hover:shadow-2xl cursor-pointer`}>
                  <Icon className="w-8 h-8 text-white transition-transform duration-200 group-hover:scale-110" />
                </div>
                <div className="mt-2 text-lg font-bold text-gray-800">{cp.stat.toLocaleString()}</div>
                <div className="text-xs font-medium text-gray-600 mb-1">{cp.label}</div>
                <div className="opacity-0 group-hover:opacity-100 transition bg-gray-800 text-white text-xs rounded px-2 py-1 mt-1 absolute -bottom-10 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap z-20 shadow-lg">
                  {cp.tooltip}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
} 