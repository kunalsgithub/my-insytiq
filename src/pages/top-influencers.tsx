import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Utensils,
  Plane,
  Flower,
  Dumbbell,
  Leaf,
  Users,
  Handshake,
  Headphones,
  Camera,
  Shirt,
  Cat,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useTopInfluencers } from "../hooks/useTopInfluencers";
import { hasAccess, PLAN } from "../utils/accessControl";

const categories = [
  { id: "food", name: "Food", icon: Utensils },
  { id: "travel", name: "Travel", icon: Plane },
  { id: "beauty", name: "Beauty", icon: Flower },
  { id: "sport-fitness", name: "Sport & Fitness", icon: Dumbbell },
  { id: "lifestyle", name: "Lifestyle", icon: Leaf },
  { id: "parenting", name: "Parenting", icon: Users },
  { id: "business", name: "Business", icon: Handshake },
  { id: "music", name: "Music", icon: Headphones },
  { id: "photography", name: "Photography", icon: Camera },
  { id: "fashion", name: "Fashion", icon: Shirt },
  { id: "animals", name: "Animals", icon: Cat },
];

// Cache for storing fetched data
const dataCache = new Map();

function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return Number(num).toLocaleString();
}

function gradientCategory(category: string) {
  return <span className="gradient-text">{category.charAt(0).toUpperCase() + category.slice(1)}</span>;
}

// Skeleton loading component
const InfluencerSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row items-center gap-6 px-6 py-6 md:py-8 animate-pulse">
    <div className="flex items-center gap-4 w-full md:w-auto">
      <div className="w-16 h-16 rounded-full bg-gray-200" />
      <div className="space-y-2">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>
    </div>
    <div className="flex-1 flex flex-wrap justify-center md:justify-end gap-8 md:gap-12">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="text-center">
          <div className="h-8 w-16 bg-gray-200 rounded mb-1" />
          <div className="h-3 w-12 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  </div>
);

// Preload data for a category
const preloadCategoryData = async (category: string) => {
  if (dataCache.has(category)) return;
  
  try {
    const response = await fetch(`https://docs.google.com/spreadsheets/d/1PJ4DTnYDBFBWdaEKT2uhIBo-OlNThjFCf0c6tzngXZY/gviz/tq?tqx=out:csv&sheet=Top%20Influencers`);
    const csv = await response.text();
    
    // Parse CSV and cache the data
    const Papa = await import('papaparse');
    Papa.parse(csv, {
      header: true,
      complete: (results) => {
        const filteredData = results.data.filter((row: any) =>
          row.Category && row.Category.trim().toLowerCase() === category.trim().toLowerCase()
        );
        dataCache.set(category, filteredData);
      }
    });
  } catch (error) {
    console.error('Error preloading data:', error);
  }
};

function OldTopInfluencerUI({ isPremium = false, userPlan = PLAN.FREE }: { isPremium?: boolean, userPlan?: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState<any[]>([]);
  
  const { data: influencers, loading } = useTopInfluencers(selectedCategory || "");

  // Preload all data when component mounts
  useEffect(() => {
    categories.forEach(cat => preloadCategoryData(cat.id));
  }, []);

  // Preload data on category hover
  const handleCategoryHover = (categoryId: string) => {
    if (!dataCache.has(categoryId)) {
      preloadCategoryData(categoryId);
    }
  };

  // Handle category selection with loading state
  const handleCategorySelect = async (categoryId: string) => {
    setIsLoading(true);
    setSelectedCategory(categoryId);
    
    // Check if data is cached
    if (dataCache.has(categoryId)) {
      setCachedData(dataCache.get(categoryId));
      setIsLoading(false);
    } else {
      // Wait for data to load
      const checkCache = setInterval(() => {
        if (dataCache.has(categoryId)) {
          setCachedData(dataCache.get(categoryId));
          setIsLoading(false);
          clearInterval(checkCache);
        }
      }, 100);
      
      // Fallback timeout
      setTimeout(() => {
        clearInterval(checkCache);
        setIsLoading(false);
      }, 3000);
    }
  };

  // Use cached data if available, otherwise use hook data
  const displayData = useMemo(() => {
    if (selectedCategory && cachedData.length > 0) {
      return cachedData;
    }
    return influencers;
  }, [selectedCategory, cachedData, influencers]);

  // Determine influencer limit based on plan
  const influencerLimit = hasAccess("topInfluencerLimit", userPlan || PLAN.FREE) || 10;

  if (selectedCategory) {
    return (
      <>
        <div className="max-w-5xl mx-auto py-12 px-4">
          {/* Header section */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => {
                setSelectedCategory(null);
                setIsLoading(false);
                setCachedData([]);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Categories
            </button>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-4">
            Instagram {gradientCategory(selectedCategory)} Top Influencers
          </h1>
          <p className="text-center text-lg md:text-xl text-gray-700 mb-10 max-w-3xl mx-auto">
            On Instagram, {selectedCategory} is always a trend: we have selected the top 20 Influencers who share posts, reels, videos and stories about {selectedCategory}. Watch their style and post <b>original contents</b>.
          </p>
          
          <div className="space-y-6">
            {loading ? (
              // Show skeleton loading
              [...Array(10)].map((_, i) => <InfluencerSkeleton key={i} />)
            ) : displayData.length > 0 ? (
              displayData.slice(0, 20).map((inf: any, idx: number) => {
                const locked = userPlan === PLAN.FREE && idx >= influencerLimit;
                return (
                  <div
                    key={inf.Username + idx}
                    className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row items-center gap-6 px-6 py-6 md:py-8 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] relative"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <a
                        href={`https://instagram.com/${inf.Username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={inf.Avatar}
                          alt={inf.Username}
                          className={`w-16 h-16 rounded-full object-cover border-2 border-white shadow cursor-pointer hover:scale-105 transition-transform ${locked ? 'blur-lg pointer-events-none select-none' : ''}`}
                          loading="lazy"
                        />
                      </a>
                      <div className="space-y-2">
                        <div className={`font-bold text-lg ${locked ? 'blur-md pointer-events-none select-none' : ''}`}>{inf.Name}</div>
                        <div className={`text-gray-500 text-sm ${locked ? 'blur-md pointer-events-none select-none' : ''}`}>@{inf.Username}</div>
                      </div>
                    </div>
                    <div className="flex-1 flex flex-wrap justify-center md:justify-end gap-8 md:gap-12">
                      <div className={`text-center ${locked ? 'blur-md pointer-events-none select-none' : ''}`}>
                        <div className="text-xl font-bold">{inf.Followers}</div>
                        <div className="text-xs text-gray-500">Followers</div>
                      </div>
                      <div className={`text-center ${locked ? 'blur-md pointer-events-none select-none' : ''}`}>
                        <div className="text-xl font-bold">{inf.Following}</div>
                        <div className="text-xs text-gray-500">Following</div>
                      </div>
                      <div className={`text-center ${locked ? 'blur-md pointer-events-none select-none' : ''}`}>
                        <div className="text-xl font-bold">{inf.Posts}</div>
                        <div className="text-xs text-gray-500">Posts</div>
                      </div>
                      <div className={`text-center ${locked ? 'blur-md pointer-events-none select-none' : ''}`}>
                        <div className="text-xl font-bold">{inf.ER}</div>
                        <div className="text-xs text-gray-500">ER</div>
                      </div>
                      <div className={`text-center ${locked ? 'blur-md pointer-events-none select-none' : ''}`}>
                        <div className="text-xl font-bold">{inf.AverageLikes}</div>
                        <div className="text-xs text-gray-500">Average Likes</div>
                      </div>
                      <div className={`text-center ${locked ? 'blur-md pointer-events-none select-none' : ''}`}>
                        <div className="text-xl font-bold">{inf.AverageComments}</div>
                        <div className="text-xs text-gray-500">Average Comments</div>
                        </div>
                    </div>
                    {locked && idx === influencerLimit && (
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                        <div className="p-[2px] rounded-full bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]">
                          <a href="/subscription"
                            className="rounded-full px-6 py-2 font-bold text-base shadow-lg bg-white bg-opacity-95 flex items-center justify-center whitespace-nowrap min-w-[180px]"
                            style={{
                              display: 'inline-block',
                              fontWeight: 700,
                              letterSpacing: '0.01em',
                              backgroundClip: 'padding-box',
                              minWidth: 'fit-content',
                              maxWidth: '90%',
                            }}
                          >
                            <span style={{
                              background: 'linear-gradient(90deg, #f9ce34, #ee2a7b, #6228d7)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                              color: 'transparent',
                              fontWeight: 700,
                              fontSize: '1.1rem',
                              whiteSpace: 'nowrap',
                            }}>
                              Upgrade for Full Access
                            </span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">Loading influencers...</p>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
        <h1 className="text-4xl font-bold mb-8 text-center gradient-text">Top Influencer Categories</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-5xl">
          {categories.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleCategorySelect(id)}
              onMouseEnter={() => handleCategoryHover(id)}
              className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg border border-gray-100 hover:bg-insta-primary/10 transition-all duration-300 group focus:outline-none transform hover:scale-105"
            >
              <Icon className="w-10 h-10 mb-3 text-insta-primary group-hover:text-insta-primary-dark transition-colors" />
              <span className="text-lg font-semibold text-gray-800 group-hover:text-insta-primary-dark transition-colors">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

const TopInfluencer = (props: any) => {
  return (
    <OldTopInfluencerUI {...props} />
  );
};

export default TopInfluencer; 