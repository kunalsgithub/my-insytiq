import { useQuery } from '@tanstack/react-query';
import { fetchAudioFromSheet } from '@/utils/googleSheetsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface TrendingAudioProps {
  selectedCategory: string;
}

const TrendingAudio = ({ selectedCategory }: TrendingAudioProps) => {
  const { toast } = useToast();
  const { data: audioClips, isLoading, error } = useQuery({
    queryKey: ['trending-audio', selectedCategory],
    queryFn: () => fetchAudioFromSheet(),
  });

  console.log('Trending Audio - Selected Category:', selectedCategory);
  console.log('Trending Audio - Data:', audioClips);
  console.log('Trending Audio - Loading:', isLoading);
  console.log('Trending Audio - Error:', error);

  // Filter the audio clips based on selected category if available
  const filteredAudioClips = audioClips ? audioClips.filter((clip) => {
    // If category is "all" or clip has the selected category in its categories array
    return selectedCategory === "all" || 
           (clip.categories && clip.categories.includes(selectedCategory));
  }) : [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Trending Audio
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[120px]" />
                  <Skeleton className="h-3 w-[80px]" />
                </div>
                <Skeleton className="h-4 w-[60px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    console.error('Error fetching audio:', error);
    toast({
      title: "Error loading audio data",
      description: "There was a problem fetching trending audio",
      variant: "destructive",
    });
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Trending Audio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Failed to load audio clips.</div>
        </CardContent>
      </Card>
    );
  }

  if (!filteredAudioClips || filteredAudioClips.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Trending Audio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No audio clips found for this category.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Trending Audio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredAudioClips.slice(0, 5).map((audio) => (
            <div
              key={audio.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group"
            >
              <div className="flex flex-col">
                <span className="font-medium truncate max-w-[170px]">{audio.title}</span>
                <span className="text-sm text-muted-foreground">
                  {audio.artist}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  {typeof audio.usage === 'number' 
                    ? audio.usage.toLocaleString() 
                    : audio.usage} uses
                </div>
                {audio.mediaUrl && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => window.open(audio.mediaUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrendingAudio;
