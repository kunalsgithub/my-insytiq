import { useQuery } from '@tanstack/react-query';
import { getTrendingHashtags, getTrendingReels, getTrendingAudio } from '@/services/instagramService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface TrendingChartProps {
  selectedCategory: string;
}

const TrendingChart = ({ selectedCategory }: TrendingChartProps) => {
  const { data: hashtags } = useQuery({
    queryKey: ['trending-hashtags', selectedCategory],
    queryFn: () => getTrendingHashtags(selectedCategory),
  });

  const { data: reels } = useQuery({
    queryKey: ['trending-reels', selectedCategory],
    queryFn: () => getTrendingReels(selectedCategory),
  });

  const { data: audioClips } = useQuery({
    queryKey: ['trending-audio', selectedCategory],
    queryFn: () => getTrendingAudio(selectedCategory),
  });

  // Prepare data for the chart
  const chartData = [
    {
      name: 'Hashtags',
      value: hashtags?.length || 0,
    },
    {
      name: 'Reels',
      value: reels?.length || 0,
    },
    {
      name: 'Audio',
      value: audioClips?.length || 0,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Trending Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{hashtags?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Trending Hashtags</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{reels?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Trending Reels</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{audioClips?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Trending Audio</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrendingChart;
