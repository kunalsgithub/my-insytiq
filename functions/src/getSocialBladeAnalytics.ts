import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Only initialize if not already initialized
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// Define secrets - these will be available at runtime via Firebase config
const sbClientId = defineSecret("SB_CLIENT_ID");
const sbApiToken = defineSecret("SB_API_TOKEN");

interface SocialBladeApiResponse {
  status: {
    success: boolean;
    status: number;
  };
  data: {
    statistics: {
      total: {
        followers: number;
        following: number;
        media: number;
        engagement_rate: number;
      };
    };
    general?: {
      branding?: {
        avatar?: string;
        website?: string;
      };
    };
    daily: Array<{
      date: string;
      followers: number;
      avg_likes: number;
      avg_comments: number;
    }>;
  };
  [key: string]: any;
}

export const getSocialBladeAnalytics = onCall(
  {
    secrets: [sbClientId, sbApiToken],
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (request) => {
    const { username } = request.data;

    if (!username || typeof username !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid username");
    }

    const cacheKey = `socialblade_${username}`;
    const cacheDoc = db.collection("socialblade_cache").doc(cacheKey);

    try {
      // Check cache first (24-hour TTL)
      const cached = await cacheDoc.get();
      if (cached.exists) {
        const cachedData = cached.data();
        const cachedAt = cachedData?.cachedAt?.toDate();
        if (cachedAt && cachedData?.data) {
          const now = new Date();
          const hoursSinceCache = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);

          if (hoursSinceCache < 24) {
            console.log(`Returning cached data for ${username} (${hoursSinceCache.toFixed(1)}h old)`);
            return {
              success: true,
              data: cachedData.data,
              cached: true,
            };
          }
        }
      }

      // Fetch from Social Blade Business API
      const clientId = sbClientId.value();
      const apiToken = sbApiToken.value();

      if (!apiToken) {
        throw new HttpsError("failed-precondition", "Missing SB_API_TOKEN secret");
      }

      // Social Blade Business API endpoint
      // According to docs: https://socialblade.com/developers/docs
      // Base URL: matrix.sbapis.com/b
      // Instagram endpoint format: /instagram/statistics?query=USERNAME
      // Authentication uses headers: "clientid" and "token" (lowercase)
      const url = `https://matrix.sbapis.com/b/instagram/statistics?query=${encodeURIComponent(username)}`;
      
      // Social Blade Business API requires these exact header names (lowercase)
      const headers: Record<string, string> = {
        "clientid": clientId || "",
        "token": apiToken,
        "Content-Type": "application/json",
      };

      console.log(`Fetching Social Blade data for ${username}`);
      console.log(`API URL: ${url}`);
      console.log(`Headers: clientid: ${clientId ? 'SET' : 'MISSING'}, token: ${apiToken ? 'SET' : 'MISSING'}`);
      
      let response;
      try {
        response = await axios.get<SocialBladeApiResponse>(url, {
          headers,
          timeout: 20000,
        });
      } catch (axiosError: any) {
        console.error("Social Blade API request failed:", {
          status: axiosError?.response?.status,
          statusText: axiosError?.response?.statusText,
          data: axiosError?.response?.data,
          message: axiosError?.message,
        });
        throw axiosError;
      }

      const apiData = response.data;

      // Check if API call was successful
      if (!apiData.status?.success || !apiData.data) {
        throw new HttpsError(
          "internal",
          `Social Blade API returned unsuccessful response: ${JSON.stringify(apiData.status)}`
        );
      }

      // Log API response structure for debugging
      console.log('Social Blade API response keys:', Object.keys(apiData.data || {}));
      const apiDataAny = apiData.data as any;
      if (apiDataAny?.projections || apiDataAny?.forecast || apiDataAny?.future) {
        console.log('Found projections/forecast in API response:', apiDataAny.projections || apiDataAny.forecast || apiDataAny.future);
      }

      const stats = apiData.data.statistics?.total || {};
      const dailyData = apiData.data.daily || [];
      
      // Log data for debugging
      console.log('Daily data sample:', dailyData.slice(0, 3), '...', dailyData.slice(-3));
      console.log('Current followers:', stats.followers);
      let profilePictureUrl = apiData.data.general?.branding?.avatar || null;

      // If Social Blade doesn't provide profile picture, try to fetch from Instagram's public API
      if (!profilePictureUrl) {
        try {
          // Try Instagram's public profile endpoint (may not always work due to rate limits)
          const instagramProfileUrl = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
          const profileResponse = await axios.get(instagramProfileUrl, {
            timeout: 5000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          }).catch(() => null);
          
          if (profileResponse?.data?.graphql?.user?.profile_pic_url_hd) {
            profilePictureUrl = profileResponse.data.graphql.user.profile_pic_url_hd;
          }
        } catch (error) {
          // Silently fail - profile picture is optional
          console.log(`Could not fetch profile picture for ${username}`);
        }
      }

      // Calculate average likes and comments from daily data
      const avgLikes = dailyData.length > 0
        ? dailyData.reduce((sum, day) => sum + (day.avg_likes || 0), 0) / dailyData.length
        : 0;
      const avgComments = dailyData.length > 0
        ? dailyData.reduce((sum, day) => sum + (day.avg_comments || 0), 0) / dailyData.length
        : 0;

      // Generate projections using Holt's Linear method (similar to Social Blade)
      // Project 5 years into the future (60 months)
      const projections: Array<{ date: string; followers: number }> = [];
      const currentFollowers = stats.followers || 0;
      
      console.log(`Generating projections. Daily data length: ${dailyData.length}, Current followers: ${currentFollowers}`);
      
      if (dailyData.length >= 7 && currentFollowers > 0) {
        // Holt's Linear Exponential Smoothing
        // Uses level (L) and trend (T) components
        const alpha = 0.3; // Smoothing parameter for level (0-1)
        const beta = 0.15;  // Smoothing parameter for trend (0-1) - increased for more responsiveness
        
        // Use more data for better trend calculation - last 60 days if available
        const dataToUse = dailyData.length >= 60 ? dailyData.slice(-60) : dailyData;
        
        // Sort by date to ensure chronological order
        const sortedData = [...dataToUse].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        // Initialize level with the most recent value (current followers)
        let level = currentFollowers;
        let trend = 0;
        
        // Calculate initial trend from recent data (last 7-14 days for better accuracy)
        const trendWindow = Math.min(14, Math.floor(sortedData.length / 2));
        if (sortedData.length >= 7) {
          const firstValue = sortedData[sortedData.length - trendWindow]?.followers || sortedData[0]?.followers || currentFollowers;
          const lastValue = sortedData[sortedData.length - 1]?.followers || currentFollowers;
          const daysDiff = trendWindow;
          trend = (lastValue - firstValue) / daysDiff; // Average daily growth
        }
        
        // Apply Holt's method to smooth the data and get final level/trend
        // Start from the beginning of the data window
        for (let i = 1; i < sortedData.length; i++) {
          const prevLevel = level;
          const currentValue = sortedData[i].followers || 0;
          
          // Update level: L_t = α * Y_t + (1 - α) * (L_{t-1} + T_{t-1})
          level = alpha * currentValue + (1 - alpha) * (prevLevel + trend);
          
          // Update trend: T_t = β * (L_t - L_{t-1}) + (1 - β) * T_{t-1}
          trend = beta * (level - prevLevel) + (1 - beta) * trend;
        }
        
        // Calculate growth rate from the final trend
        // Convert daily trend to monthly growth rate
        const avgDailyGrowth = trend;
        const monthlyGrowth = avgDailyGrowth * 30.44; // Average days per month
        const annualGrowthRate = (monthlyGrowth * 12) / Math.max(currentFollowers, 1);
        
        // Cap growth rate to reasonable bounds (-5% to 100% annually)
        // More permissive upper bound to match Social Blade's projections
        let cappedAnnualRate = Math.max(-0.05, Math.min(1.0, annualGrowthRate));
        
        // If growth rate is very small or negative, use a minimum growth assumption
        // Social Blade typically shows some growth even for slow-growing accounts
        if (cappedAnnualRate < 0.01 && cappedAnnualRate > -0.01) {
          // Use a minimum of 2% annual growth if trend is essentially flat
          cappedAnnualRate = 0.02;
          console.log('Trend is essentially flat, using minimum 2% annual growth');
        }
        
        const monthlyGrowthRate = cappedAnnualRate / 12;
        
        console.log(`Holt's method - Current: ${currentFollowers}, Level: ${level.toFixed(0)}, Trend: ${trend.toFixed(2)}/day, Monthly rate: ${(monthlyGrowthRate * 100).toFixed(2)}%, Annual rate: ${(cappedAnnualRate * 100).toFixed(2)}%`);
        console.log(`Projection preview - Month 1: ${Math.round(currentFollowers * (1 + monthlyGrowthRate))}, Month 12: ${Math.round(currentFollowers * Math.pow(1 + monthlyGrowthRate, 12))}, Month 60: ${Math.round(currentFollowers * Math.pow(1 + monthlyGrowthRate, 60))}`);

        // Generate monthly projections for 5 years (60 months)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let month = 1; month <= 60; month++) {
          const projectionDate = new Date(today);
          projectionDate.setMonth(today.getMonth() + month);
          projectionDate.setDate(1); // Set to first day of month
          projectionDate.setHours(0, 0, 0, 0);
          
          // Use compound growth starting from CURRENT followers, not smoothed level
          // F(t+h) = F(t) * (1 + r)^h
          // Where F(t) is current followers, r is monthly growth rate, h is months ahead
          const projectedFollowers = Math.max(
            0,
            Math.round(currentFollowers * Math.pow(1 + monthlyGrowthRate, month))
          );
          
          const dateStr = projectionDate.toISOString().split('T')[0];
          projections.push({
            date: dateStr,
            followers: projectedFollowers,
          });
        }
        console.log(`Generated ${projections.length} projections. First: ${projections[0]?.followers}, Last: ${projections[projections.length - 1]?.followers}`);
      } else if (currentFollowers > 0 && dailyData.length > 0) {
        // Fallback: Calculate growth from available data points
        console.log(`Using fallback projection method with ${currentFollowers} followers and ${dailyData.length} data points`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Calculate average growth from available data
        const sortedData = [...dailyData].sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        
        let monthlyGrowthRate = 0.005; // Default 0.5% per month
        
        if (sortedData.length >= 2) {
          const firstValue = sortedData[0].followers || currentFollowers;
          const lastValue = sortedData[sortedData.length - 1].followers || currentFollowers;
          const daysDiff = Math.max(1, sortedData.length - 1);
          const dailyGrowth = (lastValue - firstValue) / daysDiff;
          const monthlyGrowth = dailyGrowth * 30.44;
          const annualRate = (monthlyGrowth * 12) / Math.max(currentFollowers, 1);
          monthlyGrowthRate = Math.max(0, Math.min(0.05, annualRate / 12)); // Cap at 5% monthly
        }
        
        for (let month = 1; month <= 60; month++) {
          const projectionDate = new Date(today);
          projectionDate.setMonth(today.getMonth() + month);
          projectionDate.setDate(1);
          projectionDate.setHours(0, 0, 0, 0);
          
          const projectedFollowers = Math.max(
            0,
            Math.round(currentFollowers * Math.pow(1 + monthlyGrowthRate, month))
          );
          
          const dateStr = projectionDate.toISOString().split('T')[0];
          projections.push({
            date: dateStr,
            followers: projectedFollowers,
          });
        }
        console.log(`Generated ${projections.length} projections using fallback. Growth rate: ${(monthlyGrowthRate * 100).toFixed(2)}%/month`);
      } else {
        console.log('No projections generated - no follower data available');
      }
      
      console.log(`Final projections array length: ${projections.length}`);

      // Extract and transform the data to match our UI structure
      const extractedData = {
        followers: stats.followers || 0,
        following: stats.following || 0,
        media: stats.media || 0,
        averageLikes: Math.round(avgLikes),
        averageComments: Math.round(avgComments),
        engagementRate: stats.engagement_rate ? parseFloat((stats.engagement_rate * 100).toFixed(2)) : 0,
        dailyHistory: dailyData
          .filter((day) => {
            if (!day.date) return false;
            const date = new Date(day.date);
            return !isNaN(date.getTime()) && day.followers !== undefined && day.followers !== null;
          })
          .map((day) => {
            // Ensure date is in YYYY-MM-DD format
            const dateStr = typeof day.date === 'string' 
              ? day.date 
              : new Date(day.date).toISOString().split('T')[0];
            return {
              date: dateStr,
              followers: Number(day.followers) || 0,
            };
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), // Sort chronologically
        projections: projections,
        profilePictureUrl: profilePictureUrl,
      };
      
      console.log(`Returning extractedData with ${extractedData.projections.length} projections`);

      // Cache the result
      await cacheDoc.set({
        data: extractedData,
        cachedAt: Timestamp.now(),
        username,
      });

      return {
        success: true,
        data: extractedData,
        cached: false,
      };
    } catch (error: any) {
      console.error("Social Blade API error:", error?.response?.data || error?.message || error);

      // If we have cached data, return it even if expired
      const cached = await cacheDoc.get();
      if (cached.exists) {
        const cachedData = cached.data();
        if (cachedData?.data) {
          console.log(`Returning expired cache for ${username} due to API error`);
          return {
            success: true,
            data: cachedData.data,
            cached: true,
            warning: "Using cached data due to API error",
          };
        }
      }

      throw new HttpsError(
        "internal",
        `Failed to fetch Social Blade data: ${error?.response?.data?.message || error?.message || "Unknown error"}`
      );
    }
  }
);

