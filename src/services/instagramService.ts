import { fetchAudioFromSheet } from "../utils/googleSheetsService";
import {
  fetchTrendingContentFromFirestore,
  fetchTrendingHashtagsFromFirestore,
  fetchTrendingMeta,
} from "@/services/trendingFirestoreService";
import { toast } from "../hooks/use-toast";
import { QueryClient } from '@tanstack/react-query';

// Define interfaces for our data types
export interface TrendingHashtag {
  id: number;
  name: string;
  posts: string;
  growth: number;
  categories: string[];
  lastUpdated?: string;
}

export interface TrendingAudio {
  id: number;
  title: string;
  artist: string;
  usage: number;
  reels: string;
  categories: string[];
  keywords: string[];
  lastUpdated?: string;
}

export interface TrendingContent {
  id: number;
  title: string;
  creator: string;
  /** Instagram @handle */
  username?: string;
  /** Profile / brand display name */
  accountName?: string;
  likes?: string;
  comments?: string;
  thumbnailColor: string;
  categories: string[];
  keywords: string[];
  type: "post" | "reel" | "audio";
  mediaUrl?: string;
  originalUrl?: string;
  contentId?: string;
  lastUpdated?: string;
  embedHtml?: string;
  thumbnailUrl?: string;
}

export interface LiveEngagement {
  likes: string;
  comments: string;
  shares: string;
  saves: string;
  isLoading: boolean;
}

// Set to false to attempt real API calls or fetch from Google Sheets
const ALWAYS_USE_FALLBACK = false;

/** Direct image/CDN URLs only — never Instagram page URLs (oEmbed blocked by CORS in browser). */
function isDirectImageUrl(url: string | undefined): boolean {
  if (!url || !url.startsWith("http")) return false;
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com/p/") || lower.includes("instagram.com/reel/")) {
    return false;
  }
  return (
    /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) ||
    lower.includes("cdninstagram") ||
    lower.includes("fbcdn.net")
  );
}

function mapSheetRowToTrendingContent(item: Record<string, unknown>): TrendingContent {
  const mediaUrl = String(item.mediaUrl || "");
  const originalUrl = String(item.originalUrl || "");
  const instagramPageUrl =
    originalUrl.includes("instagram.com/p/") || originalUrl.includes("instagram.com/reel/")
      ? originalUrl
      : mediaUrl.includes("instagram.com/p/") || mediaUrl.includes("instagram.com/reel/")
        ? mediaUrl
        : originalUrl || mediaUrl;

  const thumbnailUrl =
    (typeof item.thumbnailUrl === "string" && item.thumbnailUrl) ||
    (isDirectImageUrl(mediaUrl) ? mediaUrl : undefined);

  return {
    id: Number(item.id) || 0,
    title: String(item.title || "Untitled"),
    creator: String(item.creator || "@unknown"),
    username: String(item.username || item.creator || "@unknown"),
    accountName: String(item.accountName || item.title || "Unknown"),
    thumbnailColor: String(item.thumbnailColor || "bg-blue-500"),
    categories: Array.isArray(item.categories) ? (item.categories as string[]) : ["all"],
    keywords: Array.isArray(item.keywords) ? (item.keywords as string[]) : [],
    type: (item.type as TrendingContent["type"]) || "post",
    mediaUrl: thumbnailUrl || instagramPageUrl,
    originalUrl: instagramPageUrl,
    contentId: String(item.contentId || `content_${item.id}`),
    lastUpdated: String(item.lastUpdated || new Date().toISOString()),
    thumbnailUrl,
  };
}

export const fetchTrendingHashtags = async (
  searchTerm?: string,
  category: string = "all"
): Promise<TrendingHashtag[]> => {
  console.log("Fetching trending hashtags from Firestore (shared daily cache)");
  const hashtags = await fetchTrendingHashtagsFromFirestore(searchTerm || "", category);
  console.log(`Loaded ${hashtags.length} hashtags from Firestore`);
  return hashtags;
};

export const fetchTrendingAudio = async (searchTerm?: string, category: string = 'all'): Promise<TrendingAudio[]> => {
  try {
    console.log(`Fetching audio tracks for category: ${category}, search: ${searchTerm || 'none'}`);
    
    let audioTracks: TrendingAudio[] = [];
    
    try {
      // Fetch from Google Sheets
      audioTracks = await fetchAudioFromSheet();
      console.log("Audio tracks from Google Sheets:", audioTracks);
      
      if (audioTracks.length === 0) {
        toast({
          title: "No Audio Data Found",
          description: "No audio data was found in Google Sheets.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching audio from Google Sheets:", error);
      toast({
        title: "Audio Data Fetch Error",
        description: "Error fetching audio data. Using fallback data instead.",
        variant: "default",
      });
      // Get fallback data if fetch fails
      audioTracks = await fetchAudioFromSheet();
    }
    
    // Filter audio tracks by category and search term
    const filteredTracks = audioTracks.filter(track => {
      const categoryMatch = category === 'all' || 
                           track.categories.includes(category) || 
                           track.categories.includes('all');
                           
      const searchMatch = !searchTerm || 
                         track.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         track.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         track.keywords.some(kw => kw.toLowerCase().includes(searchTerm?.toLowerCase() || ''));
                         
      return categoryMatch && searchMatch;
    });
    
    console.log(`Found ${filteredTracks.length} audio tracks after filtering`);
    return filteredTracks;
  } catch (error) {
    console.error("Error in fetchTrendingAudio:", error);
    throw error;
  }
};

/** Shared daily cache in Firestore only — no Google Sheets or sample fallback. */
export const fetchTrendingContent = async (
  searchTerm?: string,
  category: string = "all"
): Promise<TrendingContent[]> => {
  console.log(
    `Fetching trending content from Firestore — category: ${category}, search: ${searchTerm || "none"}`
  );
  const content = await fetchTrendingContentFromFirestore(searchTerm || "", category);
  console.log(`Loaded ${content.length} items from Firestore (shared daily cache)`);
  return content;
};

export const fetchLiveEngagement = async (contentId: string): Promise<LiveEngagement> => {
  try {
    console.log(`Fetching live engagement for content ID: ${contentId}`);
    
    // In a real implementation, this would be an API call to a service like:
    // - Instagram Graph API
    // - Socialbakers API
    // - Sprout Social API
    // - HypeAuditor API
    
    // For demo purposes, we'll use a delay and random values
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call time
    
    // For now, generate random engagement data
    const engagement: LiveEngagement = {
      likes: Math.floor(Math.random() * 100000).toLocaleString(),
      comments: Math.floor(Math.random() * 10000).toLocaleString(),
      shares: Math.floor(Math.random() * 5000).toLocaleString(),
      saves: Math.floor(Math.random() * 20000).toLocaleString(),
      isLoading: false
    };
    
    console.log("Fetched live engagement:", engagement);
    return engagement;
  } catch (error) {
    console.error("Error in fetchLiveEngagement:", error);
    toast({
      title: "Error fetching engagement",
      description: "Could not retrieve live engagement data.",
      variant: "destructive"
    });
    
    throw error;
  }
};

// Types for our Instagram trends data
export interface TrendingReel {
  id: number;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  category: string;
  audio?: {
    title: string;
    artist: string;
  };
}

// Mock data for development
const mockCategories = [
  { id: 'all', name: 'All', icon: '🌐' },
  { id: 'sports', name: 'Sports', icon: '⚽' },
  { id: 'memes', name: 'Memes', icon: '😂' },
  { id: 'photography', name: 'Photography', icon: '📸' },
  { id: 'fashion', name: 'Fashion', icon: '👗' },
  { id: 'food', name: 'Food', icon: '🍔' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'news', name: 'News', icon: '📰' },
];

// Mock data for trending hashtags
const mockTrendingHashtags = [
  { id: 1, name: 'WorldCup2024', posts: '1200000', growth: 45, categories: ['sports', 'all'] },
  { id: 2, name: 'Foodie', posts: '850000', growth: 32, categories: ['food', 'all'] },
  { id: 3, name: 'TravelGram', posts: '750000', growth: 28, categories: ['travel', 'all'] },
];

// Mock data for trending reels
const mockTrendingReels = [
  {
    id: 1,
    thumbnailUrl: 'https://example.com/reel1.jpg',
    viewCount: 1000000,
    likeCount: 50000,
    category: 'memes',
    audio: {
      title: 'Trending Sound',
      artist: 'Popular Artist',
    },
  },
];

// Mock data for trending audio
const mockTrendingAudio = [
  {
    id: 1,
    title: 'Viral Sound',
    artist: 'Trending Artist',
    usage: 500000,
    category: 'all',
  },
];

// Service functions
export const getCategories = async () => {
  return mockCategories;
};

export const getTrendingHashtags = async (category: string) => {
  return category === 'all'
    ? mockTrendingHashtags
    : mockTrendingHashtags.filter((tag) => tag.categories.includes(category));
};

export const getTrendingReels = async (category: string) => {
  return category === 'all'
    ? mockTrendingReels
    : mockTrendingReels.filter((reel) => reel.category === category);
};

export const getTrendingAudio = async (category: string) => {
  return category === 'all'
    ? mockTrendingAudio
    : mockTrendingAudio.filter((audio) => audio.category === category);
};

// Create a new QueryClient instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// New function for fallback content
const getFallbackContent = (): TrendingContent[] => {
  const indianContent: TrendingContent[] = [
    {
      id: 1,
      title: "Mumbai Street Food Tour",
      creator: "@mumbai_foodie",
      username: "@mumbai_foodie",
      accountName: "Mumbai Street Food Tour",
      thumbnailColor: "bg-orange-500",
      categories: ["food", "travel", "all"],
      keywords: ["street food", "mumbai"],
      type: "post",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      contentId: "post_23576"
    },
    {
      id: 2,
      title: "Yoga Sunrise Session",
      creator: "@yogaguru",
      username: "@yogaguru",
      accountName: "Yoga Sunrise Session",
      thumbnailColor: "bg-green-500",
      categories: ["fitness", "lifestyle", "all"],
      keywords: ["yoga", "wellness"],
      type: "reel",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      contentId: "reel_78954"
    },
    {
      id: 3,
      title: "IPL Cricket Highlights",
      creator: "@cricketmania",
      username: "@cricketmania",
      accountName: "IPL Cricket Highlights",
      thumbnailColor: "bg-blue-500",
      categories: ["sports", "all"],
      keywords: ["cricket", "ipl"],
      type: "reel",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      contentId: "reel_12398"
    },
    {
      id: 4,
      title: "Diwali Decoration Ideas",
      creator: "@homemaker",
      thumbnailColor: "bg-amber-500",
      categories: ["culture", "lifestyle", "all"],
      keywords: ["diwali", "decoration"],
      type: "post",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      contentId: "post_45672"
    },
    {
      id: 5,
      title: "Bollywood Beats Mix",
      creator: "@djbollywood",
      thumbnailColor: "bg-yellow-500",
      categories: ["music", "entertainment", "all"],
      keywords: ["bollywood", "mix"],
      type: "audio",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      contentId: "audio_12345"
    },
    {
      id: 6,
      title: "Punjabi Party Anthem",
      creator: "@punjabihits",
      thumbnailColor: "bg-orange-500",
      categories: ["music", "all"],
      keywords: ["punjabi", "party"],
      type: "audio",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
      contentId: "audio_23456"
    },
    {
      id: 7,
      title: "Classic Bollywood Hits",
      creator: "@bollywoodlegacy",
      thumbnailColor: "bg-red-500",
      categories: ["music", "all"],
      keywords: ["bollywood", "classic"],
      type: "audio",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      contentId: "audio_34567"
    },
    {
      id: 8,
      title: "Trending DJ Remix",
      creator: "@djmixmaster",
      thumbnailColor: "bg-purple-500",
      categories: ["music", "all"],
      keywords: ["remix", "dj"],
      type: "audio",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
      contentId: "audio_45678"
    },
    {
      id: 10001,
      title: "Test Public Reel (Native Video)",
      creator: "@publicvideo",
      thumbnailColor: "bg-pink-500",
      categories: ["all", "test"],
      keywords: ["test", "public", "video"],
      type: "reel",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      contentId: "reel_test_public_1"
    }
  ];
  
  // Add more fallback content for better testing
  for (let i = 0; i < 5; i++) {
    indianContent.push({
      id: 9 + i,
      title: `Sample Post ${i+1}`,
      creator: `@creator${i+1}`,
      thumbnailColor: "bg-purple-500",
      categories: ["all"],
      keywords: ["sample"],
      type: "post",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      contentId: `post_${5000 + i}`
    });
    
    indianContent.push({
      id: 14 + i,
      title: `Sample Reel ${i+1}`,
      creator: `@reelcreator${i+1}`,
      thumbnailColor: "bg-blue-400",
      categories: ["all"],
      keywords: ["sample"],
      type: "reel",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      contentId: `reel_${6000 + i}`
    });
    
    indianContent.push({
      id: 19 + i,
      title: `Sample Audio ${i+1}`,
      creator: `@audiocreator${i+1}`,
      thumbnailColor: "bg-green-400",
      categories: ["all"],
      keywords: ["sample"],
      type: "audio",
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
      contentId: `audio_${7000 + i}`
    });
  }
  
  return indianContent;
};

// Add this new function to handle Instagram URLs
export const formatInstagramUrl = (url: string): { mediaUrl: string; embedUrl: string } => {
  try {
    // Check if it's already an embed URL
    if (url.includes('instagram.com/p/') || url.includes('instagram.com/reel/')) {
      const postId = url.split('/').filter(Boolean).pop()?.split('?')[0];
      if (postId) {
        return {
          mediaUrl: url,
          embedUrl: `https://www.instagram.com/p/${postId}/embed/`
        };
      }
    }
    
    // If it's a direct video URL, return as is
    if (url.includes('.mp4') || url.includes('.mov')) {
      return {
        mediaUrl: url,
        embedUrl: url
      };
    }
    
    // Default case - return original URL
    return {
      mediaUrl: url,
      embedUrl: url
    };
  } catch (error) {
    console.error('Error formatting Instagram URL:', error);
    return {
      mediaUrl: url,
      embedUrl: url
    };
  }
};

// Add these new interfaces for Instagram embed handling
export interface InstagramEmbedData {
  embedHtml: string;
  mediaUrl: string;
  thumbnailUrl?: string;
}

/** @deprecated Browser cannot call Instagram oEmbed (CORS). Use thumbnailUrl from Firestore/Sheets. */
export const getInstagramEmbedData = async (
  url: string
): Promise<InstagramEmbedData> => ({
  embedHtml: "",
  mediaUrl: url,
  thumbnailUrl: undefined,
});
