
import { toast } from "../hooks/use-toast";

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  imageUrl?: string;
}

export const fetchInstagramNews = async (): Promise<NewsItem[]> => {
  try {
    console.log("Fetching Instagram news");
    
    // First try to fetch news from gnews API
    try {
      const response = await fetch(
        `https://gnews.io/api/v4/search?q=instagram&lang=en&max=10&apikey=7d38e3399e7c456544f5e94b6a34ecee`
      );

      if (!response.ok) {
        console.error(`News API error: ${response.status} ${response.statusText}`);
        throw new Error('Failed to fetch news from API');
      }

      const data = await response.json();
      console.log("Fetched news data:", data);
      
      if (data.articles && data.articles.length > 0) {
        // Create a Map to store unique articles based on their content
        const uniqueArticles = new Map();
        
        data.articles.forEach((article: any) => {
          // Use the article title as a key to detect duplicates
          const contentKey = article.title;
          
          // Only keep the first occurrence of an article
          if (!uniqueArticles.has(contentKey)) {
            uniqueArticles.set(contentKey, article);
          }
        });
        
        // Convert the unique articles back to an array and map to NewsItem format
        return Array.from(uniqueArticles.values()).map((article: any, index: number) => ({
          id: `news-${index}`,
          title: article.title,
          description: article.description,
          source: article.source?.name || 'Unknown Source',
          url: article.url,
          publishedAt: article.publishedAt,
          imageUrl: article.image
        }));
      } else {
        console.warn("No articles found in news API response");
      }
    } catch (error) {
      console.error('Error fetching news from API:', error);
      // Will fall back to sample data below
    }
    
    // If API fetch fails or returns no results, use sample data
    console.log("Using sample news data");
    return getSampleNewsData();
  } catch (error) {
    console.error('Error in fetchInstagramNews:', error);
    toast({
      title: "Error fetching news",
      description: "Using sample news data instead",
      variant: "destructive"
    });
    return getSampleNewsData();
  }
};

// Sample news data as fallback
const getSampleNewsData = (): NewsItem[] => {
  console.log("Generating sample news data");
  return [
    {
      id: "sample-1",
      title: "Instagram Launches New Reels Feature for Creators",
      description: "Instagram has introduced a powerful new set of tools for Reels creators, aiming to boost engagement and discoverability.",
      source: "Tech Today",
      url: "https://example.com/instagram-news-1",
      publishedAt: new Date().toISOString(),
      imageUrl: "https://picsum.photos/seed/instagram1/300/200"
    },
    {
      id: "sample-2",
      title: "Instagram Shopping Updates: What You Need to Know",
      description: "The platform is rolling out significant changes to its shopping features, making it easier for businesses to sell products directly.",
      source: "Business Insider",
      url: "https://example.com/instagram-news-2",
      publishedAt: new Date().toISOString(),
      imageUrl: "https://picsum.photos/seed/instagram2/300/200"
    },
    {
      id: "sample-3",
      title: "Top Instagram Influencers of 2025 Revealed",
      description: "A new report shows surprising shifts in the Instagram influencer landscape, with new creators dominating engagement metrics.",
      source: "Social Media Today",
      url: "https://example.com/instagram-news-3",
      publishedAt: new Date().toISOString(),
      imageUrl: "https://picsum.photos/seed/instagram3/300/200"
    }
  ];
};
