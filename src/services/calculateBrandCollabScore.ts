import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { analyzeBrandScoreFromApifyData } from "@/utils/analyzeLogic";

export async function calculateBrandCollabScore({
  userId,
  username,
  profileData,
  postData
}: {
  userId: string;
  username: string;
  profileData: any;
  postData: any[];
}) {
  const scoreResult = analyzeBrandScoreFromApifyData(profileData, postData);

  await setDoc(
    doc(db, "users", userId, "growthAI", username, "brandCollabReadinessScore"),
    {
      ...scoreResult,
      lastUpdated: new Date().toISOString()
    }
  );

  return scoreResult;
}
