import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useDevMode } from "@/hooks/useDevMode";
import { handleRedirectResult } from "@/services/firebaseService";
import { useToast } from "@/hooks/use-toast";
import Index from "@/pages/Index";
import NotFound from "./pages/NotFound";
import TopInfluencer from "@/pages/top-influencers";
import TopInfluencerCategory from "@/pages/TopInfluencerCategory";
import Subscription from "@/pages/subscription";
import InstagramAnalyticsPage from "@/pages/instagram-analytics";
import CompetitorIntelligencePage from "@/pages/competitor-intelligence";
import LoginPage from "@/pages/login";
import Privacy from "@/pages/privacy";
import TermsAndConditions from "@/pages/terms-and-conditions";
import Refund from "@/pages/refund";
import SidebarLayout from "@/components/ui/SidebarLayout";
import Trending from '@/pages/trending';
import TrendingNow from '@/pages/trending-now';
import SmartChat from '@/pages/smart-chat';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { toast } = useToast();
  const devMode = useDevMode();

  // Handle Google sign-in redirect result
  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const user = await handleRedirectResult();
        if (user) {
          toast({
            title: '✅ Welcome back!',
            description: `Successfully signed in as ${user.email}`,
          });
        }
      } catch (error) {
        console.error('Error handling redirect result:', error);
        toast({
          title: '❌ Sign-in Error',
          description: 'There was an issue with the sign-in process. Please try again.',
          variant: 'destructive',
        });
      }
    };

    handleRedirect();
  }, [toast]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {devMode && (
          <>
            <style>{`
              /* Disable all .blur-overlay containers and overlays in Dev Mode */
              .blur-overlay-container { filter: none !important; -webkit-filter: none !important; }
              .blur-overlay { display: none !important; }
            `}</style>
            <div style={{
              position: 'fixed',
              bottom: '12px',
              right: '12px',
              zIndex: 9999,
              background: 'rgba(17, 24, 39, 0.9)',
              color: 'white',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
            }}>
              🧑‍💻 Developer Mode Active
            </div>
          </>
        )}
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route element={<SidebarLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/instagram-analytics" element={<InstagramAnalyticsPage />} />
              <Route path="/analytics/competitor-intelligence" element={<CompetitorIntelligencePage />} />
              <Route path="/top-influencers" element={<TopInfluencer />} />
              <Route path="/top-influencers/:category" element={<TopInfluencerCategory />} />
              <Route path="/subscription" element={<Subscription />} />
              {/* Smart Chat: always use the v2 implementation on /smart-chat */}
              <Route path="/smart-chat" element={<SmartChat useV2 />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
              <Route path="/refund" element={<Refund />} />
              <Route path="/trending" element={<Trending />} />
              <Route path="/trending-now" element={<TrendingNow />} />
              {/* Growth AI routes temporarily disabled for MVP – redirect to subscriptions */}
              <Route path="/growth-ai/follower-journey-map" element={<Navigate to="/subscription" replace />} />
              <Route path="/growth-ai/brand-collab-readiness-score" element={<Navigate to="/subscription" replace />} />
              <Route path="/growth-ai/engagement-funnel-breakdown" element={<Navigate to="/subscription" replace />} />
              <Route path="/growth-ai/hashtag-saturation-meter" element={<Navigate to="/subscription" replace />} />
              <Route path="/growth-ai/ai-powered-daily-growth-tips" element={<Navigate to="/subscription" replace />} />
              <Route path="/growth-ai/competitor-content-heatmap" element={<Navigate to="/subscription" replace />} />
            </Route>
            <Route path="/auth" element={<LoginPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
