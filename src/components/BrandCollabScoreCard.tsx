import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, getCurrentUser } from "@/services/firebaseService";
import { getLastAnalyzedUsername } from "@/utils/firestoreUsernames";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

type ScoreData = {
  score: number;
  engagementConsistency: string;
  followerQuality: string;
  postFrequency: number;
  nicheKeywords: string[];
  recommendations: string[];
  lastUpdated: string;
};

export function BrandCollabScoreCard() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchScore() {
      try {
        setLoading(true);
        setError(null);

        // Get current user
        const currentUser = getCurrentUser();
        if (!currentUser) {
          setError("Please sign in to view your brand collab score.");
          setLoading(false);
          return;
        }

        const userId = currentUser.uid;

        // Get the last analyzed username
        const username = await getLastAnalyzedUsername(userId);
        if (!username) {
          setError("No analyzed username found. Please analyze an Instagram profile first.");
          setLoading(false);
          return;
        }

        // Fetch the brand collab score data
        const docRef = doc(db, "users", userId, "growthAI", username, "brandCollabReadinessScore");
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const data = snapshot.data() as ScoreData;
          setScoreData(data);
        } else {
          setError("No brand collab score found for this username. Please run analysis via Instagram Analytics.");
        }
      } catch (error) {
        console.error("Error fetching brand collab score:", error);
        setError("Failed to load brand collab score. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchScore();
  }, []);

  if (loading) {
    return (
      <Card className="w-full max-w-3xl mx-auto mt-6">
        <CardHeader>
          <CardTitle>Brand Collab Readiness Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading your brand collab score...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-3xl mx-auto mt-6">
        <CardHeader>
          <CardTitle>Brand Collab Readiness Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-8">
            <div className="text-red-500 mb-2">⚠️</div>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!scoreData) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        No score found. Make sure you’ve run analysis via Instagram Analytics.
      </div>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Brand Collab Readiness Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center">
          <div className="text-4xl font-bold">
            {scoreData.score ? `${scoreData.score}/100` : "N/A"}
          </div>
          <div className="text-sm text-muted-foreground">
            {scoreData.score ? "Overall Readiness" : "Score not available"}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <ScoreItem 
            label="Engagement Consistency" 
            value={scoreData.engagementConsistency || "Not enough data"} 
            percent={25} 
          />
          <ScoreItem 
            label="Follower Quality" 
            value={scoreData.followerQuality || "Not enough data"} 
            percent={20} 
          />
          <ScoreItem 
            label="Post Frequency" 
            value={scoreData.postFrequency ? `${scoreData.postFrequency}x / week` : "Not enough data"} 
            percent={15} 
          />
          <ScoreItem 
            label="Niche Clarity" 
            value={scoreData.nicheKeywords && scoreData.nicheKeywords.length > 0 
              ? scoreData.nicheKeywords.join(", ") 
              : "Not enough data"} 
            percent={15} 
          />
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium mb-2">Recommended Next Steps</h3>
          {scoreData.recommendations && scoreData.recommendations.length > 0 ? (
            <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
              {scoreData.recommendations.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No recommendations available yet. Complete more analysis to get personalized tips.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreItem({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div>
      <div className="text-xs font-medium mb-1">{label}</div>
      <Progress value={percent} className="h-2 mb-1" />
      <div className="text-xs text-muted-foreground">{value}</div>
    </div>
  );
}
