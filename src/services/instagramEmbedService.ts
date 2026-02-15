/**
 * Service for handling Instagram embed functionality
 * Uses Instagram Graph API to properly display Instagram content
 */

interface InstagramEmbedResponse {
  html: string;
  width: number;
  height: number;
  provider_name: string;
  provider_url: string;
  type: string;
  version: string;
}

interface InstagramErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  }
}

// Instagram API credentials
const APP_ID = '1421891378980951';
const APP_SECRET = '654159162f072af938685d1cf95acb6d';
const ACCESS_TOKEN = `${APP_ID}|${APP_SECRET}`;

// Cache for API responses (to reduce API calls)
interface CacheItem {
  data: string;
  timestamp: number;
}
const apiCache: Record<string, CacheItem> = {};
const CACHE_DURATION = 3600 * 1000; // 1 hour cache

/**
 * Get Instagram embed HTML with multiple fallback methods
 */
export const getInstagramEmbed = async (url: string): Promise<string> => {
  try {
    // Check cache first
    const cacheKey = `embed_${url}`;
    const cachedResponse = apiCache[cacheKey];
    const currentTime = Date.now();
    
    if (cachedResponse && currentTime - cachedResponse.timestamp < CACHE_DURATION) {
      console.log("Using cached Instagram embed response");
      return cachedResponse.data;
    }

    // Make sure URL is properly encoded
    const encodedUrl = encodeURIComponent(url);
    
    console.log("Fetching Instagram embed for URL:", url);
    console.log("Using access token:", ACCESS_TOKEN.substring(0, 15) + "...");
    
    // First fallback: Try the public oEmbed API which doesn't require auth
    // but has stricter limits
    try {
      const publicResponse = await fetch(
        `https://api.instagram.com/oembed/?url=${encodedUrl}&omitscript=true`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (publicResponse.ok) {
        console.log("Public oEmbed API successful");
        const data: InstagramEmbedResponse = await publicResponse.json();
        
        // Cache the response
        apiCache[cacheKey] = {
          data: data.html,
          timestamp: currentTime
        };
        
        return data.html;
      }
      console.log("Public oEmbed API failed, trying authenticated approach");
    } catch (publicError) {
      console.log("Public oEmbed API error:", publicError);
      // Continue to authenticated approach
    }
    
    // Use Instagram's authenticated oEmbed API endpoint
    const response = await fetch(
      `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodedUrl}&access_token=${ACCESS_TOKEN}&omitscript=true`
    );
    
    // Parse response as text first to examine it
    const responseText = await response.text();
    console.log("Instagram API response:", responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''));
    
    // Try to parse as JSON
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse API response as JSON");
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
    }
    
    // Check for error in the response
    if (!response.ok || (jsonResponse && jsonResponse.error)) {
      console.error("Instagram API error response:", jsonResponse);
      
      const errorCode = jsonResponse?.error?.code;
      const errorMessage = jsonResponse?.error?.message;
      
      console.log(`Instagram API error ${errorCode}: ${errorMessage}`);
      
      // If token issue, log specific error
      if (errorCode === 190) {
        console.error("The Instagram access token appears to be invalid or expired");
      }
      
      // Fall back to iframe approach
      console.log("Authentication error, using fallback iframe approach");
      return createInstagramIframe(url, getContentTypeFromUrl(url));
    }
    
    // If we got here, we have a successful response with no error
    const data: InstagramEmbedResponse = jsonResponse;
    console.log("Instagram embed response received:", data.provider_name);
    
    // Cache the response
    apiCache[cacheKey] = {
      data: data.html,
      timestamp: currentTime
    };
    
    return data.html;
  } catch (error) {
    console.error("Error fetching Instagram embed:", error);
    // Return fallback iframe on any error
    return createInstagramIframe(url, getContentTypeFromUrl(url));
  }
};

/**
 * Gets basic media information using the Graph API
 */
export const getInstagramMediaInfo = async (postId: string) => {
  try {
    // Check cache first
    const cacheKey = `media_${postId}`;
    const cachedResponse = apiCache[cacheKey];
    const currentTime = Date.now();
    
    if (cachedResponse && currentTime - cachedResponse.timestamp < CACHE_DURATION) {
      console.log("Using cached Instagram media info");
      return JSON.parse(cachedResponse.data);
    }

    console.log("Fetching Instagram media info for postId:", postId);
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${postId}?fields=id,media_type,media_url,permalink,thumbnail_url&access_token=${ACCESS_TOKEN}`
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Instagram Graph API error: ${response.status}`, errorText);
      throw new Error(`Failed to fetch Instagram media: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log("Instagram media data received:", data.id);
    
    // Cache the response
    apiCache[cacheKey] = {
      data: JSON.stringify(data),
      timestamp: currentTime
    };
    
    return data;
  } catch (error) {
    console.error("Error fetching Instagram media:", error);
    return null;
  }
};

/**
 * Determines content type from Instagram URL
 */
export const getContentTypeFromUrl = (url: string): "post" | "reel" | "audio" => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
    
    if (pathParts[0] === 'reel' || pathParts[0] === 'reels') {
      return "reel";
    } else if (pathParts[0] === 'tv') {
      return "audio";
    } else {
      return "post";
    }
  } catch (e) {
    // Default to post if we can't determine the type
    return "post";
  }
};

/**
 * Extract the Instagram post ID from a URL
 */
export const extractInstagramId = (url: string): string | null => {
  try {
    // Handle different Instagram URL formats
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
    
    // For standard posts (/p/{shortcode})
    if (pathParts[0] === 'p' && pathParts[1]) {
      return pathParts[1];
    }
    
    // For reels (/reel/{shortcode})
    if (pathParts[0] === 'reel' && pathParts[1]) {
      return pathParts[1];
    }
    
    // For IGTV
    if (pathParts[0] === 'tv' && pathParts[1]) {
      return pathParts[1];
    }
    
    return null;
  } catch (e) {
    console.error("Error extracting Instagram ID:", e);
    return null;
  }
};

/**
 * Creates an iframe to display Instagram content
 * This is a fallback approach when the oEmbed API is not available
 */
export const createInstagramIframe = (url: string, type: "post" | "reel" | "audio"): string => {
  try {
    // Extract the post/reel ID from the URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
    let id = pathParts[1]; // The ID is usually the second part after /reel/ or /p/
    
    // Handle special cases
    if (pathParts[0] === 'reel' || pathParts[0] === 'reels') {
      id = pathParts[1] || ''; // Get ID from /reel/{id} or /reels/{id}
    } else if (pathParts[0] === 'tv' && pathParts[1]) {
      id = pathParts[1]; // Get ID from /tv/{id}
    } else if (pathParts[0] === 'p' && pathParts[1]) {
      id = pathParts[1]; // Get ID from /p/{id} 
    }
    
    if (!id) {
      console.error("Could not extract post ID from URL:", url);
      return createFallbackEmbed(url);
    }
    
    // Instagram embed URL format
    const embedUrl = `https://www.instagram.com/${type === 'reel' ? 'reel' : 'p'}/${id}/embed`;
    
    console.log("Created fallback iframe with URL:", embedUrl);
    
    return `<iframe 
      src="${embedUrl}" 
      width="100%" 
      height="100%" 
      frameborder="0" 
      scrolling="no" 
      allowtransparency="true" 
      style="border: 1px solid #dbdbdb; border-radius: 4px; background: white; max-width: 1080px; aspect-ratio: 9/16; margin: 0 auto; display: block;"
      allow="encrypted-media; autoplay">
    </iframe>
    <script async defer src="//platform.instagram.com/en_US/embeds.js"></script>`;
  } catch (e) {
    console.error("Error creating Instagram iframe:", e);
    return createFallbackEmbed(url);
  }
};

/**
 * Create an absolute fallback when all other options fail
 */
const createFallbackEmbed = (url: string): string => {
  return `<div class="flex flex-col items-center justify-center w-full h-full p-6 bg-gray-100 rounded-lg border-2 border-gray-200">
    <div class="text-gray-500 mb-3">⚠️ Could not load Instagram content</div>
    <div class="mb-4 text-sm text-gray-400">Instagram API access may be restricted</div>
    <a href="${url}" target="_blank" rel="noopener noreferrer" 
       class="bg-insta-primary text-white px-4 py-2 rounded-md hover:bg-insta-primary/90 transition-colors">
       View on Instagram
    </a>
  </div>`;
};

/**
 * Safely injects Instagram embed HTML into a DOM element
 */
export const injectInstagramEmbed = (
  containerElement: HTMLElement | null, 
  instagramUrl: string,
  type: "post" | "reel" | "audio"
): void => {
  if (!containerElement) {
    console.error("No container element provided for Instagram embed");
    return;
  }
  
  // Add a loading state
  containerElement.innerHTML = '<div class="flex items-center justify-center w-full h-full p-10"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-insta-primary"></div><div class="ml-3 text-sm text-gray-500">Loading Instagram content...</div></div>';
  
  console.log("Injecting Instagram embed for URL:", instagramUrl);
  
  // Try to use the oEmbed API first
  getInstagramEmbed(instagramUrl)
    .then(html => {
      if (html) {
        containerElement.innerHTML = html;
        
        // Load Instagram embed script
        if (window.instgrm) {
          window.instgrm.Embeds.process();
        } else {
          const script = document.createElement('script');
          script.src = '//www.instagram.com/embed.js';
          script.async = true;
          script.defer = true;
          document.body.appendChild(script);
        }
        
        // Add debug information
        console.log("Instagram embed injected successfully");
      } else {
        // Fallback to iframe if oEmbed failed
        console.log("No HTML content returned from oEmbed, using iframe fallback");
        containerElement.innerHTML = createInstagramIframe(instagramUrl, type);
      }
    })
    .catch(error => {
      console.error("Error injecting Instagram embed:", error);
      containerElement.innerHTML = createFallbackEmbed(instagramUrl);
    });
};

// Add a type declaration for the Instagram embed script
declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}

export async function fetchInstagramEmbedHtml(instagramUrl: string): Promise<{ html: string; thumbnail_url?: string }> {
  const response = await fetch(`/api/instagram-embed?url=${encodeURIComponent(instagramUrl)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch Instagram embed');
  }
  return response.json();
}
