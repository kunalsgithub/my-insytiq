import { toast } from "@/hooks/use-toast";

export interface TrendingItem {
  id: string;
  name: string;
  type: "hashtag" | "audio";
  interest: number;
  momentum: number;
  change: number;
  lastUpdated: string;
  related_queries?: any[];
}

// Sample trending data - replace with actual API call
const sampleTrendingData: Record<string, TrendingItem[]> = {
  hashtags: [
    {
      id: "1",
      name: "#trending",
      type: "hashtag",
      interest: 95,
      momentum: 85,
      change: 15,
      lastUpdated: new Date().toISOString()
    },
    {
      id: "2",
      name: "#viral",
      type: "hashtag",
      interest: 90,
      momentum: 80,
      change: 10,
      lastUpdated: new Date().toISOString()
    },
    {
      id: "3",
      name: "#reels",
      type: "hashtag",
      interest: 85,
      momentum: 75,
      change: 5,
      lastUpdated: new Date().toISOString()
    },
    {
      id: "4",
      name: "#instagood",
      type: "hashtag",
      interest: 80,
      momentum: 70,
      change: 8,
      lastUpdated: new Date().toISOString()
    },
    {
      id: "5",
      name: "#photography",
      type: "hashtag",
      interest: 75,
      momentum: 65,
      change: 12,
      lastUpdated: new Date().toISOString()
    }
  ],
  audio: [
    {
      id: "6",
      name: "Bollywood Beats",
      type: "audio",
      interest: 80,
      momentum: 70,
      change: 20,
      lastUpdated: new Date().toISOString()
    },
    {
      id: "7",
      name: "Punjabi Mix",
      type: "audio",
      interest: 75,
      momentum: 65,
      change: 15,
      lastUpdated: new Date().toISOString()
    },
    {
      id: "8",
      name: "Indian Classical",
      type: "audio",
      interest: 70,
      momentum: 60,
      change: 10,
      lastUpdated: new Date().toISOString()
    },
    {
      id: "9",
      name: "Folk Fusion",
      type: "audio",
      interest: 65,
      momentum: 55,
      change: 8,
      lastUpdated: new Date().toISOString()
    },
    {
      id: "10",
      name: "Dance Mix",
      type: "audio",
      interest: 60,
      momentum: 50,
      change: 12,
      lastUpdated: new Date().toISOString()
    }
  ]
};

export const fetchTrendingData = async (
  searchTerm?: string,
  category?: string,
  type: "hashtags" | "audio" = "hashtags"
): Promise<TrendingItem[]> => {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get data based on type
    let filteredData = [...sampleTrendingData[type]];

    // Apply category filter if provided
    if (category && category !== "all") {
      filteredData = filteredData.filter(item => 
        item.name.toLowerCase().includes(category.toLowerCase())
      );
    }

    // Apply search term filter if provided
    if (searchTerm) {
      filteredData = filteredData.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Update timestamps
    filteredData = filteredData.map(item => ({
      ...item,
      lastUpdated: new Date().toISOString()
    }));

    return filteredData;
  } catch (error) {
    console.error("Error fetching trends:", error);
    toast({
      title: "Error",
      description: "Could not fetch trending data. Please try again later.",
      variant: "destructive"
    });
    throw error;
  }
}; 