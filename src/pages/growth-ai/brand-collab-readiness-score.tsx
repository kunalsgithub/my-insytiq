import React from "react";
import { Bot, CheckCircle, AlertTriangle, XCircle, User } from "lucide-react";

// Dummy data
const score = 78;
const scoreColor = score <= 40 ? "from-red-400 to-red-600" : score <= 70 ? "from-yellow-400 to-yellow-500" : "from-green-400 to-green-600";
const scoreStatus = score <= 40 ? "Poor" : score <= 70 ? "Needs Work" : "Good";
const breakdown = [
  { title: "Engagement Consistency", weight: 25, value: 80, status: "Good" },
  { title: "Follower Quality", weight: 20, value: 65, status: "Needs Work" },
  { title: "Niche Clarity", weight: 15, value: 90, status: "Good" },
  { title: "Post Frequency", weight: 15, value: 55, status: "Needs Work" },
  { title: "Audience Interaction (DMs)", weight: 15, value: 40, status: "Poor" },
  { title: "Brand Suitability Signals", weight: 10, value: 85, status: "Good" },
];
const recommendations = [
  "Post niche reels 3x per week",
  "Clean up ghost followers for better quality score",
  "Your carousel posts drive best engagement — do more!",
  "Reply to more DMs to boost interaction score",
];
const aiSummary =
  "This creator has strong audience quality and consistent engagement. Well-suited for fashion, beauty, and D2C brands.";

function getStatusChip(status: string) {
  if (status === "Good")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        <CheckCircle className="w-4 h-4" /> Good
      </span>
    );
  if (status === "Needs Work")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        <AlertTriangle className="w-4 h-4" /> Needs Work
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <XCircle className="w-4 h-4" /> Poor
    </span>
  );
}

export default function BrandCollabReadinessScore() {
  return (
    <div className="blur-overlay-container max-w-4xl mx-auto px-4 py-10 w-full">
      {/* Top Section */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Brand Collab Readiness Score</h1>
        <p className="text-gray-500 text-lg md:text-xl">Evaluate how brand-ready your Instagram profile is for collaborations.</p>
      </div>

      {/* Hero Score Meter */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative w-40 h-40 mb-2">
          <svg className="w-full h-full" viewBox="0 0 160 160">
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="16"
            />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              strokeDasharray={2 * Math.PI * 68}
              strokeDashoffset={2 * Math.PI * 68 * (1 - score / 100)}
              strokeWidth="16"
              className={`transition-all duration-700 origin-center -rotate-90`}
              strokeLinecap="round"
              style={{ stroke: `url(#score-gradient)` }}
            />
            <defs>
              <linearGradient id="score-gradient" x1="0" y1="0" x2="1" y2="1">
                {score <= 40 ? (
                  <>
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="100%" stopColor="#b91c1c" />
                  </>
                ) : score <= 70 ? (
                  <>
                    <stop offset="0%" stopColor="#fde68a" />
                    <stop offset="100%" stopColor="#f59e42" />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor="#4ade80" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </>
                )}
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gray-900">{score}/100</span>
          </div>
        </div>
        <span className="text-sm text-gray-500 mt-2">Overall Readiness</span>
      </div>

      {/* Score Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {breakdown.map((item, i) => (
          <div
            key={item.title}
            className="bg-white rounded-2xl shadow p-5 flex flex-col gap-2 hover:shadow-lg transition-shadow duration-200"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-gray-800">{item.title}</span>
              <span className="text-xs text-gray-400 font-bold">{item.weight}%</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              {getStatusChip(item.status)}
              <span className="ml-auto text-xs text-gray-500 font-medium">{item.value}/100</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${item.status === "Good" ? "bg-gradient-to-r from-green-400 to-green-600" : item.status === "Needs Work" ? "bg-gradient-to-r from-yellow-400 to-yellow-500" : "bg-gradient-to-r from-red-400 to-red-600"}`}
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations Box */}
      <div className="bg-gradient-to-br from-[#f9fafb] to-[#f3f4f6] rounded-2xl shadow p-6 mb-8">
        <h3 className="font-bold text-lg mb-2 text-gray-800">Recommended Next Steps</h3>
        <ul className="list-disc pl-5 text-gray-700 space-y-1">
          {recommendations.map((tip, i) => (
            <li key={i}>{tip}</li>
          ))}
        </ul>
      </div>

      {/* AI Summary Bubble */}
      <div className="flex items-center gap-4 bg-white rounded-2xl shadow p-5 max-w-2xl mx-auto">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-[#ee2a7b] to-[#6228d7] flex items-center justify-center">
          <Bot className="w-7 h-7 text-white" />
        </div>
        <blockquote className="text-gray-700 italic text-base">
          “{aiSummary}”
        </blockquote>
      </div>
      
      {/* Blur Overlay */}
      <div className="blur-overlay">
        <div className="blur-overlay-text">🚀 Upcoming</div>
      </div>
    </div>
  );
} 