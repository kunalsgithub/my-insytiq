import { useState, useEffect } from "react";
import { Instagram, Music } from "lucide-react";
import { fetchTrendingContent } from "@/services/instagramService";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { hasAccess, PLAN } from "@/utils/accessControl";

const ReelsLogo = ({ className = "h-8 w-8" }) => (
  <img src="/reellogo.png" alt="Reels Logo" className={className} style={{ display: 'block' }} />
);

const InstagramLogo = ({ className = "h-8 w-8" }) => (
  <img src="/postlogo.png" alt="Instagram Logo" className={className} style={{ display: 'block' }} />
);

const AudioGradientDef = () => (
  <svg width="0" height="0">
    <defs>
      <linearGradient id="audio-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#f9ce34" />
        <stop offset="50%" stopColor="#ee2a7b" />
        <stop offset="100%" stopColor="#6228d7" />
      </linearGradient>
    </defs>
  </svg>
);

interface TrendingPost {
  id: number;
  title: string;
  creator: string;
  type?: "post" | "reel" | "audio";
  mediaUrl?: string;
  originalUrl?: string;
  thumbnailUrl?: string;
}

/** True if URL is likely a direct image (not an Instagram page or generic link). */
function isDirectImageUrl(url: string | undefined): boolean {
  if (!url || !url.startsWith("http")) return false;
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com/p/") || lower.includes("instagram.com/reel/")) return false;
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) || lower.includes("cdninstagram") || lower.includes("fbcdn.net");
}

interface TrendingContentProps {
  selectedCategory?: string;
  isPremium?: boolean;
  userPlan?: string;
}

const TrendingContent = ({ selectedCategory = "all", isPremium = false, userPlan = PLAN.FREE }: TrendingContentProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [displayedPosts, setDisplayedPosts] = useState<TrendingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("posts");

  // Determine content limit based on plan
  const contentLimit = hasAccess("trendingContentLimit", userPlan || PLAN.FREE) || 5;

  useEffect(() => {
    const getContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const content = await fetchTrendingContent(searchTerm, selectedCategory);
        if (!Array.isArray(content)) throw new Error("Invalid content data received");
        setDisplayedPosts(content);
      } catch (error) {
        setError("Could not fetch content data. Please check your Google Sheet format.");
      } finally {
        setIsLoading(false);
      }
    };
    getContent();
  }, [selectedCategory, searchTerm]);

  const posts = displayedPosts.filter(item => item.type === "post").slice(0, 10);
  const reels = displayedPosts.filter(item => item.type === "reel").slice(0, 10);
  const audio = displayedPosts.filter(item => item.type === "audio").slice(0, 10);

  const renderCarousel = (items: TrendingPost[], contentType: "post" | "reel" | "audio") => {
    if (isLoading) {
      return (
        <div className="flex overflow-x-auto gap-4 pb-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex-shrink-0">
              <Skeleton className="w-[200px] h-[300px] rounded-md" />
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-4">
          No trending {contentType} found.
        </p>
      );
    }

    // Always show 10 items, but lock after contentLimit for free users
    const visibleItems = items.slice(0, 10);
    const isLocked = (idx: number) => userPlan === PLAN.FREE && idx >= contentLimit;
    const showBlur = !isPremium && items.length > 5;

    return (
      <div className="w-full overflow-x-auto relative">
        <div className="flex flex-row gap-4 pb-4 snap-x snap-mandatory">
          {visibleItems.map((post, idx) => {
            let thumbClass = "";
            let cardWidth = "";
            if (post.type === "reel") {
              thumbClass = "aspect-[9/16] w-[85vw] max-w-xs sm:w-[180px] md:w-[216px] lg:w-[260px]";
              cardWidth = "w-[85vw] max-w-xs sm:w-[180px] md:w-[216px] lg:w-[260px]";
            } else if (post.type === "post") {
              thumbClass = "aspect-[4/5] w-[85vw] max-w-xs sm:w-[162px] md:w-[172px] lg:w-[210px]";
              cardWidth = "w-[85vw] max-w-xs sm:w-[162px] md:w-[172px] lg:w-[210px]";
            } else {
              thumbClass = "aspect-square w-[85vw] max-w-xs sm:w-[180px] md:w-[216px] lg:w-[260px]";
              cardWidth = "w-[85vw] max-w-xs sm:w-[180px] md:w-[216px] lg:w-[260px]";
            }
            const locked = isLocked(idx);
            return (
              <div key={post.id} className={`relative border-2 border-muted rounded-lg p-1 flex flex-col items-center bg-white flex-shrink-0 ${cardWidth} snap-start`}>
                <div className={`bg-gray-200 rounded-lg my-2 flex items-center justify-center overflow-hidden ${thumbClass} ${locked ? 'blur-lg pointer-events-none select-none' : ''}`}> 
                  {(() => {
                    const imageUrl = post.thumbnailUrl || (isDirectImageUrl(post.mediaUrl) ? post.mediaUrl : undefined);
                    if (imageUrl) {
                      return (
                        <img 
                          src={imageUrl} 
                          alt={post.title} 
                          className="object-cover w-full h-full" 
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector(".media-placeholder")) {
                              const placeholder = document.createElement("div");
                              placeholder.className = "media-placeholder w-full h-full bg-muted flex items-center justify-center";
                              placeholder.setAttribute("role", "img");
                              placeholder.setAttribute("aria-label", "Preview unavailable");
                              placeholder.innerHTML = '<span class="text-muted-foreground text-sm">Preview unavailable</span>';
                              parent.appendChild(placeholder);
                            }
                          }}
                        />
                      );
                    }
                    return (
                      <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-2 p-4">
                        <Instagram className="h-10 w-10 text-muted-foreground/60" />
                        <span className="text-muted-foreground text-xs text-center">Preview unavailable</span>
                      </div>
                    );
                  })()}
                </div>
                <div className={`w-full text-center ${locked ? 'blur-md pointer-events-none select-none' : ''}`}>
                  <div className="font-semibold text-sm truncate mb-1">{post.title || 'Untitled'}</div>
                  <div className="text-gray-500 text-xs mb-2">{post.creator || 'unknown'}</div>
                </div>
                <Button 
                  size="sm" 
                    className={`w-full text-xs ${locked ? 'pointer-events-none opacity-60' : ''}`} 
                  onClick={() => {
                    const url = post.originalUrl || post.mediaUrl;
                    if (url) window.open(url, '_blank');
                  }}
                    disabled={locked}
                >
                    View Content
                </Button>
                {locked && idx === contentLimit && (
                  <div className="absolute inset-0 flex items-center justify-center z-20">
                    <div className="p-[2px] rounded-full bg-gradient-to-r from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]">
                      <a href="/subscription"
                        className="rounded-full px-6 py-2 font-bold text-base shadow-lg bg-white bg-opacity-95 flex items-center justify-center whitespace-nowrap min-w-[180px]"
                        style={{
                          display: 'inline-block',
                          fontWeight: 700,
                          letterSpacing: '0.01em',
                          backgroundClip: 'padding-box',
                          minWidth: 'fit-content',
                          maxWidth: '90%',
                          
                        }}
                      >
                        <span style={{
                          background: 'linear-gradient(90deg, #f9ce34, #ee2a7b, #6228d7)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          color: 'transparent',
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          whiteSpace: 'nowrap',
                        }}>
                          Upgrade for Full Access
                        </span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <AudioGradientDef />
      <div className="pb-2">
        <div className="text-lg font-medium flex items-center justify-between">
          <div className="flex items-center">
            <InstagramLogo className="mr-2 h-5 w-5" />
            Trending Content {searchTerm && `for "${searchTerm}"`}
          </div>
        </div>
      </div>
      <Tabs defaultValue="posts" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="reels">Reels</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
        </TabsList>
        <TabsContent value="posts">
          {renderCarousel(posts, "post")}
        </TabsContent>
        <TabsContent value="reels">
          {renderCarousel(reels, "reel")}
        </TabsContent>
        <TabsContent value="audio">
          {renderCarousel(audio, "audio")}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrendingContent;
