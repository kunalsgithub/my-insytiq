import { toast } from "@/hooks/use-toast";

interface GoogleSheetsConfig {
  apiKey: string;
  sheetId: string;
  ranges: {
    hashtags: string;
    audio: string;
    content: string;
    topInfluencers: string;
  };
}

// Configuration for Google Sheets API
export const GOOGLE_SHEETS_CONFIG: GoogleSheetsConfig = {
  apiKey: "AIzaSyB7SA-4hAeKzS-1Iw-ei58s0JTdBUf-onM",
  sheetId: "1PJ4DTnYDBFBWdaEKT2uhIBo-OlNThjFCf0c6tzngXZY",
  ranges: {
    hashtags: "Hashtags!A2:F100",
    audio: "Audio!A2:G100", 
    content: "Content!A2:I100",
    topInfluencers: "Top Influencers!A2:Z100"
  }
};

const fetchSheetData = async (range: string): Promise<any[]> => {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.sheetId}/values/${range}?key=${GOOGLE_SHEETS_CONFIG.apiKey}`;
    console.log("Fetching Google Sheets data from URL:", url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Google Sheets API error: ${response.status} ${response.statusText}`);
      throw new Error(`Google Sheets API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("Raw Google Sheets data received:", data);
    
    if (!data.values || data.values.length === 0) {
      console.warn("No values found in the Google Sheets response");
      return [];
    }
    
    return data.values || [];
  } catch (error) {
    console.error("Error fetching Google Sheets data:", error);
    toast({
      title: "Google Sheets API Error",
      description: "Failed to fetch data from Google Sheets. Using fallback data instead.",
      variant: "destructive",
    });
    throw error;
  }
};

export const fetchHashtagsFromSheet = async (): Promise<any[]> => {
  try {
    console.log("Fetching hashtag data from Google Sheets");
    
    // Try to fetch actual data from Google Sheets
    try {
      const rawData = await fetchSheetData(GOOGLE_SHEETS_CONFIG.ranges.hashtags);
      console.log("Hashtag raw data from sheet:", rawData);
      
      if (rawData && rawData.length > 0) {
        // Transform the raw data into the expected format
        return rawData.map((row, index) => ({
          id: index + 1,
          name: row[0] || 'unknown',
          posts: row[1] || '0',
          growth: parseInt(row[2], 10) || 0,
          categories: row[3] ? row[3].split(',').map(cat => cat.trim()).concat('all') : ['all'],
          lastUpdated: row[4] || new Date().toISOString()
        }));
      }
    } catch (sheetError) {
      console.error("Failed to fetch from Google Sheets, using fallback data:", sheetError);
    }
    
    // Fallback data if the fetch fails or returns empty
    const indianHashtags = [
      ["indianfood", "5.2M", "32", "food", "2024-04-08T12:00:00Z"],
      ["bollywood", "8.7M", "45", "entertainment", "2024-04-08T12:15:00Z"],
      ["yoga", "3.6M", "25", "fitness", "2024-04-08T12:30:00Z"],
      ["travel_india", "2.9M", "18", "travel", "2024-04-08T12:45:00Z"],
      ["streetfood", "4.5M", "28", "food", "2024-04-08T13:00:00Z"],
      ["cricket", "9.1M", "52", "sports", "2024-04-08T13:15:00Z"],
      ["diwali", "6.3M", "40", "culture", "2024-04-08T13:30:00Z"],
      ["mumbailife", "3.8M", "22", "lifestyle", "2024-04-08T13:45:00Z"],
      ["techindia", "2.7M", "35", "tech", "2024-04-08T14:00:00Z"],
      ["saree", "4.1M", "20", "fashion", "2024-04-08T14:15:00Z"]
    ];

    return indianHashtags.map((row, index) => ({
      id: index + 1,
      name: row[0] || 'unknown',
      posts: row[1] || '0',
      growth: parseInt(row[2], 10) || 0,
      categories: row[3] ? [row[3], 'all'] : ['all'],
      lastUpdated: row[4] || new Date().toISOString()
    }));
  } catch (error) {
    console.error("Error transforming hashtag data:", error);
    throw error;
  }
};

export const fetchAudioFromSheet = async (): Promise<any[]> => {
  try {
    console.log("Fetching audio data from Google Sheets");
    
    // Try to fetch actual data from Google Sheets
    try {
      const rawData = await fetchSheetData(GOOGLE_SHEETS_CONFIG.ranges.audio);
      console.log("Audio raw data from sheet:", rawData);
      
      if (rawData && rawData.length > 0) {
        // Transform the raw data into the expected format
        return rawData.map((row, index) => ({
          id: index + 1,
          title: row[0] || 'Unknown Track',
          artist: row[1] || 'Unknown Artist',
          usage: parseInt(row[2], 10) || 50,
          reels: row[3] || '0',
          categories: row[4] ? row[4].split(',').map(cat => cat.trim()).concat('all') : ['all'],
          keywords: row[5] ? row[5].split(',').map(kw => kw.trim()) : [],
          lastUpdated: row[6] || new Date().toISOString(),
          type: "audio" as "post" | "reel" | "audio", // Cast to the correct type
          thumbnailColor: "bg-purple-500",
          creator: row[1] || 'Unknown Artist', // Make artist double as creator
          mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
          contentId: `audio_${index + 1}`
        }));
      }
    } catch (sheetError) {
      console.error("Failed to fetch audio from Google Sheets, using fallback data:", sheetError);
    }
    
    // Fallback data if the fetch fails or returns empty
    const indianAudioTracks = [
      ["As It Was", "Harry Styles", "85", "2.3M", "music,bollywood", "love,romantic", "2025-04-08T12:00:00Z"],
      ["Chaleya", "Arijit Singh", "78", "1.9M", "music,bollywood", "love,trending", "2025-04-08T12:15:00Z"],
      ["Dil Diyan Gallan", "Atif Aslam", "72", "1.5M", "music,romantic", "love,punjabi", "2025-04-08T12:30:00Z"],
      ["Masakali", "A.R. Rahman", "65", "1.2M", "music,independent", "slow,romantic", "2025-04-08T12:45:00Z"],
      ["Maa Tujhe Salaam", "A.R. Rahman", "58", "980K", "patriotic,music", "national,classic", "2025-04-08T13:00:00Z"]
    ];

    return indianAudioTracks.map((row, index) => ({
      id: index + 1,
      title: row[0] || 'Unknown Track',
      artist: row[1] || 'Unknown Artist',
      usage: parseInt(row[2], 10) || 50,
      reels: row[3] || '0',
      categories: row[4] ? row[4].split(',').map(cat => cat.trim()).concat('all') : ['all'],
      keywords: row[5] ? row[5].split(',').map(kw => kw.trim()) : [],
      lastUpdated: row[6] || new Date().toISOString(),
      type: "audio" as "post" | "reel" | "audio", // Cast to the correct type
      thumbnailColor: "bg-purple-500",
      creator: row[1] || 'Unknown Artist', // Make artist double as creator
      mediaUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
      contentId: `audio_${index + 1000}`
    }));
  } catch (error) {
    console.error("Error transforming audio data:", error);
    throw error;
  }
};

export const fetchContentFromSheet = async (): Promise<any[]> => {
  try {
    console.log("Fetching content data from Google Sheets");
    
    // Try to fetch actual data from Google Sheets
    try {
      const rawData = await fetchSheetData(GOOGLE_SHEETS_CONFIG.ranges.content);
      console.log("Content raw data from sheet:", rawData);
      
      if (rawData && rawData.length > 0) {
        // Transform the raw data into the expected format with proper types
        return rawData.map((row, index) => {
          console.log(`Processing content row ${index}:`, row);
          
          // Parse data from the sheet based on the expected columns
          const title = row[0] || 'Untitled Content'; // Column A: Title
          const creator = row[1] || '@unknown'; // Column B: Creator/Username
          const thumbnailColor = row[2] || 'bg-blue-500'; // Column C: Thumbnail Color
          
          // Ensure categories is always an array
          let categories: string[] = [];
          if (row[3]) {
            if (typeof row[3] === 'string') {
              categories = row[3].split(',').map((cat: string) => cat.trim());
            } else if (Array.isArray(row[3])) {
              categories = row[3];
            }
          }
          if (!categories.includes('all')) {
            categories.push('all');
          }
          
          // Ensure keywords is always an array
          let keywords: string[] = [];
          if (row[4]) {
            if (typeof row[4] === 'string') {
              keywords = row[4].split(',').map((kw: string) => kw.trim());
            } else if (Array.isArray(row[4])) {
              keywords = row[4];
            }
          }
          
          // Get content type and ensure it's one of the allowed values
          let type: "post" | "reel" | "audio" = "post";
          if (row[5]) {
            const rawType = String(row[5]).toLowerCase();
            if (rawType === "reel" || rawType.includes('reel')) {
              type = "reel";
            } else if (rawType === "audio" || rawType.includes('audio')) {
              type = "audio";
            }
          }
          
          // Get the direct Instagram URL (for live engagement)
          const instagramUrl = row[6] || '';
          console.log(`Instagram URL for content ${index}:`, instagramUrl);
          
          // Get the thumbnail URL from column I
          const thumbnailUrl = row[8] || '';
          console.log(`Thumbnail URL for content ${index}:`, thumbnailUrl);
          
          // Extract content ID (or generate one if missing)
          const contentId = row[7] || `content_${index}`;
          
          return {
            id: index + 1,
            title,
            creator,
            thumbnailColor,
            categories,
            keywords,
            type,
            mediaUrl: thumbnailUrl, // Use the thumbnail URL from column I
            originalUrl: instagramUrl, // Keep the Instagram URL for live engagement
            contentId,
            lastUpdated: new Date().toISOString()
          };
        });
      } else {
        console.warn("No content data found in sheet, returning empty array");
        return [];
      }
    } catch (sheetError) {
      console.error("Failed to fetch content from Google Sheets:", sheetError);
      throw sheetError;
    }
  } catch (error) {
    console.error("Error transforming content data:", error);
    throw error;
  }
};

export const getLastUpdatedTime = async (): Promise<string> => {
  try {
    const hashtagData = await fetchSheetData(GOOGLE_SHEETS_CONFIG.ranges.hashtags);
    if (hashtagData.length > 0 && hashtagData[0].length > 4) {
      return hashtagData[0][4] || new Date().toISOString();
    }
    return new Date().toISOString();
  } catch (error) {
    console.error("Error getting last updated time:", error);
    return new Date().toISOString();
  }
};

export const fetchTopInfluencersFromSheet = async (): Promise<any[]> => {
  try {
    console.log("Fetching top influencers data from Google Sheets");
    const rawData = await fetchSheetData(GOOGLE_SHEETS_CONFIG.ranges.topInfluencers);
    console.log("Top Influencers raw data from sheet:", rawData);
    return rawData;
  } catch (error) {
    console.error("Error fetching Top Influencers from Google Sheets:", error);
    return [];
  }
};
