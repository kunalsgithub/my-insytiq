import { Flame, User, Heart, Music } from "lucide-react";

export default function TopInsightsThisWeek() {
  return (
    <div className="bg-white rounded-xl shadow border p-6">
      <h3 className="text-lg font-bold text-center mb-4">Top Performers of the Week</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-3 border-l-4 border-orange-400 pl-3">
          <Flame className="text-orange-400" />
          <div>
            <div className="text-xs text-gray-500">Trending Hashtag</div>
            <div className="font-bold text-sm text-orange-500">#spiderman <span className="text-green-500">↑ +120%</span></div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l-4 border-yellow-400 pl-3">
          <User className="text-yellow-400" />
          <div>
            <div className="text-xs text-gray-500">Top Creator</div>
            <div className="font-bold text-sm text-yellow-500">@reelqueen <span className="text-green-500">↑ +45K followers</span></div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l-4 border-pink-400 pl-3">
          <Heart className="text-pink-400" />
          <div>
            <div className="text-xs text-gray-500">Most Liked Post</div>
            <div className="font-bold text-sm text-pink-500">"Summer Glow" <span className="text-gray-700">823K likes</span></div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-l-4 border-blue-400 pl-3">
          <Music className="text-blue-400" />
          <div>
            <div className="text-xs text-gray-500">Most Used Audio</div>
            <div className="font-bold text-sm text-blue-500">"Calm Down" <span className="text-gray-700">112K uses</span></div>
          </div>
        </div>
      </div>
    </div>
  );
} 