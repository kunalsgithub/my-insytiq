import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useInstagramData } from "../hooks/useInstagramData";
import { Button } from "./ui/button";
import { ChevronDown, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import DailyChannelMetrics from "./DailyChannelMetrics";
import SocialBladeChart from "./SocialBladeChart";
import { PLAN, hasAccess } from "../utils/accessControl";
import { db } from "../services/firebaseService";
import { collection, doc, setDoc } from 'firebase/firestore';

interface InstagramAnalyticsProps {
  username: string;
}

const InstagramAnalytics: React.FC<InstagramAnalyticsProps & { userPlan?: string }> = ({ username, userPlan = PLAN.FREE }) => {
  const [data, analyzeUsername] = useInstagramData();
  const [selectedDays, setSelectedDays] = useState(30);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [growthView, setGrowthView] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const hasSyncedHistory = useRef(false);

  useEffect(() => {
    if (username) {
      analyzeUsername(username);
    }
  }, [username, analyzeUsername]);

  const filterOptions = [
    { label: "Last 14 Days", value: 14, enabled: true },
    { label: "Last 30 Days", value: 30, enabled: true },
    { label: "Last 60 Days", value: 60, enabled: false },
    { label: "Last 180 Days", value: 180, enabled: false },
    { label: "Last 365 Days", value: 365, enabled: false },
    { label: "Last 3 Years", value: 1095, enabled: false },
  ];

  const weeklyGrowthData = useMemo(() => {
    if (data.insights?.followers?.growth && data.insights.followers.growth.length > 0) {
      const mapped = data.insights.followers.growth
        .filter(item => {
          if (!item.date || item.count === undefined || item.count === null) return false;
          const date = new Date(item.date);
          return !isNaN(date.getTime()) && Number(item.count) >= 0;
        })
        .map(item => {
          const dateStr = typeof item.date === 'string' 
            ? item.date 
            : new Date(item.date).toISOString().split('T')[0];
          return {
            date: dateStr,
            value: Number(item.count) || 0
          };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort chronologically
      
      console.log('weeklyGrowthData processed:', mapped.length, 'points. First:', mapped[0], 'Last:', mapped[mapped.length - 1]);
      return mapped;
    }
    console.log('No growth data available in data.insights.followers.growth:', data.insights?.followers?.growth);
    return [];
  }, [data.insights?.followers?.growth]);

  // Backfill followerHistory collection from Social Blade growth data so
  // Growth Comparison can use a full 30-day window without waiting day by day.
  useEffect(() => {
    if (!username || !weeklyGrowthData.length || hasSyncedHistory.current) {
      return;
    }

    const normalized = username.toLowerCase().trim();
    const historyCol = collection(db, 'followerHistory');

    const syncHistory = async () => {
      const last30 = weeklyGrowthData.slice(-30);
      await Promise.all(
        last30.map((item) => {
          const dateStr =
            typeof item.date === 'string'
              ? item.date
              : new Date(item.date).toISOString().split('T')[0];
          const dateObj = new Date(dateStr);
          if (isNaN(dateObj.getTime())) {
            return Promise.resolve();
          }
          const followers = Number((item as any).value ?? 0);
          const historyId = `${normalized}_${dateStr}`;
          return setDoc(
            doc(historyCol, historyId),
            {
              username: normalized,
              date: dateObj,
              followers,
            },
            { merge: true }
          );
        })
      );
      hasSyncedHistory.current = true;
    };

    syncHistory();
  }, [username, weeklyGrowthData]);

  const projectionsData = useMemo(() => {
    if (data.followerProjections && data.followerProjections.length > 0) {
        const mapped = data.followerProjections
          .filter(item => item.date && item.count !== undefined && item.count !== null)
          .map(item => ({
            date: typeof item.date === 'string' ? item.date : new Date(item.date).toISOString().split('T')[0],
            value: Number(item.count) || 0
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort chronologically
        
        console.log('Projections data processed:', mapped.length, 'points', mapped.slice(0, 3), '...', mapped.slice(-3));
        return mapped;
    }
    console.log('No projections data available');
    return [];
  }, [data.followerProjections]);

  const dailyMetrics = useMemo(() => {
    return Array.from({ length: selectedDays }, (_, i) => {
    const date = new Date();
      date.setDate(new Date().getDate() - (selectedDays - 1 - i));
      const followersChange = Math.floor(Math.random() * 1000) - 400;
      const followingChange = Math.floor(Math.random() * 10) - 5;
      const mediaChange = Math.floor(Math.random() * 5) - 1;
    return {
        date: date,
        followersChange: followersChange,
        followersTotal: 160000 + i * 500 + followersChange,
        followingChange: followingChange,
        followingTotal: 1500 + i + followingChange,
        mediaChange: mediaChange,
        mediaTotal: 2350 + i + mediaChange,
    };
  });
  }, [selectedDays]);


  // Add filter options for the growth chart
  const growthViewOptions = [
    { label: 'Daily', value: 'daily' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Monthly', value: 'monthly' },
  ];

  // Helper to aggregate data by week (group by calendar weeks)
  // Use the last value of each week (end of week follower count)
  function aggregateByWeek(data: Array<{ date: string; value: number }>) {
    if (!data.length) return [];
    const result: Array<{ date: string; value: number }> = [];
    const weekMap: { [key: string]: { date: string; value: number } } = {};
    
    data.forEach(item => {
      const date = new Date(item.date);
      if (isNaN(date.getTime())) return; // Skip invalid dates
      
      // Get the start of the week (Monday)
      const weekStart = new Date(date);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekKey = weekStart.toISOString().split('T')[0];
      
      // Keep the latest value for each week (end of week)
      if (!weekMap[weekKey] || new Date(item.date) > new Date(weekMap[weekKey].date)) {
        weekMap[weekKey] = {
          date: item.date, // Use the actual date from the data
          value: item.value || 0
        };
      }
    });
    
    // Convert to array, sorted by date
    Object.keys(weekMap).sort().forEach(weekKey => {
      result.push(weekMap[weekKey]);
    });
    
    return result;
  }

  // Helper to aggregate data by month (group by actual months in data)
  // Use the last value of each month (end of month follower count)
  function aggregateByMonth(data: Array<{ date: string; value: number }>) {
    if (!data.length) return [];
    const result: Array<{ date: string; value: number }> = [];
    const monthMap: { [key: string]: { date: string; value: number } } = {};
    
    data.forEach(item => {
      const date = new Date(item.date);
      if (isNaN(date.getTime())) return; // Skip invalid dates
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      // Keep the latest value for each month (end of month)
      if (!monthMap[monthKey] || new Date(item.date) > new Date(monthMap[monthKey].date)) {
        monthMap[monthKey] = {
          date: item.date, // Use the actual date from the data
          value: item.value || 0
        };
      }
    });
    
    // Convert to array, sorted by date
    Object.keys(monthMap).sort().forEach(monthKey => {
      result.push(monthMap[monthKey]);
    });
    
    return result;
  }

  // Filter and aggregate data based on the selected view
  const filteredGrowthData = useMemo(() => {
    console.log('weeklyGrowthData:', weeklyGrowthData);
    if (!weeklyGrowthData || weeklyGrowthData.length === 0) {
      console.log('No weeklyGrowthData available');
      return [];
    }
    
    let processed: Array<{ date: string; value: number }> = [];
    
    if (growthView === 'daily') {
      // For daily view, use raw data - ensure dates are valid strings
      processed = weeklyGrowthData
        .filter(item => item.date && item.value !== undefined && item.value !== null)
        .map(item => ({
          date: typeof item.date === 'string' ? item.date : new Date(item.date).toISOString().split('T')[0],
          value: item.value || 0
        }));
      console.log('Daily view - processed data:', processed.length, 'points');
    } else if (growthView === 'weekly') {
      processed = aggregateByWeek(weeklyGrowthData);
      console.log('Weekly view - processed data:', processed.length, 'points');
    } else if (growthView === 'monthly') {
      processed = aggregateByMonth(weeklyGrowthData);
      console.log('Monthly view - processed data:', processed.length, 'points');
    }
    
    // Ensure data is in the correct format for SocialBladeChart
    const formatted = processed
      .filter(item => {
        if (!item.date) return false;
        const date = new Date(item.date);
        return !isNaN(date.getTime()) && item.value !== undefined && item.value !== null;
      })
      .map(item => ({
        date: typeof item.date === 'string' ? item.date : new Date(item.date).toISOString().split('T')[0],
        value: Number(item.value) || 0
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date
    
    console.log(`Filtered growth data for ${growthView}:`, formatted.length, 'points', formatted.slice(0, 3));
    return formatted;
  }, [weeklyGrowthData, growthView]);


  // If user does not have analytics access, blur and show modal
  const analyticsAllowed = hasAccess("analytics", userPlan);

  return (
    <div className="w-full space-y-8 relative">
      <div>
      {/* Followers Growth Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]">Followers Growth</CardTitle>
              <CardDescription className="text-gray-700">Daily Follower Count from Social Blade</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {growthViewOptions.find(o => o.value === growthView)?.label}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {growthViewOptions.map(option => (
                  <DropdownMenuItem key={option.value} onSelect={() => setGrowthView(option.value)}>
                    {option.label}
                    {growthView === option.value && <Check className="ml-auto h-4 w-4 text-green-500" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
        </CardHeader>
          <CardContent>
            <div className="w-full h-96 bg-white rounded-lg border p-2">
              {filteredGrowthData.length > 0 ? (
                <SocialBladeChart
                  id="followers-chart"
                  data={filteredGrowthData}
                  valueField="value"
                  dateField="date"
                  interval={growthView === 'monthly' ? 'month' : 'day'}
                  height="100%"
                  color="#4285f4"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No data available for {growthView} view</p>
                </div>
              )}
            </div>
        </CardContent>
      </Card>
      {/* Projections Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]">Fanbase Forecast</CardTitle>
            <CardDescription className="text-gray-700">Future Projected Follower Count (5 Years, Monthly) - Created using Holt's Linear method</CardDescription>
        </CardHeader>
          <CardContent>
            <div className="w-full h-96 bg-white rounded-lg border p-2">
              <SocialBladeChart
                id="projections-chart"
                data={projectionsData}
                valueField="value"
                dateField="date"
                interval="month"
                height="100%"
                color="#dc2626"
              />
            </div>
        </CardContent>
      </Card>
        {/* Daily Channel Metrics */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]">Daily Channel Metrics</CardTitle>
              <CardDescription className="text-gray-700">Follower history</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {filterOptions.find(o => o.value === selectedDays)?.label}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {filterOptions.map(option => (
                  <DropdownMenuItem key={option.value} onSelect={() => setSelectedDays(option.value)}>
                    {option.label}
                    {selectedDays === option.value && <Check className="ml-auto h-4 w-4 text-green-500" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            <DailyChannelMetrics metrics={dailyMetrics} />
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default InstagramAnalytics; 