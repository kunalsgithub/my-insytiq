import { toast } from "../components/ui/use-toast";

// Types for Social Blade specific metrics
export interface FollowerGrowth {
  date: string;
  count: number;
  change: number; // Daily change in followers
}

export interface FollowerProjections {
  thirtyDay: {
    projected: number;
    growth: number; // Percentage growth
  };
  sixtyDay: {
    projected: number;
    growth: number;
  };
  yearly: {
    projected: number;
    growth: number;
  };
}

export interface AccountRanking {
  global: {
    rank: number;
    percentile: number; // Top X% of all accounts
  };
  category: {
    rank: number;
    name: string;
    percentile: number;
  };
}

export interface DailyStats {
  date: string;
  followers: number;
  following: number;
  posts: number;
  engagement: number;
  avgLikes: number;
  avgComments: number;
}

export interface SocialBladeStats {
  username: string;
  currentFollowers: number;
  followerGrowth: FollowerGrowth[];
  projections: FollowerProjections;
  ranking: AccountRanking;
  historicalStats: DailyStats[];
  lastUpdated: string;
}

// Frame structure for the service
export class SocialBladeService {
  private static instance: SocialBladeService;
  private cache: Map<string, { data: SocialBladeStats; timestamp: number }>;
  private readonly CACHE_DURATION = 3600 * 1000; // 1 hour
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): SocialBladeService {
    if (!SocialBladeService.instance) {
      SocialBladeService.instance = new SocialBladeService();
    }
    return SocialBladeService.instance;
  }

  /**
   * Get live follower count
   */
  private async getLiveFollowerCount(username: string): Promise<number> {
    // TODO: Implement actual API call
    // For now, return mock data
    return Math.floor(Math.random() * 1000000) + 10000;
  }

  /**
   * Get follower growth data
   */
  private async getFollowerGrowth(username: string): Promise<FollowerGrowth[]> {
    // TODO: Implement actual API call
    const baseCount = Math.floor(Math.random() * 1000000) + 10000;
    const baseDate = new Date();
    
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      const count = baseCount - Math.floor(Math.random() * 1000 * i);
      const prevCount = i === 29 ? count : baseCount - Math.floor(Math.random() * 1000 * (i + 1));
      
      return {
        date: date.toISOString().split('T')[0],
        count,
        change: count - prevCount
      };
    }).reverse();
  }

  /**
   * Get follower projections
   */
  private async getProjections(currentFollowers: number): Promise<FollowerProjections> {
    // TODO: Implement actual API call
    return {
      thirtyDay: {
        projected: Math.floor(currentFollowers * 1.1),
        growth: 10
      },
      sixtyDay: {
        projected: Math.floor(currentFollowers * 1.2),
        growth: 20
      },
      yearly: {
        projected: Math.floor(currentFollowers * 1.5),
        growth: 50
      }
    };
  }

  /**
   * Get account ranking
   */
  private async getRanking(username: string): Promise<AccountRanking> {
    // TODO: Implement actual API call
    const globalRank = Math.floor(Math.random() * 1000000);
    const categoryRank = Math.floor(Math.random() * 10000);
    
    return {
      global: {
        rank: globalRank,
        percentile: (globalRank / 1000000) * 100
      },
      category: {
        rank: categoryRank,
        name: "Lifestyle",
        percentile: (categoryRank / 10000) * 100
      }
    };
  }

  /**
   * Get historical daily stats
   */
  private async getHistoricalStats(username: string): Promise<DailyStats[]> {
    // TODO: Implement actual API call
    const baseCount = Math.floor(Math.random() * 1000000) + 10000;
    const baseDate = new Date();
    
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      const followers = baseCount - Math.floor(Math.random() * 1000 * i);
      
      return {
        date: date.toISOString().split('T')[0],
        followers,
        following: Math.floor(Math.random() * 1000),
        posts: Math.floor(Math.random() * 100),
        engagement: Math.random() * 10,
        avgLikes: Math.floor(Math.random() * 1000),
        avgComments: Math.floor(Math.random() * 100)
      };
    }).reverse();
  }

  /**
   * Retry mechanism for API calls
   */
  private async retry<T>(fn: () => Promise<T>, retries = this.MAX_RETRIES): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
      return this.retry(fn, retries - 1);
    }
  }

  /**
   * Get complete stats for an Instagram account
   */
  public async getStats(username: string, forceRefresh = false): Promise<SocialBladeStats> {
    try {
      // Check cache unless force refresh
      if (!forceRefresh) {
        const cached = this.cache.get(username);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
          return cached.data;
        }
      }

      // Fetch all stats in parallel with retry mechanism
      const [currentFollowers, followerGrowth, ranking, historicalStats] = await Promise.all([
        this.retry(() => this.getLiveFollowerCount(username)),
        this.retry(() => this.getFollowerGrowth(username)),
        this.retry(() => this.getRanking(username)),
        this.retry(() => this.getHistoricalStats(username))
      ]);

      // Get projections based on current follower count
      const projections = await this.retry(() => this.getProjections(currentFollowers));

      const stats: SocialBladeStats = {
        username,
        currentFollowers,
        followerGrowth,
        projections,
        ranking,
        historicalStats,
        lastUpdated: new Date().toISOString()
      };

      // Cache the result
      this.cache.set(username, {
        data: stats,
        timestamp: Date.now()
      });

      return stats;
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Error fetching stats",
        description: error instanceof Error ? error.message : "Could not retrieve account statistics.",
        variant: "destructive"
      });
      throw error;
    }
  }

  /**
   * Clear the cache for a specific username or all cache
   */
  public clearCache(username?: string): void {
    if (username) {
      this.cache.delete(username);
    } else {
      this.cache.clear();
    }
  }
}

// Export a singleton instance
export const socialBladeService = SocialBladeService.getInstance();

// For backward compatibility
export const fetchSocialBladeStats = async (username: string): Promise<SocialBladeStats> => {
  return socialBladeService.getStats(username);
}; 