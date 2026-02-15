import { useState, useEffect } from "react";
import { Tag, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchTrendingHashtags, TrendingHashtag } from "@/services/instagramService";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

interface TrendingHashtagsProps {
  selectedCategory?: string;
}

const TrendingHashtags = ({ selectedCategory = "all" }: TrendingHashtagsProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [displayedHashtags, setDisplayedHashtags] = useState<TrendingHashtag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    // Listen for search events from the Navbar
    const handleSearch = (event: Event) => {
      const customEvent = event as CustomEvent;
      setSearchTerm(customEvent.detail.searchTerm);
    };

    window.addEventListener('insta-search', handleSearch);
    
    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('insta-search', handleSearch);
    };
  }, []);

  const getHashtags = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log(`Fetching hashtags with category: ${selectedCategory} and search: ${searchTerm || 'none'}`);
      const hashtags = await fetchTrendingHashtags(searchTerm, selectedCategory);
      console.log("Fetched Hashtags:", hashtags); 
      setDisplayedHashtags(hashtags);
      setLastRefresh(new Date());
      
      // Show a toast with the number of hashtags fetched
      toast({
        title: "Hashtags Loaded",
        description: `Loaded ${hashtags.length} trending hashtags`,
        variant: "default"
      });
    } catch (error) {
      console.error("Error fetching hashtags:", error);
      setError("Could not fetch hashtag data. Please check your Google Sheet format.");
      
      // Show a toast notification
      toast({
        title: "Error fetching data",
        description: "Please check your Google Sheet format and API connection.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getHashtags();
  }, [selectedCategory, searchTerm]);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <div className="flex items-center">
            <Tag className="mr-2 h-5 w-5 text-insta-primary" />
            Trending Hashtags {searchTerm && `for "${searchTerm}"`}
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={getHashtags}
            disabled={isLoading}
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-4">
          {isLoading ? (
            // Skeleton loading state
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between">
                <Skeleton className="h-4 w-[120px]" />
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-[60px]" />
                  <Skeleton className="h-4 w-[40px]" />
                </div>
              </div>
            ))
          ) : displayedHashtags.length > 0 ? (
            displayedHashtags.map((hashtag) => (
              <div key={hashtag.id} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-insta-primary font-medium">#{hashtag.name}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-muted-foreground">{hashtag.posts} posts</span>
                  <span className="text-xs text-emerald-500 flex items-center min-w-[36px] justify-end" style={{fontSize:'0.85rem', minWidth:'32px'}}>
                    +{hashtag.growth}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-4">No trending hashtags found for your search.</p>
          )}
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-0">
        Last refreshed: {lastRefresh.toLocaleTimeString()}
      </CardFooter>
    </Card>
  );
};

export default TrendingHashtags;
