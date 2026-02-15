import React from "react";
import { useState, useEffect } from "react";
import { Newspaper, Clock, ExternalLink, Instagram } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchInstagramNews, NewsItem } from "@/services/newsService";
import { toast } from "@/hooks/use-toast";
import AnimatedList from "./AnimatedList";
import "./AnimatedList.css";

const CACHE_KEY = "instagram_news_cache";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

const InstagramNews = () => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchNews = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if we have cached data and if it's still valid
      const cached = localStorage.getItem(CACHE_KEY);
      
      if (!forceRefresh && cached) {
        const { data, timestamp } = JSON.parse(cached);
        const cacheTime = new Date(timestamp);
        const now = new Date();
        
        // If cache is less than 24 hours old, use it
        if (now.getTime() - cacheTime.getTime() < CACHE_DURATION_MS) {
          console.log("Using cached news data from", cacheTime.toLocaleString());
          setNewsItems(data);
          setLastRefresh(cacheTime);
          setIsLoading(false);
          return;
        } else {
          console.log("Cache expired, fetching fresh news data");
        }
      }
      
      // If no valid cache or force refresh, fetch new data
      const data = await fetchInstagramNews();
      
      // Cache the new data with timestamp
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data,
          timestamp: new Date().toISOString(),
        })
      );
      
      setNewsItems(data);
      const refreshTime = new Date();
      setLastRefresh(refreshTime);
      
      // Show toast notification on manual refresh only
      if (forceRefresh) {
        toast({
          title: "News updated",
          description: `Successfully refreshed Instagram news at ${refreshTime.toLocaleTimeString()}`,
        });
      }
    } catch (error) {
      console.error("Error fetching news:", error);
      setError("Could not fetch news. Please try again later.");
      
      // Try to use cached data even if it's expired
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        setNewsItems(data);
        setLastRefresh(new Date(timestamp));
        toast({
          title: "Using cached news",
          description: "Could not fetch fresh news data. Using cached results instead.",
          variant: "default"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    // No automatic refresh interval anymore
    // We only fetch on first load or manual refresh
  }, []);

  const handleManualRefresh = () => {
    // Calculate time since last refresh
    const timeSinceRefresh = new Date().getTime() - lastRefresh.getTime();
    
    // Only allow manual refresh after 24 hours
    if (timeSinceRefresh < CACHE_DURATION_MS) {
      const hoursRemaining = Math.ceil((CACHE_DURATION_MS - timeSinceRefresh) / (1000 * 60 * 60));
      toast({
        title: "Refresh limited",
        description: `You can refresh again in ${hoursRemaining} hours to conserve API credits.`,
        variant: "default"
      });
      return;
    }
    
    fetchNews(true); // Force refresh
  };

  const renderNewsItem = (news: NewsItem, index: number, isSelected: boolean) => {
    return (
      <div className={`flex space-x-4 p-4 border rounded-lg transition-colors ${isSelected ? 'border-insta-primary shadow-md bg-gray-50' : 'border-gray-200 hover:border-insta-primary/50'}`}>
        {news.imageUrl ? (
          <img 
            src={news.imageUrl} 
            alt={news.title}
            className="h-24 w-24 object-cover rounded-lg flex-shrink-0"
            onError={(e) => {
              // Suppress 403 errors and show placeholder
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
            crossOrigin="anonymous"
          />
        ) : (
          <div className="h-24 w-24 bg-gray-200 flex items-center justify-center rounded-lg flex-shrink-0">
            <Instagram className="h-6 w-6 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900">{news.title}</h4>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{news.description}</p>
          <div className="flex items-center justify-between mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-1">
              <span className="text-xs text-muted-foreground">{news.source}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs hover:text-insta-primary w-full sm:w-auto mt-2 sm:mt-0"
                onClick={() => window.open(news.url, '_blank')}
              >
                Read More <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNewsList = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex space-x-4 p-4 border rounded-lg">
              <Skeleton className="h-24 w-24 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (newsItems.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-4">
          No news articles found.
        </p>
      );
    }

    // Show all news items in a scrollable container, but only 5 visible at a time
    return (
      <div className="overflow-y-auto space-y-4 pr-2 custom-scrollbar" style={{maxHeight: '620px', minHeight: '620px'}}>
        {newsItems.map((news, idx) => (
          <div key={news.id}>{renderNewsItem(news, idx, false)}</div>
        ))}
      </div>
    );
  };

  return (
    <Card className="animate-fade-in w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <div className="flex items-center">
            <Newspaper className="mr-2 h-5 w-5 text-insta-primary" />
            Instagram News
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleManualRefresh}
            disabled={isLoading}
            title="Refresh only available every 24 hours"
          >
            <Clock className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="w-full">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {renderNewsList()}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-0 flex justify-between items-center">
        <span>Last refreshed: {lastRefresh.toLocaleString()}</span>
        <span className="text-xs italic">Updates every 24 hours</span>
      </CardFooter>
    </Card>
  );
};

export default InstagramNews;
