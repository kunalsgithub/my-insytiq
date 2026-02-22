import React, { useState } from 'react';
import FollowerJourneyRoadmap from "../../components/FollowerJourneyRoadmap";
import { Button } from "../../components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { ChevronDown, Check } from 'lucide-react';

const dateOptions = [
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 14 Days', value: '14' },
  { label: 'Last 30 Days', value: '30' },
];

// Helper to generate dummy posts
function generateDummyPosts(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    image: '/public/placeholder.svg',
    reach: Math.floor(Math.random() * 2000) + 500,
    saves: Math.floor(Math.random() * 400) + 50,
    profileVisits: Math.floor(Math.random() * 200) + 20,
    follows: Math.floor(Math.random() * 60) + 5,
    id: i + 1,
  }));
}

const postsByRange = {
  '7': generateDummyPosts(3),
  '14': generateDummyPosts(10),
  '30': generateDummyPosts(25),
};

export default function FollowerJourneyMap() {
  const [dateRange, setDateRange] = useState('7');
  const visiblePosts = postsByRange[dateRange];

  // Calculate overall totals for the journey map
  const totals = {
    viewed: visiblePosts.reduce((sum, p) => sum + p.reach, 0),
    saved: visiblePosts.reduce((sum, p) => sum + p.saves, 0),
    profileVisits: visiblePosts.reduce((sum, p) => sum + p.profileVisits, 0),
    followed: visiblePosts.reduce((sum, p) => sum + p.follows, 0),
  };

  return (
    <div className="blur-overlay-container max-w-5xl mx-auto px-4 py-8 w-full">
      {/* Roadmap Visualization */}
      <FollowerJourneyRoadmap stats={totals} />

      {/* Date Filter */}
      <div className="flex justify-end mb-6" style={{ marginTop: 25 }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="font-semibold text-sm border-2 border-transparent bg-white text-gray-700 hover:border-[#ee2a7b] focus:border-[#ee2a7b] px-4 py-2 flex items-center gap-2">
              <span className="bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] bg-clip-text text-transparent font-bold">
                {dateOptions.find(opt => opt.value === dateRange)?.label}
              </span>
              <ChevronDown className="w-4 h-4 ml-1 text-[#ee2a7b]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {dateOptions.map(opt => (
              <DropdownMenuItem
                key={opt.value}
                onSelect={() => setDateRange(opt.value)}
                className={dateRange === opt.value ? 'font-bold text-[#ee2a7b] bg-[#f9ce34]/10' : ''}
              >
                {opt.label}
                {dateRange === opt.value && <Check className="ml-2 w-4 h-4 text-[#ee2a7b]" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Post</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reach</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Saves</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Profile Visits</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Follows</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {visiblePosts.map((post, idx) => (
              <tr key={post.id}>
                <td className="px-4 py-3 flex items-center gap-3">
                  <img src={post.image} alt={`Post ${post.id}`} className="w-12 h-12 rounded object-cover border border-gray-200" />
                </td>
                <td className="px-4 py-3 font-medium text-gray-700">{post.reach}</td>
                <td className="px-4 py-3 font-medium text-gray-700">{post.saves}</td>
                <td className="px-4 py-3 font-medium text-gray-700">{post.profileVisits}</td>
                <td className="px-4 py-3 font-medium text-gray-700">{post.follows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Blur Overlay */}
      <div className="blur-overlay">
        <div className="blur-overlay-text">🚀 Upcoming</div>
      </div>
    </div>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-[#d72989]/10 border border-[#d72989]/30 rounded-full w-20 h-20 flex items-center justify-center mb-2">
        <span className="text-xl font-bold text-[#d72989]">{value}</span>
      </div>
      <span className="text-sm font-medium text-gray-700 text-center w-20">{label}</span>
    </div>
  );
}

function FunnelArrow() {
  return (
    <svg className="w-8 h-8 text-gray-300 md:rotate-0 rotate-90" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0l-4-4m4 4l-4 4" />
    </svg>
  );
} 