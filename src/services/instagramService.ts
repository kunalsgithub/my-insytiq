import { fetchHashtagsFromSheet, fetchAudioFromSheet, fetchContentFromSheet } from "../utils/googleSheetsService";
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

export const fetchTrendingHashtags = async (searchTerm?: string, category: string = 'all'): Promise<TrendingHashtag[]> => {
  try {
    console.log("Fetching Trending Hashtags");
    console.log("Search Term:", searchTerm);
    console.log("Category:", category);

    let hashtags: TrendingHashtag[] = [];

    try {
      // Fetch from Google Sheets
      hashtags = await fetchHashtagsFromSheet();
      console.log("Hashtags from Google Sheets:", hashtags);
      
      if (hashtags.length === 0) {
        toast({
          title: "No Data Found",
          description: "No hashtag data was found in Google Sheets.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching from Google Sheets:", error);
      toast({
        title: "Data Fetch Error",
        description: "Error fetching data from Google Sheets. Check your sheet format.",
        variant: "destructive",
      });
      throw error;
    }

    // Filter hashtags by category and search term
    let filteredHashtags = hashtags.filter(hashtag => {
      console.log(`Filtering hashtag: ${hashtag.name}, categories:`, hashtag.categories);
      
      const categoryMatch = category === 'all' || 
                           hashtag.categories.includes(category) || 
                           hashtag.categories.includes('all');
                           
      const searchMatch = !searchTerm || 
                         hashtag.name.toLowerCase().includes(searchTerm.toLowerCase());
                         
      return categoryMatch && searchMatch;
    });

    console.log("Filtered Hashtags:", filteredHashtags);
    return filteredHashtags;
  } catch (error) {
    console.error("Error in fetchTrendingHashtags:", error);
    throw error;
  }
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

export const fetchTrendingContent = async (searchTerm?: string, category: string = 'all'): Promise<TrendingContent[]> => {
  try {
    console.log(`Fetching trending content for category: ${category}, search: ${searchTerm || 'none'}`);
    
    let content: TrendingContent[] = [];
    
    try {
      // Fetch content from Google Sheets
      console.log("Attempting to fetch content from Google Sheets");
      const fetchedContent = await fetchContentFromSheet();
      console.log("Content from Google Sheets:", fetchedContent);
      
      if (fetchedContent && Array.isArray(fetchedContent) && fetchedContent.length > 0) {
        // Convert to TrendingContent and ensure all required properties exist
        content = await Promise.all(fetchedContent.map(async item => {
          try {
            // Use Instagram URL for embed when we have it (sheet may put it in originalUrl; mediaUrl may be sheet thumbnail or empty)
            const instagramUrl = item.originalUrl && (item.originalUrl.includes('instagram.com/p/') || item.originalUrl.includes('instagram.com/reel/'))
              ? item.originalUrl
              : (item.mediaUrl && (item.mediaUrl.includes('instagram.com/p/') || item.mediaUrl.includes('instagram.com/reel/')) ? item.mediaUrl : null);
            let embedData: InstagramEmbedData | null = null;
            if ((item.type === 'reel' || item.type === 'post') && instagramUrl) {
              try {
                embedData = await getInstagramEmbedData(instagramUrl);
              } catch (e) {
                console.warn(`Skipping embed fetch for Instagram URL: ${instagramUrl}`);
                embedData = null;
              }
            }
            // Prefer: sheet thumbnail (mediaUrl if it's a direct image), then embed thumbnail
            const sheetThumb = item.mediaUrl && !item.mediaUrl.includes('instagram.com/') ? item.mediaUrl : undefined;
            const thumbnailUrl = sheetThumb || embedData?.thumbnailUrl;
            return {
              id: item.id,
              title: item.title || 'Untitled',
              creator: item.creator || '@unknown',
              thumbnailColor: item.thumbnailColor || 'bg-blue-500',
              categories: Array.isArray(item.categories) ? item.categories : ['all'],
              keywords: Array.isArray(item.keywords) ? item.keywords : [],
              type: item.type as "post" | "reel" | "audio",
              mediaUrl: item.mediaUrl || '',
              originalUrl: item.originalUrl || item.mediaUrl || '',
              contentId: item.contentId || `content_${item.id}`,
              lastUpdated: item.lastUpdated || new Date().toISOString(),
              embedHtml: embedData?.embedHtml,
              thumbnailUrl: thumbnailUrl || undefined
            };
          } catch (error) {
            console.error(`Error processing content item ${item.id}:`, error);
            return {
              ...item,
              embedHtml: undefined,
              thumbnailUrl: undefined
            };
          }
        }));
        
        console.log("Processed content from Google Sheets:", content);
      } else {
        console.warn("No content found in Google Sheets or invalid data format");
      }
      
      // Fetch audio data for additional content
      try {
        console.log("Attempting to fetch audio data");
        const audioData = await fetchAudioFromSheet();
        console.log("Audio data for content:", audioData);
        
        // Add audio data as content items
        if (audioData && Array.isArray(audioData) && audioData.length > 0) {
          const audioContent = audioData.map(audio => {
            return {
              id: audio.id + 1000, // Avoid ID conflicts
              title: audio.title,
              creator: audio.creator || audio.artist,
              thumbnailColor: audio.thumbnailColor || "bg-purple-500",
              categories: audio.categories,
              keywords: audio.keywords,
              type: "audio" as "post" | "reel" | "audio",
              mediaUrl: audio.mediaUrl || "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
              originalUrl: audio.originalUrl || audio.mediaUrl,
              contentId: audio.contentId || `audio_${audio.id}`,
              lastUpdated: audio.lastUpdated || new Date().toISOString()
            };
          });
          
          // Combine content with audio content
          content = [...content, ...audioContent];
          console.log("Combined content after adding audio:", content);
        }
      } catch (audioError) {
        console.error("Error fetching audio data:", audioError);
      }
      
      if (content.length === 0) {
        console.warn("No content found in Google Sheets, using fallback data");
        content = getFallbackContent();
        toast({
          title: "Using Sample Content Data",
          description: "No content data found in Google Sheets. Using sample data instead.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error fetching content from Google Sheets:", error);
      toast({
        title: "Content Data Fetch Error",
        description: "Error fetching content data. Using fallback data instead.",
        variant: "default",
      });
      content = getFallbackContent();
    }
    
    console.log("Combined content before filtering:", content);
    console.log("Filtering by category:", category);
    console.log("Filtering by search term:", searchTerm || "none");
    
    // Filter content by category and search term
    const filteredContent = content.filter(item => {
      // Log each item's categories for debugging
      console.log(`Item ${item.id} (${item.title}) categories:`, item.categories);
      
      const categoryMatch = category === 'all' || 
                          (item.categories && Array.isArray(item.categories) && 
                          (item.categories.includes(category) || item.categories.includes('all')));
                          
      const searchMatch = !searchTerm || 
                        item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        item.creator.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (item.keywords && Array.isArray(item.keywords) && item.keywords.length > 0 && 
                         item.keywords.some(kw => kw && kw.toLowerCase().includes(searchTerm?.toLowerCase() || '')));
      
      console.log(`Item ${item.id} - Category match: ${categoryMatch}, Search match: ${searchMatch}`);            
      return categoryMatch && searchMatch;
    });
    
    console.log(`Found ${filteredContent.length} content items after filtering`);
    console.log("Posts:", filteredContent.filter(item => item.type === "post"));
    console.log("Reels:", filteredContent.filter(item => item.type === "reel"));
    console.log("Audio:", filteredContent.filter(item => item.type === "audio"));
    
    // If we still have no content, definitely use fallback content
    if (filteredContent.length === 0) {
      console.warn("No content found after filtering, using unfiltered fallback data");
      return getFallbackContent();
    }
    
    return filteredContent;
  } catch (error) {
    console.error("Error in fetchTrendingContent:", error);
    const fallbackContent = getFallbackContent();
    console.log("Using fallback content due to error:", fallbackContent);
    return fallbackContent;
  }
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

// Add this new function to handle Instagram embeds
export const getInstagramEmbedData = async (url: string): Promise<InstagramEmbedData> => {
  try {
    // Extract the post/reel ID from the URL
    const postId = url.split('/').filter(Boolean).pop()?.split('?')[0];
    
    if (!postId) {
      throw new Error('Invalid Instagram URL');
    }

    // For development/testing, you can use this mock response
    if (process.env.NODE_ENV === 'development') {
      return {
        embedHtml: `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/${postId}/" data-instgrm-version="14" style="background:#FFF; border:0; border-radius:3px; box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px; max-width:540px; min-width:326px; padding:0; width:99.375%; width:-webkit-calc(100% - 2px); width:calc(100% - 2px);">
          <div style="padding:16px;">
            <a href="https://www.instagram.com/p/${postId}/" style="background:#FFFFFF; line-height:0; padding:0 0; text-align:center; text-decoration:none; width:100%;" target="_blank">
              <div style="display: flex; flex-direction: row; align-items: center;">
                <div style="background-color: #F4F4F4; border-radius: 50%; flex-grow: 0; height: 40px; margin-right: 14px; width: 40px;"></div>
                <div style="display: flex; flex-direction: column; flex-grow: 1; justify-content: center;">
                  <div style="background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; margin-bottom: 6px; width: 100px;"></div>
                  <div style="background-color: #F4F4F4; border-radius: 4px; flex-grow: 0; height: 14px; width: 60px;"></div>
                </div>
              </div>
              <div style="padding: 19% 0;"></div>
              <div style="display:block; height:50px; margin:0 auto 12px; width:50px;">
                <svg width="50px" height="50px" viewBox="0 0 60 60" version="1.1" xmlns="https://www.w3.org/2000/svg">
                  <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
                    <g transform="translate(-511.000000, -20.000000)" fill="#000000">
                      <g>
                        <path d="M556.869,30.41 C554.814,30.41 553.148,32.076 553.148,34.131 C553.148,36.186 554.814,37.852 556.869,37.852 C558.924,37.852 560.59,36.186 560.59,34.131 C560.59,32.076 558.924,30.41 556.869,30.41 M541,53.842 C541,56.003 539.003,58 536.842,58 L520.158,58 C517.997,58 516,56.003 516,53.842 L516,40.158 C516,37.997 517.997,36 520.158,36 L536.842,36 C539.003,36 541,37.997 541,40.158 L541,53.842 Z M562.759,36.58 C561.94,35.544 560.544,35 559,35 L540.271,35 C538.733,35 537.338,35.541 536.519,36.574 L516.519,56.574 C515.701,57.612 515.701,59.388 516.519,60.426 C517.338,61.459 518.733,62 520.271,62 L539,62 C540.544,62 541.94,61.459 542.759,60.426 L562.759,40.426 C563.577,39.388 563.577,37.612 562.759,36.58 Z"></path>
                      </g>
                    </g>
                  </g>
                </svg>
              </div>
              <div style="padding-top: 8px;">
                <div style="color:#3897f0; font-family:Arial,sans-serif; font-size:14px; font-style:normal; font-weight:550; line-height:18px;">View this post on Instagram</div>
              </div>
            </a>
          </div>
        </blockquote>`,
        mediaUrl: url,
        thumbnailUrl: `https://instagram.com/p/${postId}/media/?size=t`
      };
    }

    // In production, you would make an API call to Instagram's oEmbed endpoint
    // Note: This requires proper authentication and API access
    const response = await fetch(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    
    return {
      embedHtml: data.html,
      mediaUrl: url,
      thumbnailUrl: data.thumbnail_url
    };
  } catch (error) {
    console.error('Error getting Instagram embed data:', error);
    throw error;
  }
};
