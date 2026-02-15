import React, { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SocialBladeChart from './SocialBladeChart';

interface DailyEngagementChartProps {
  data: {
    date: string;
    likes: number;
    comments: number;
  }[];
}

const METRICS = [
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
];

const DailyEngagementChart: React.FC<DailyEngagementChartProps> = ({ data }) => {
  const [activeMetric, setActiveMetric] = useState('likes');

  // Transform data for the selected metric
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map(item => ({
      date: item.date,
      value: item[activeMetric] || 0
    }));
  }, [data, activeMetric]);

  const chartColors: { [key: string]: string } = {
    likes: '#f472b6',
    comments: '#60a5fa',
  };

  return (
    <Card>
        <CardHeader>
        <CardTitle className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]">Daily Engagement Trends</CardTitle>
            <CardDescription>Daily likes and comments from Social Blade</CardDescription>
        </CardHeader>
        <CardContent>
        <Tabs value={activeMetric} onValueChange={setActiveMetric} className="w-full mb-2">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            {METRICS.map(m => (
              <TabsTrigger key={m.key} value={m.key}>{m.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
            <div className="w-full" style={{ height: "500px" }}>
              <SocialBladeChart
                id="engagementChartDiv"
                data={chartData}
                valueField="value"
                dateField="date"
                interval="day"
                height="100%"
                color={chartColors[activeMetric]}
              />
            </div>
        </CardContent>
    </Card>
  );
};

export default DailyEngagementChart; 