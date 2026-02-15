import React, { useState } from "react";
import { Users, User, UserPlus, Heart, MessageCircle, MessageSquare, Calendar, X } from "lucide-react";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const rangeOptions = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "This Month", value: "month" },
  { label: "Custom Range", value: "custom" },
];

function getDummyFunnelData(range: string) {
  // Return different dummy data for each range
  switch (range) {
    case "7d":
      return [
        { label: "Post Reach", value: 4200, icon: Users, dropoff: 0, dropoffLabel: "", color: "from-blue-400 to-blue-600", badge: "green", tooltip: "Total unique users who saw your post.", prev: 4000 },
        { label: "Profile Visits", value: 1200, icon: User, dropoff: 71, dropoffLabel: "↓ 71%", color: "from-blue-400 to-blue-600", badge: "red", tooltip: "Users who visited your profile after seeing the post.", prev: 1100 },
        { label: "Follows", value: 350, icon: UserPlus, dropoff: 71, dropoffLabel: "↓ 71%", color: "from-green-400 to-green-600", badge: "red", tooltip: "Users who followed you after visiting your profile.", prev: 300 },
        { label: "Likes / Saves", value: 290, icon: Heart, dropoff: 17, dropoffLabel: "↓ 17%", color: "from-pink-400 to-pink-600", badge: "yellow", tooltip: "Users who liked or saved your post.", prev: 250 },
        { label: "Comments", value: 110, icon: MessageSquare, dropoff: 62, dropoffLabel: "↓ 62%", color: "from-yellow-400 to-yellow-500", badge: "red", tooltip: "Users who commented on your post.", prev: 100 },
        { label: "DMs Sent", value: 30, icon: MessageCircle, dropoff: 73, dropoffLabel: "↓ 73%", color: "from-purple-400 to-purple-600", badge: "red", tooltip: "Users who sent you a DM after engaging.", prev: 25 },
      ];
    case "30d":
      return [
        { label: "Post Reach", value: 12400, icon: Users, dropoff: 0, dropoffLabel: "", color: "from-blue-400 to-blue-600", badge: "green", tooltip: "Total unique users who saw your post.", prev: 11000 },
        { label: "Profile Visits", value: 4200, icon: User, dropoff: 66, dropoffLabel: "↓ 66%", color: "from-blue-400 to-blue-600", badge: "red", tooltip: "Users who visited your profile after seeing the post.", prev: 3900 },
        { label: "Follows", value: 1100, icon: UserPlus, dropoff: 74, dropoffLabel: "↓ 74%", color: "from-green-400 to-green-600", badge: "red", tooltip: "Users who followed you after visiting your profile.", prev: 900 },
        { label: "Likes / Saves", value: 900, icon: Heart, dropoff: 18, dropoffLabel: "↓ 18%", color: "from-pink-400 to-pink-600", badge: "yellow", tooltip: "Users who liked or saved your post.", prev: 800 },
        { label: "Comments", value: 320, icon: MessageSquare, dropoff: 64, dropoffLabel: "↓ 64%", color: "from-yellow-400 to-yellow-500", badge: "red", tooltip: "Users who commented on your post.", prev: 300 },
        { label: "DMs Sent", value: 80, icon: MessageCircle, dropoff: 75, dropoffLabel: "↓ 75%", color: "from-purple-400 to-purple-600", badge: "red", tooltip: "Users who sent you a DM after engaging.", prev: 60 },
      ];
    case "month":
      return [
        { label: "Post Reach", value: 9800, icon: Users, dropoff: 0, dropoffLabel: "", color: "from-blue-400 to-blue-600", badge: "green", tooltip: "Total unique users who saw your post.", prev: 9000 },
        { label: "Profile Visits", value: 3500, icon: User, dropoff: 64, dropoffLabel: "↓ 64%", color: "from-blue-400 to-blue-600", badge: "red", tooltip: "Users who visited your profile after seeing the post.", prev: 3200 },
        { label: "Follows", value: 900, icon: UserPlus, dropoff: 74, dropoffLabel: "↓ 74%", color: "from-green-400 to-green-600", badge: "red", tooltip: "Users who followed you after visiting your profile.", prev: 800 },
        { label: "Likes / Saves", value: 700, icon: Heart, dropoff: 20, dropoffLabel: "↓ 20%", color: "from-pink-400 to-pink-600", badge: "yellow", tooltip: "Users who liked or saved your post.", prev: 650 },
        { label: "Comments", value: 250, icon: MessageSquare, dropoff: 64, dropoffLabel: "↓ 64%", color: "from-yellow-400 to-yellow-500", badge: "red", tooltip: "Users who commented on your post.", prev: 220 },
        { label: "DMs Sent", value: 60, icon: MessageCircle, dropoff: 76, dropoffLabel: "↓ 76%", color: "from-purple-400 to-purple-600", badge: "red", tooltip: "Users who sent you a DM after engaging.", prev: 50 },
      ];
    default:
      return [
        { label: "Post Reach", value: 10000, icon: Users, dropoff: 0, dropoffLabel: "", color: "from-blue-400 to-blue-600", badge: "green", tooltip: "Total unique users who saw your post.", prev: 9500 },
        { label: "Profile Visits", value: 4000, icon: User, dropoff: 60, dropoffLabel: "↓ 60%", color: "from-blue-400 to-blue-600", badge: "red", tooltip: "Users who visited your profile after seeing the post.", prev: 3700 },
        { label: "Follows", value: 1000, icon: UserPlus, dropoff: 75, dropoffLabel: "↓ 75%", color: "from-green-400 to-green-600", badge: "red", tooltip: "Users who followed you after visiting your profile.", prev: 900 },
        { label: "Likes / Saves", value: 800, icon: Heart, dropoff: 20, dropoffLabel: "↓ 20%", color: "from-pink-400 to-pink-600", badge: "yellow", tooltip: "Users who liked or saved your post.", prev: 700 },
        { label: "Comments", value: 200, icon: MessageSquare, dropoff: 60, dropoffLabel: "↓ 60%", color: "from-yellow-400 to-yellow-500", badge: "red", tooltip: "Users who commented on your post.", prev: 180 },
        { label: "DMs Sent", value: 50, icon: MessageCircle, dropoff: 75, dropoffLabel: "↓ 75%", color: "from-purple-400 to-purple-600", badge: "red", tooltip: "Users who sent you a DM after engaging.", prev: 40 },
      ];
  }
}

function getBadgeColor(badge: string) {
  if (badge === "green") return "bg-green-100 text-green-700";
  if (badge === "yellow") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function getBarWidth(idx: number) {
  return 100 - idx * 10;
}

export default function EngagementFunnelBreakdown() {
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [funnel, setFunnel] = useState(getDummyFunnelData("7d"));
  const [updatedText, setUpdatedText] = useState("Updated for: Last 7 Days");
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  function handleRangeChange(e: React.ChangeEvent<HTMLSelectElement> | { target: { value: string } }) {
    const val = e.target.value;
    setRange(val);
    
    if (val === "custom") {
      setShowCustomDatePicker(true);
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      setFunnel(getDummyFunnelData(val));
      setUpdatedText(`Updated for: ${rangeOptions.find(o => o.value === val)?.label}`);
      setLoading(false);
    }, 900);
  }

  function handleCustomDateSubmit() {
    if (!customStartDate || !customEndDate) return;
    
    setLoading(true);
    setTimeout(() => {
      setFunnel(getDummyFunnelData("custom"));
      setUpdatedText(`Updated for: ${customStartDate} - ${customEndDate}`);
      setLoading(false);
      setShowCustomDatePicker(false);
    }, 900);
  }

  function handleCustomDateCancel() {
    setShowCustomDatePicker(false);
    setCustomStartDate("");
    setCustomEndDate("");
    setRange("7d");
  }

  return (
    <div className="blur-overlay-container max-w-5xl mx-auto px-4 py-10 w-full">
      {/* Title & Filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Engagement Funnel Breakdown</h1>
          <p className="text-gray-500 text-lg md:text-xl">Track how your audience flows from seeing your content to meaningful actions.</p>
        </div>
        <div className="flex justify-end md:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="font-semibold text-sm border-2 border-transparent bg-white text-gray-700 hover:border-[#ee2a7b] focus:border-[#ee2a7b] px-4 py-2 flex items-center gap-2">
                <span className="bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] bg-clip-text text-transparent font-bold">
                  {range === "custom" && customStartDate && customEndDate 
                    ? `${customStartDate} to ${customEndDate}` 
                    : rangeOptions.find(opt => opt.value === range)?.label}
                </span>
                <ChevronDown className="w-4 h-4 ml-1 text-[#ee2a7b]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {rangeOptions.map(opt => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => handleRangeChange({ target: { value: opt.value } } as any)}
                  className={range === opt.value ? 'font-bold text-[#ee2a7b] bg-[#f9ce34]/10' : ''}
                >
                  {opt.label}
                  {range === opt.value && <Check className="ml-2 w-4 h-4 text-[#ee2a7b]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Custom Date Range Picker Modal */}
      {showCustomDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Select Custom Date Range</h3>
              <button 
                onClick={handleCustomDateCancel}
                className="text-gray-400 hover:text-[#ee2a7b] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="start-date" className="text-sm font-medium text-gray-700 mb-2 block">
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div>
                <Label htmlFor="end-date" className="text-sm font-medium text-gray-700 mb-2 block">
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleCustomDateCancel}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCustomDateSubmit}
                disabled={!customStartDate || !customEndDate}
                className="flex-1 bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white hover:opacity-90"
              >
                Apply Range
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Updated for text */}
      <div className={`text-sm font-medium text-[#ee2a7b] mb-4 transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}>{updatedText}</div>

      {/* Funnel Stages */}
      <div className="flex flex-col md:flex-row md:items-end gap-8 md:gap-4 mb-10 w-full">
        {loading ? (
          <div className="w-full flex justify-center items-center min-h-[220px]">
            <div className="w-12 h-12 border-4 border-[#ee2a7b]/30 border-t-[#ee2a7b] rounded-full animate-spin" />
          </div>
        ) : (
          funnel.map((stage, idx) => {
            const Icon = stage.icon;
            const prev = stage.prev || 1;
            const diff = stage.value - prev;
            const percent = prev ? Math.abs(Math.round((diff / prev) * 100)) : 0;
            const isDrop = diff < 0;
            return (
              <div
                key={stage.label}
                className="group w-full md:flex-1 flex flex-col items-center md:items-stretch bg-white rounded-xl shadow p-4 transition-transform duration-200 hover:scale-105 hover:shadow-lg relative md:min-w-[220px] md:max-w-[340px] overflow-visible"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`bg-gradient-to-br ${stage.color} rounded-full w-12 h-12 flex items-center justify-center shadow-md`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  {stage.dropoff > 0 && (
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${getBadgeColor(stage.badge)} relative group-hover:scale-105 transition-transform cursor-pointer`}>
                      {stage.dropoffLabel}
                      <span className="absolute left-1/2 -translate-x-1/2 top-8 opacity-0 group-hover:opacity-100 bg-gray-800 text-white text-[11px] rounded px-2 py-1 z-20 shadow-lg max-w-[200px] whitespace-nowrap transition pointer-events-none">
                        Compared to previous
                      </span>
                    </span>
                  )}
                  {stage.dropoff === 0 && (
                    <span className="relative group-hover:scale-105 transition-transform cursor-pointer">
                      <span className="absolute left-1/2 -translate-x-1/2 top-8 opacity-0 group-hover:opacity-100 bg-gray-800 text-white text-[11px] rounded px-2 py-1 z-20 shadow-lg max-w-[200px] whitespace-nowrap transition pointer-events-none">
                        Compared to previous
                      </span>
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">{stage.value.toLocaleString()}</div>
                <div className="text-sm font-medium text-gray-700 mb-2">{stage.label}</div>
                {/* Progress Bar */}
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${stage.color}`}
                    style={{ width: `${getBarWidth(idx)}%` }}
                  />
                </div>
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-10 bg-gray-800 text-white text-xs rounded px-2 py-1 z-20 shadow-lg whitespace-nowrap">
                  {stage.tooltip}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Insights Button & AI Drop-Off Insight Centered */}
      <div className="flex flex-col items-center justify-center w-full mt-8 mb-8 gap-6">
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white font-semibold shadow hover:scale-105 hover:shadow-lg transition-all"
          onClick={() => setShowModal(true)}
        >
          <span role="img" aria-label="chart">📈</span> See performance insights
        </button>
        <div className="bg-gradient-to-br from-[#f9fafb] to-[#f3f4f6] rounded-2xl shadow p-6 flex items-center gap-4 max-w-2xl mx-auto text-center">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-[#ee2a7b] to-[#6228d7] flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-gray-700 text-base">
            Most users drop after viewing your post but not visiting profile. Try adding stronger CTA in captions or comments.
          </span>
        </div>
      </div>

      {/* Insights Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full relative animate-fade-in">
            <button className="absolute top-3 right-3 text-gray-400 hover:text-[#ee2a7b] text-2xl font-bold" onClick={() => setShowModal(false)}>&times;</button>
            <h2 className="text-xl font-bold mb-4 text-[#ee2a7b]">Top Performing Posts</h2>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <img src="/public/placeholder.svg" alt="Post 1" className="w-12 h-12 rounded object-cover border border-gray-200" />
                <div>
                  <div className="font-semibold text-gray-800">Reel: "How to grow fast"</div>
                  <div className="text-xs text-gray-500">Reach: 8,900 • Likes: 1,200 • Follows: 320</div>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <img src="/public/placeholder.svg" alt="Post 2" className="w-12 h-12 rounded object-cover border border-gray-200" />
                <div>
                  <div className="font-semibold text-gray-800">Carousel: "Content ideas for June"</div>
                  <div className="text-xs text-gray-500">Reach: 7,200 • Likes: 950 • Follows: 210</div>
                </div>
              </li>
              <li className="flex items-center gap-3">
                <img src="/public/placeholder.svg" alt="Post 3" className="w-12 h-12 rounded object-cover border border-gray-200" />
                <div>
                  <div className="font-semibold text-gray-800">Story: "Behind the scenes"</div>
                  <div className="text-xs text-gray-500">Reach: 5,100 • Likes: 400 • Follows: 80</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      )}
      
      {/* Blur Overlay */}
      <div className="blur-overlay">
        <div className="blur-overlay-text">🚀 Upcoming</div>
      </div>
    </div>
  );
} 