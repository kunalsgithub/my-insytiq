import React, { useState } from 'react';
import { Flame, Download, BarChart3, TrendingUp, TrendingDown, Users, FileText, Heart, MessageCircle, Share2, Calendar, Search, Plus, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';

// Mock data for different date ranges
const dateRanges = [
  { label: 'Jun 18 – Jul 17', value: 'jun-jul' },
  { label: 'May 18 – Jun 17', value: 'may-jun' },
  { label: 'Apr 18 – May 17', value: 'apr-may' },
  { label: 'Mar 18 – Apr 17', value: 'mar-apr' },
];

const competitorsData = {
  'jun-jul': [
    { rank: 1, name: 'Papa Don\'t Preach', followers: '2.4M', growth: '+8.2%', posts: 89, postGrowth: '+15%', engagement: '5.2%', engagementGrowth: '+0.4%' },
    { rank: 2, name: 'Mulmul', followers: '1.8M', growth: '+6.1%', posts: 67, postGrowth: '+12%', engagement: '4.9%', engagementGrowth: '+0.2%' },
    { rank: 3, name: 'Indie Fashion Co', followers: '1.2M', growth: '+4.8%', posts: 45, postGrowth: '+8%', engagement: '4.1%', engagementGrowth: '-0.1%' },
    { rank: 4, name: 'Style Street', followers: '890K', growth: '+3.2%', posts: 34, postGrowth: '+5%', engagement: '3.8%', engagementGrowth: '+0.1%' },
    { rank: 5, name: 'Trendy Threads', followers: '650K', growth: '+2.1%', posts: 28, postGrowth: '+3%', engagement: '3.5%', engagementGrowth: '-0.2%' },
  ],
  'may-jun': [
    { rank: 1, name: 'Mulmul', followers: '1.7M', growth: '+7.8%', posts: 72, postGrowth: '+18%', engagement: '5.8%', engagementGrowth: '+0.6%' },
    { rank: 2, name: 'Papa Don\'t Preach', followers: '2.2M', growth: '+5.9%', posts: 76, postGrowth: '+11%', engagement: '4.7%', engagementGrowth: '+0.1%' },
    { rank: 3, name: 'Style Street', followers: '850K', growth: '+5.2%', posts: 41, postGrowth: '+9%', engagement: '4.3%', engagementGrowth: '+0.3%' },
    { rank: 4, name: 'Indie Fashion Co', followers: '1.1M', growth: '+3.9%', posts: 38, postGrowth: '+6%', engagement: '3.9%', engagementGrowth: '+0.1%' },
    { rank: 5, name: 'Trendy Threads', followers: '620K', growth: '+2.8%', posts: 25, postGrowth: '+4%', engagement: '3.2%', engagementGrowth: '-0.1%' },
  ],
  'apr-may': [
    { rank: 1, name: 'Indie Fashion Co', followers: '1.0M', growth: '+9.1%', posts: 52, postGrowth: '+22%', engagement: '6.2%', engagementGrowth: '+0.8%' },
    { rank: 2, name: 'Mulmul', followers: '1.6M', growth: '+6.5%', posts: 58, postGrowth: '+14%', engagement: '5.1%', engagementGrowth: '+0.3%' },
    { rank: 3, name: 'Papa Don\'t Preach', followers: '2.1M', growth: '+4.2%', posts: 65, postGrowth: '+8%', engagement: '4.3%', engagementGrowth: '+0.2%' },
    { rank: 4, name: 'Style Street', followers: '810K', growth: '+4.8%', posts: 37, postGrowth: '+7%', engagement: '4.0%', engagementGrowth: '+0.2%' },
    { rank: 5, name: 'Trendy Threads', followers: '600K', growth: '+3.1%', posts: 22, postGrowth: '+5%', engagement: '3.0%', engagementGrowth: '+0.1%' },
  ],
  'mar-apr': [
    { rank: 1, name: 'Style Street', followers: '770K', growth: '+10.5%', posts: 44, postGrowth: '+25%', engagement: '6.8%', engagementGrowth: '+1.2%' },
    { rank: 2, name: 'Indie Fashion Co', followers: '920K', growth: '+7.3%', posts: 43, postGrowth: '+16%', engagement: '5.4%', engagementGrowth: '+0.5%' },
    { rank: 3, name: 'Mulmul', followers: '1.5M', growth: '+5.1%', posts: 51, postGrowth: '+11%', engagement: '4.8%', engagementGrowth: '+0.2%' },
    { rank: 4, name: 'Papa Don\'t Preach', followers: '2.0M', growth: '+3.8%', posts: 60, postGrowth: '+6%', engagement: '4.1%', engagementGrowth: '+0.1%' },
    { rank: 5, name: 'Trendy Threads', followers: '580K', growth: '+2.9%', posts: 21, postGrowth: '+4%', engagement: '2.9%', engagementGrowth: '+0.1%' },
  ],
};

const trendingPostsData = {
  'jun-jul': [
    {
      brand: 'Papa Don\'t Preach',
      text: 'Summer collection is here! 🌞 Which piece is your favorite? #SummerVibes #Fashion',
      likes: 12400,
      comments: 890,
      shares: 234,
      engagement: '8.2%'
    },
    {
      brand: 'Mulmul',
      text: 'Behind the scenes of our latest shoot 📸 The magic happens here! #BehindTheScenes',
      likes: 8900,
      comments: 567,
      shares: 189,
      engagement: '6.8%'
    },
    {
      brand: 'Indie Fashion Co',
      text: 'Sustainable fashion isn\'t just a trend, it\'s our future 🌱 #SustainableFashion',
      likes: 6700,
      comments: 423,
      shares: 156,
      engagement: '5.9%'
    },
    {
      brand: 'Style Street',
      text: 'New arrivals alert! 🚨 Limited edition pieces dropping tomorrow #NewArrivals',
      likes: 5400,
      comments: 298,
      shares: 98,
      engagement: '4.8%'
    },
  ],
  'may-jun': [
    {
      brand: 'Mulmul',
      text: 'Spring collection preview! 🌸 What do you think? #SpringFashion #NewCollection',
      likes: 11200,
      comments: 745,
      shares: 198,
      engagement: '7.9%'
    },
    {
      brand: 'Papa Don\'t Preach',
      text: 'Weekend vibes with our latest drop 💫 #WeekendStyle #FashionGoals',
      likes: 9800,
      comments: 623,
      shares: 167,
      engagement: '6.5%'
    },
    {
      brand: 'Style Street',
      text: 'Sustainable choices, beautiful results 🌿 #EcoFashion #SustainableStyle',
      likes: 7200,
      comments: 445,
      shares: 134,
      engagement: '5.7%'
    },
    {
      brand: 'Indie Fashion Co',
      text: 'Limited time offer! ⏰ Don\'t miss out on these exclusive pieces #LimitedEdition',
      likes: 5800,
      comments: 312,
      shares: 87,
      engagement: '4.9%'
    },
  ],
  'apr-may': [
    {
      brand: 'Indie Fashion Co',
      text: 'Earth Day special! 🌍 Sustainable fashion for a better tomorrow #EarthDay #SustainableFashion',
      likes: 13500,
      comments: 892,
      shares: 245,
      engagement: '9.1%'
    },
    {
      brand: 'Mulmul',
      text: 'Spring cleaning sale! 🧹 Refresh your wardrobe with our latest deals #SpringSale',
      likes: 10200,
      comments: 678,
      shares: 189,
      engagement: '7.2%'
    },
    {
      brand: 'Papa Don\'t Preach',
      text: 'New collection dropping soon! 🎉 Get ready for something amazing #NewCollection',
      likes: 8900,
      comments: 534,
      shares: 156,
      engagement: '6.1%'
    },
    {
      brand: 'Style Street',
      text: 'Behind the scenes of our photo shoot 📸 The team that makes it all possible #BehindTheScenes',
      likes: 6800,
      comments: 398,
      shares: 112,
      engagement: '5.3%'
    },
  ],
  'mar-apr': [
    {
      brand: 'Style Street',
      text: 'Spring has sprung! 🌸 New season, new style #SpringFashion #NewSeason',
      likes: 14800,
      comments: 945,
      shares: 267,
      engagement: '10.2%'
    },
    {
      brand: 'Indie Fashion Co',
      text: 'Sustainable fashion week! 🌱 Celebrating eco-friendly choices #SustainableFashionWeek',
      likes: 11800,
      comments: 723,
      shares: 198,
      engagement: '8.1%'
    },
    {
      brand: 'Mulmul',
      text: 'Easter collection is here! 🐰 Perfect pieces for the holiday #EasterCollection',
      likes: 9500,
      comments: 589,
      shares: 167,
      engagement: '6.8%'
    },
    {
      brand: 'Papa Don\'t Preach',
      text: 'Spring cleaning your wardrobe? 🧹 We\'ve got the perfect pieces #SpringCleaning',
      likes: 7800,
      comments: 445,
      shares: 134,
      engagement: '5.9%'
    },
  ],
};

export default function CompetitorContentHeatmap() {
  const [selectedRange, setSelectedRange] = useState('jun-jul');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('table');
  const [competitorUsernames, setCompetitorUsernames] = useState<string[]>([]);
  const [newCompetitor, setNewCompetitor] = useState('');

  // Get current data based on selected range
  const currentCompetitors = competitorsData[selectedRange as keyof typeof competitorsData];
  const currentTrendingPosts = trendingPostsData[selectedRange as keyof typeof trendingPostsData];

  const exportData = () => {
    // Simulate CSV export
    toast({ title: 'Data exported successfully!' });
  };

  const addCompetitor = () => {
    const username = newCompetitor.trim();
    if (!username) {
      toast({ title: 'Please enter a competitor username', variant: 'destructive' });
      return;
    }
    
    if (competitorUsernames.length >= 5) {
      toast({ title: 'Maximum 5 competitors allowed', variant: 'destructive' });
      return;
    }
    
    if (competitorUsernames.includes(username)) {
      toast({ title: 'Competitor already added', variant: 'destructive' });
      return;
    }
    
    setCompetitorUsernames([...competitorUsernames, username]);
    setNewCompetitor('');
    toast({ title: `Added competitor: @${username}` });
  };

  const removeCompetitor = (index: number) => {
    const removed = competitorUsernames[index];
    setCompetitorUsernames(competitorUsernames.filter((_, i) => i !== index));
    toast({ title: `Removed competitor: @${removed}` });
  };

  const handleCompetitorSearch = () => {
    if (competitorUsernames.length === 0) {
      toast({ title: 'Please add at least one competitor', variant: 'destructive' });
      return;
    }
    
    toast({ title: `Analyzing ${competitorUsernames.length} competitor(s): ${competitorUsernames.map(c => `@${c}`).join(', ')}` });
    // Here you would typically make an API call to fetch competitor data
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addCompetitor();
    }
  };

  const getChangeColor = (isPositive: boolean) => {
    return isPositive ? 'text-green-600' : 'text-red-600';
  };

  const getChangeIcon = (isPositive: boolean) => {
    return isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  return (
    <div className="blur-overlay-container max-w-7xl mx-auto px-4 md:px-8 py-10 w-full md:pl-16">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4 md:ml-16 md:max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-1">Competitor Analysis</h1>
            <p className="text-gray-500 text-lg md:text-xl">Benchmark your Instagram growth and content strategy against your closest competitors.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Competitor Username Input */}
          <div className="flex flex-col gap-3">
            {/* Add Competitor Input */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Enter competitor username"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 pr-4 py-2 w-64 border-2 border-gray-200 focus:border-[#ee2a7b] focus:ring-[#ee2a7b]/20 rounded-lg"
                  disabled={competitorUsernames.length >= 5}
                />
              </div>
              <Button
                onClick={addCompetitor}
                disabled={competitorUsernames.length >= 5}
                className="bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Competitors List */}
            {competitorUsernames.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {competitorUsernames.map((competitor, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-gradient-to-r from-[#f9ce34]/20 via-[#ee2a7b]/20 to-[#6228d7]/20 border border-[#ee2a7b]/30 rounded-lg px-3 py-1"
                  >
                    <span className="text-sm font-medium text-gray-700">@{competitor}</span>
                    <button
                      onClick={() => removeCompetitor(index)}
                      className="text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Analyze Button */}
            {competitorUsernames.length > 0 && (
              <Button
                onClick={handleCompetitorSearch}
                className="bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white px-4 py-2 rounded-lg hover:shadow-lg transition-shadow w-fit"
              >
                Analyze {competitorUsernames.length} Competitor{competitorUsernames.length > 1 ? 's' : ''}
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="font-semibold text-sm border-2 border-transparent bg-white text-gray-700 hover:border-[#ee2a7b] focus:border-[#ee2a7b] px-4 py-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#ee2a7b]" />
                <span className="bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] bg-clip-text text-transparent font-bold">
                  {dateRanges.find(r => r.value === selectedRange)?.label}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {dateRanges.map(range => (
                <DropdownMenuItem
                  key={range.value}
                  onSelect={() => setSelectedRange(range.value)}
                  className={selectedRange === range.value ? 'font-bold text-[#ee2a7b] bg-[#f9ce34]/10' : ''}
                >
                  {range.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mb-6 md:ml-16 md:max-w-6xl">
        <Button
          onClick={() => setViewMode(viewMode === 'chart' ? 'table' : 'chart')}
          variant="outline"
          className="flex items-center gap-2"
        >
          <BarChart3 className="w-4 h-4" />
          {viewMode === 'chart' ? 'Table View' : 'Chart View'}
        </Button>
        <Button
          onClick={exportData}
          className="flex items-center gap-2 bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white"
        >
          <Download className="w-4 h-4" />
          Export Data
        </Button>
      </div>

      {/* Main Content - Separate Cards for Each Section */}
      <div className="space-y-6 md:ml-16 md:max-w-6xl">
        
        {/* Highlights Section */}
        <Card className="border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-blue-100/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              📌 Top Winners Section
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Most Posts */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">Most Posts</span>
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {currentCompetitors.reduce((max, comp) => comp.posts > max.posts ? comp : max).posts}
                </div>
                <div className="text-sm font-semibold text-blue-600">
                  {currentCompetitors.reduce((max, comp) => comp.posts > max.posts ? comp : max).name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {currentCompetitors.reduce((max, comp) => comp.posts > max.posts ? comp : max).postGrowth} growth
                </div>
              </div>
              
              {/* Most Followers Gained */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">Most Followers</span>
                  <Users className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {currentCompetitors.reduce((max, comp) => {
                    const maxFollowers = parseInt(max.followers.replace(/[^0-9]/g, ''));
                    const compFollowers = parseInt(comp.followers.replace(/[^0-9]/g, ''));
                    return compFollowers > maxFollowers ? comp : max;
                  }).followers}
                </div>
                <div className="text-sm font-semibold text-green-600">
                  {currentCompetitors.reduce((max, comp) => {
                    const maxFollowers = parseInt(max.followers.replace(/[^0-9]/g, ''));
                    const compFollowers = parseInt(comp.followers.replace(/[^0-9]/g, ''));
                    return compFollowers > maxFollowers ? comp : max;
                  }).name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {currentCompetitors.reduce((max, comp) => {
                    const maxFollowers = parseInt(max.followers.replace(/[^0-9]/g, ''));
                    const compFollowers = parseInt(comp.followers.replace(/[^0-9]/g, ''));
                    return compFollowers > maxFollowers ? comp : max;
                  }).growth} growth
                </div>
              </div>
              
              {/* Most Engagement */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">Most Engagement</span>
                  <Heart className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {currentCompetitors.reduce((max, comp) => {
                    const maxEngagement = parseFloat(max.engagement);
                    const compEngagement = parseFloat(comp.engagement);
                    return compEngagement > maxEngagement ? comp : max;
                  }).engagement}
                </div>
                <div className="text-sm font-semibold text-purple-600">
                  {currentCompetitors.reduce((max, comp) => {
                    const maxEngagement = parseFloat(max.engagement);
                    const compEngagement = parseFloat(comp.engagement);
                    return compEngagement > maxEngagement ? comp : max;
                  }).name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {currentCompetitors.reduce((max, comp) => {
                    const maxEngagement = parseFloat(max.engagement);
                    const compEngagement = parseFloat(comp.engagement);
                    return compEngagement > maxEngagement ? comp : max;
                  }).engagementGrowth} growth
                </div>
              </div>
              
              {/* Best Growth Rate */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-600">Best Growth Rate</span>
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {currentCompetitors.reduce((max, comp) => {
                    const maxGrowth = parseFloat(max.growth.replace('%', ''));
                    const compGrowth = parseFloat(comp.growth.replace('%', ''));
                    return compGrowth > maxGrowth ? comp : max;
                  }).growth}
                </div>
                <div className="text-sm font-semibold text-orange-600">
                  {currentCompetitors.reduce((max, comp) => {
                    const maxGrowth = parseFloat(max.growth.replace('%', ''));
                    const compGrowth = parseFloat(comp.growth.replace('%', ''));
                    return compGrowth > maxGrowth ? comp : max;
                  }).name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Follower growth
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* New Follower Metrics Section */}
        <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50 to-green-100/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              👥 New Follower Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Competitor</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Followers</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">% Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCompetitors.map((competitor) => (
                    <tr key={competitor.rank} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">#{competitor.rank}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{competitor.name}</td>
                      <td className="py-3 px-4 text-gray-700">{competitor.followers}</td>
                      <td className={`py-3 px-4 font-semibold ${getChangeColor(competitor.growth.startsWith('+'))}`}>
                        {competitor.growth}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Total Post Metrics Section */}
        <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-purple-100/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              📝 Total Post Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Competitor</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Posts</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">% Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCompetitors.map((competitor) => (
                    <tr key={competitor.rank} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">#{competitor.rank}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{competitor.name}</td>
                      <td className="py-3 px-4 text-gray-700">{competitor.posts}</td>
                      <td className={`py-3 px-4 font-semibold ${getChangeColor(competitor.postGrowth.startsWith('+'))}`}>
                        {competitor.postGrowth}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Total Engagement Metrics Section */}
        <Card className="border-2 border-orange-100 bg-gradient-to-br from-orange-50 to-orange-100/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              📊 Total Engagement Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Competitor</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Engagement</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">% Growth</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCompetitors.map((competitor) => (
                    <tr key={competitor.rank} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">#{competitor.rank}</td>
                      <td className="py-3 px-4 font-medium text-gray-900">{competitor.name}</td>
                      <td className="py-3 px-4 text-gray-700">{competitor.engagement}</td>
                      <td className={`py-3 px-4 font-semibold ${getChangeColor(competitor.engagementGrowth.startsWith('+'))}`}>
                        {competitor.engagementGrowth}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Trending Competitor Posts Section */}
        <Card className="border-2 border-red-100 bg-gradient-to-br from-red-50 to-red-100/30">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              🔥 Trending Competitor Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentTrendingPosts.map((post, index) => (
                <div key={index} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1">{post.brand}</h4>
                      <p className="text-gray-600 text-sm">{post.text}</p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <span className="text-xs font-semibold text-[#ee2a7b] bg-[#ee2a7b]/10 px-2 py-1 rounded-full whitespace-nowrap">
                        {post.engagement} engagement
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Heart className="w-4 h-4 text-red-500" />
                      <span>{post.likes.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4 text-blue-500" />
                      <span>{post.comments.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Share2 className="w-4 h-4 text-green-500" />
                      <span>{post.shares.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
      
      {/* Blur Overlay */}
      <div className="blur-overlay">
        <div className="blur-overlay-text">🚀 Upcoming</div>
      </div>
    </div>
  );
} 