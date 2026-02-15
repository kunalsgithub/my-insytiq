import { useParams, useNavigate } from "react-router-dom";
import { useInfluencers } from "@/hooks/useInfluencers";
import { Popover } from '@headlessui/react';

function formatNumber(num) {
  if (num === undefined || num === null || num === "" || isNaN(num)) return 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return Number(num).toLocaleString();
}

function gradientCategory(category: string) {
  // Simple gradient text for category name
  return <span className="bg-gradient-to-r from-pink-500 via-yellow-400 to-blue-400 bg-clip-text text-transparent">{category.charAt(0).toUpperCase() + category.slice(1)}</span>;
}

export default function TopInfluencerCategory() {
  const { category } = useParams();
  const influencers = useInfluencers(category);
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto py-12 px-2 md:px-0">
      {/* Header section */}
      <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-4">
        Instagram {gradientCategory(category || "")} Top Influencer
      </h1>
      <p className="text-center text-lg md:text-xl text-gray-700 mb-10 max-w-3xl mx-auto">
        On Instagram, {category && <b>{category}</b>} is always a trend: we have selected the top 20 Influencers who share posts, reels, videos and stories about {category}. Cooking tips, recipes, food trends, gastronomy: watch their style and post <b>original contents</b>.
      </p>
      <div className="space-y-6">
        {influencers.slice(0, 20).map((inf: any, idx: number) => (
          <div key={inf.Username + idx} className="bg-gray-100 rounded-2xl shadow flex flex-col md:flex-row items-center gap-6 px-6 py-6 md:py-8">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <img src={inf.Avatar} alt={inf.Username} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow" />
              <div>
                <div className="font-bold text-lg flex items-center gap-2">{inf.Username} {inf.Verified === 'TRUE' && <span className="text-blue-500">✔️</span>}</div>
                <div className="text-gray-500 text-sm">{inf.Name}</div>
              </div>
            </div>
            <div className="flex-1 flex flex-wrap justify-center md:justify-end gap-8 md:gap-12 text-center">
              <div>
                <div className="font-bold text-2xl">{inf.Followers}</div>
                <div className="text-xs text-gray-500">Follower</div>
              </div>
              <div>
                <div className="font-bold text-2xl">{inf.Following}</div>
                <div className="text-xs text-gray-500">Following</div>
              </div>
              <div>
                <div className="font-bold text-2xl">{inf.Posts}</div>
                <div className="text-xs text-gray-500">Post</div>
              </div>
              <div>
                <div className="font-bold text-2xl">{inf.ER}</div>
                <div className="text-xs text-gray-500">E.R.</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 mt-4 md:mt-0">
              <Popover className="relative">
                {({ open }) => (
                  <>
                    <Popover.Button 
                      className={`
                        inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                        ${open 
                          ? 'bg-blue-50 text-blue-700 border-blue-200' 
                          : 'bg-white text-gray-700 border-gray-200'
                        }
                        border rounded-full shadow-sm hover:bg-gray-50 
                        transition-all duration-200 ease-in-out
                      `}
                    >
                      Show Details
                      <svg 
                        className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Popover.Button>

                    <Popover.Overlay 
                      className={`fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-200 ${
                        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
                      }`} 
                    />

                    <Popover.Panel className="absolute right-0 z-50 mt-2 w-96 transform transition-all duration-200 ease-out">
                      <div className="bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 overflow-hidden">
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                          <div className="flex items-center gap-3">
                            <img 
                              src={inf.Avatar} 
                              alt={inf.Username} 
                              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow"
                            />
                            <div>
                              <h3 className="font-bold text-lg flex items-center gap-2">
                                {inf.Username}
                                {inf.Verified === 'TRUE' && (
                                  <span className="text-blue-500" title="Verified Account">✔️</span>
                                )}
                              </h3>
                              <p className="text-sm text-gray-600">{inf.Name}</p>
                            </div>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                          {/* Main Stats Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm text-gray-500">Followers</div>
                              <div className="text-xl font-bold text-gray-900">{inf.Followers}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm text-gray-500">Following</div>
                              <div className="text-xl font-bold text-gray-900">{inf.Following}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm text-gray-500">Total Posts</div>
                              <div className="text-xl font-bold text-gray-900">{inf.Posts}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm text-gray-500">Avg Likes</div>
                              <div className="text-xl font-bold text-gray-900">{formatNumber(inf.AverageLikes)}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm text-gray-500">Avg Comments</div>
                              <div className="text-xl font-bold text-gray-900">{formatNumber(inf.AverageComments)}</div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <div className="text-sm text-gray-500">Engagement Rate</div>
                              <div className="text-xl font-bold text-gray-900">{inf.ER}%</div>
                            </div>
                          </div>

                          {/* Additional Info */}
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-900">About</h4>
                            <p className="text-sm text-gray-600">
                              {inf.Bio || `Top ${category} influencer on Instagram sharing amazing content about ${category}.`}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <a
                              href={`https://instagram.com/${inf.Username}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              View Profile
                            </a>
                            <button
                              onClick={() => navigate(`/influencer/${inf.Username}`)}
                              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                              Analytics
                            </button>
                          </div>
                        </div>
                      </div>
                    </Popover.Panel>
                  </>
                )}
              </Popover>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 