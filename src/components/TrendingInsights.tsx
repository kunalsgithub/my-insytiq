import { useState, useEffect } from "react";
import { TrendingUp, Search, Music, Hash, BarChart2, Clock, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchTrendingData, TrendingItem } from "@/services/trendsService";

interface TrendingInsightsProps {
  selectedCategory?: string;
}

const TrendingInsights = ({ selectedCategory = "all" }: TrendingInsightsProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [trendingItems, setTrendingItems] = useState<TrendingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"hashtags" | "audio">("hashtags");

  const fetchTrendingDataHandler = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTrendingData(searchTerm, selectedCategory, activeTab);
      setTrendingItems(data);
      setLastRefresh(new Date());
      
      toast({
        title: "Trends Updated",
        description: "Latest trending data has been loaded",
        variant: "default"
      });
    } catch (error) {
      console.error("Error fetching trends:", error);
      setError("Could not fetch trending data. Please try again later.");
      
      toast({
        title: "Error fetching trends",
        description: "Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendingDataHandler();
  }, [selectedCategory, activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrendingDataHandler();
  };

  const renderTrendingList = (items: TrendingItem[]) => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-4">
          No trending {activeTab} found for your search.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((item) => (
          <div 
            key={item.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:border-insta-primary transition-colors"
          >
            <div className="flex items-center space-x-4">
              {item.type === "hashtag" ? (
                <Hash className="h-5 w-5 text-insta-primary" />
              ) : (
                <Music className="h-5 w-5 text-insta-primary" />
              )}
              <div>
                <h4 className="font-medium">{item.name}</h4>
                <p className="text-sm text-muted-foreground">
                  Interest: {item.interest}% • Momentum: {item.momentum}%
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`flex items-center ${item.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                <ArrowUpRight className="h-4 w-4" />
                <span>{Math.abs(item.change)}%</span>
              </div>
              <Button variant="ghost" size="sm">
                <BarChart2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <div className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5 text-insta-primary" />
            Trending Insights
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchTrendingDataHandler}
            disabled={isLoading}
          >
            <Clock className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSearch} className="mb-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Search trends..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </form>
        
        <Tabs defaultValue="hashtags" value={activeTab} onValueChange={(value) => setActiveTab(value as "hashtags" | "audio")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="hashtags" className="flex items-center">
              <Hash className="mr-2 h-4 w-4" />
              Hashtags
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center">
              <Music className="mr-2 h-4 w-4" />
              Audio
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="hashtags" className="mt-0">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Rising Hashtags</h3>
              {renderTrendingList(trendingItems.filter(item => item.type === "hashtag"))}
            </div>
          </TabsContent>
          
          <TabsContent value="audio" className="mt-0">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Trending Audio</h3>
              {renderTrendingList(trendingItems.filter(item => item.type === "audio"))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-0">
        Last refreshed: {lastRefresh.toLocaleTimeString()}
      </CardFooter>
    </Card>
  );
};

export default TrendingInsights; 