import { useEffect, useState } from "react";
import { getCurrentUser, onAuthStateChangedListener } from "@/services/firebaseService";
import { getLastAnalyzedUsername } from "@/utils/firestoreUsernames";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface GrowthAIDashboardProps {
  children: React.ReactNode;
}
import { BrandCollabScoreCard } from "@/components/BrandCollabScoreCard";

export default function GrowthAIDashboard({ children }: GrowthAIDashboardProps) {
  const [username, setUsername] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((user) => {
      if (user) {
        setUserId(user.uid);
        fetchUsername(user.uid);
      } else {
        setUserId(null);
        setUsername(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchUsername = async (uid: string) => {
    try {
      setLoading(true);
      const fetchedUsername = await getLastAnalyzedUsername(uid);
      setUsername(fetchedUsername);
      setShowPrompt(!fetchedUsername);
    } catch (error) {
      console.error("Error fetching username:", error);
      setUsername(null);
      setShowPrompt(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToAnalytics = () => {
    setShowPrompt(false);
    navigate("/instagram-analytics");
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // If user is not authenticated, show a message
  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please log in to access Growth AI features.
          </p>
          <a
            href="/auth"
            className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Show Dialog if no username */}
      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <DialogContent className="text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">👋 Add Instagram Username</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            To view insights, please first enter your Instagram username in the Analytics section.
          </p>
          <Button 
            onClick={handleGoToAnalytics}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Go to Analytics
          </Button>
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Once you analyze a profile, you'll unlock powerful AI-driven growth insights
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Show Growth AI components if username exists */}
      {username && (
        <div className="space-y-6">
          {children}
        </div>
      )}
    </div>
  );
} 