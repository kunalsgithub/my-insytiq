import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, Users, Trophy, Calendar, BarChart, RefreshCw, ArrowUp, ArrowDown } from "lucide-react";
import { fetchSocialBladeStats } from "@/services/socialBladeService";
import type { SocialBladeStats } from "@/services/socialBladeService";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as RechartsBarChart, Bar, Legend } from 'recharts';
import { formatNumber, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LiveFollowerCounter } from "./LiveFollowerCounter";

interface SocialBladeStatsProps {
  username: string;
  className?: string;
}

const DATE_RANGES = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 90 days", value: "90" },
  { label: "Last year", value: "365" },
];

export function SocialBladeStats({ username, className = "" }: SocialBladeStatsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("30");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: stats, isLoading, error, refetch } = useQuery<SocialBladeStats>({
    queryKey: ["socialBladeStats", username],
    queryFn: () => fetchSocialBladeStats(username),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  // Animated counter for live follower count
  const [displayCount, setDisplayCount] = useState(0);
  useEffect(() => {
    if (!stats?.currentFollowers) return;
    
    const target = stats.currentFollowers;
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = (target - displayCount) / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      setDisplayCount(Math.round(displayCount + increment));
      
      if (currentStep === steps) {
        setDisplayCount(target);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [stats?.currentFollowers]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // Calculate 24h follower change
  const get24hChange = () => {
    if (!stats?.followerGrowth || stats.followerGrowth.length < 2) return null;
    const today = stats.followerGrowth[stats.followerGrowth.length - 1];
    const yesterday = stats.followerGrowth[stats.followerGrowth.length - 2];
    return today.count - yesterday.count;
  };

  const renderLiveFollowerCount = () => {
    const change24h = get24hChange();
    const isPositive = change24h && change24h > 0;

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Live Followers</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(displayCount)}</div>
          {change24h && (
            <div className={cn(
              "flex items-center text-xs mt-1",
              isPositive ? "text-green-500" : "text-red-500"
            )}>
              {isPositive ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
              {formatNumber(Math.abs(change24h))} in last 24h
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Last updated: {stats?.lastUpdated ? formatDate(stats.lastUpdated) : "N/A"}
          </p>
        </CardContent>
      </Card>
    );
  };

  const renderFollowerGrowthChart = () => {
    if (!stats?.followerGrowth) return null;

    // Filter data based on selected date range
    const filteredData = stats.followerGrowth.slice(-parseInt(dateRange));
    
    // Calculate growth rate trend
    const growthRateData = filteredData.map((point, index, array) => {
      if (index === 0) return { ...point, growthRate: 0 };
      const prevPoint = array[index - 1];
      const growthRate = ((point.count - prevPoint.count) / prevPoint.count) * 100;
      return { ...point, growthRate };
    });

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="h-[300px] w-full bg-white rounded-xl p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growthRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => formatDate(date)}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="left"
                tickFormatter={(value) => formatNumber(value)}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => `${value.toFixed(1)}%`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name === "growthRate" ? `${value.toFixed(1)}%` : formatNumber(value),
                  name === "growthRate" ? "Growth Rate" : "Followers"
                ]}
                labelFormatter={(date) => formatDate(date)}
              />
              <Legend />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="count" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="Followers"
                dot={false}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="growthRate" 
                stroke="#82ca9d" 
                strokeWidth={2}
                name="Growth Rate"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderProjectionsChart = () => {
    if (!stats?.projections) return null;

    const data = [
      { name: "30 Days", projected: stats.projections.thirtyDay.projected, growth: stats.projections.thirtyDay.growth },
      { name: "60 Days", projected: stats.projections.sixtyDay.projected, growth: stats.projections.sixtyDay.growth },
      { name: "1 Year", projected: stats.projections.yearly.projected, growth: stats.projections.yearly.growth },
    ];

    return (
      <div className="h-[300px] w-full bg-white rounded-xl p-4">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis 
              yAxisId="left"
              tickFormatter={(value) => formatNumber(value)}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                name === "growth" ? `${value}%` : formatNumber(value),
                name === "growth" ? "Growth" : "Projected"
              ]}
            />
            <Bar yAxisId="left" dataKey="projected" fill="#8884d8" name="Projected" />
            <Bar yAxisId="right" dataKey="growth" fill="#82ca9d" name="Growth" />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderHistoricalStatsChart = () => {
    if (!stats?.historicalStats) return null;

    return (
      <div className="h-[300px] w-full bg-white rounded-xl p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stats.historicalStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => formatDate(date)}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tickFormatter={(value) => formatNumber(value)}
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                formatNumber(value),
                name === "avgLikes" ? "Avg Likes" : 
                name === "avgComments" ? "Avg Comments" : 
                name.charAt(0).toUpperCase() + name.slice(1)
              ]}
              labelFormatter={(date) => formatDate(date)}
            />
            <Line type="monotone" dataKey="avgLikes" stroke="#8884d8" name="Avg Likes" />
            <Line type="monotone" dataKey="avgComments" stroke="#82ca9d" name="Avg Comments" />
            <Line type="monotone" dataKey="engagement" stroke="#ffc658" name="Engagement" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderOverview = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <LiveFollowerCounter
        username={username}
        initialCount={stats?.currentFollowers || 0}
        onRefresh={refetch}
        className="col-span-1"
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Global Rank</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">#{formatNumber(stats?.ranking.global.rank || 0)}</div>
          <p className="text-xs text-muted-foreground">
            Top {stats?.ranking.global.percentile.toFixed(1)}% of all accounts
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Category Rank</CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">#{formatNumber(stats?.ranking.category.rank || 0)}</div>
          <p className="text-xs text-muted-foreground">
            {stats?.ranking.category.name} • Top {stats?.ranking.category.percentile.toFixed(1)}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">30-Day Growth</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">+{stats?.projections.thirtyDay.growth || 0}%</div>
          <p className="text-xs text-muted-foreground">
            Projected: {formatNumber(stats?.projections.thirtyDay.projected || 0)}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load Social Blade stats. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle>Social Blade Analytics</CardTitle>
          <CardDescription>
            Detailed analytics and statistics for @{username}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="growth">Follower Growth</TabsTrigger>
              <TabsTrigger value="projections">Projections</TabsTrigger>
              <TabsTrigger value="historical">Historical Stats</TabsTrigger>
            </TabsList>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-[300px] w-full" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[100px] w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <TabsContent value="overview" className="space-y-4">
                  {renderOverview()}
                </TabsContent>

                <TabsContent value="growth" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Follower Growth Trend</CardTitle>
                      <CardDescription>
                        Daily follower count and growth rate
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderFollowerGrowthChart()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="projections" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Growth Projections</CardTitle>
                      <CardDescription>
                        Projected follower count and growth rate
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderProjectionsChart()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="historical" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Historical Performance</CardTitle>
                      <CardDescription>
                        Daily engagement and interaction metrics
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {renderHistoricalStatsChart()}
                    </CardContent>
                  </Card>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
} 