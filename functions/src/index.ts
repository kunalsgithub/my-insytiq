import { setGlobalOptions } from "firebase-functions";
import { fetchAndStoreInstagramData } from "./fetchAndStoreInstagramData";
import { followerJourney } from "./followerJourney";
import { getSocialBladeAnalytics } from "./getSocialBladeAnalytics";
import { smartChat } from "./smartChat";
import { smartChatV2 } from "./smartChat_v2";
import { addCompetitor, updateCompetitorAnalytics } from "./competitorIntelligence";
import { sendCustomPasswordReset } from "./sendPasswordResetEmail";

setGlobalOptions({ maxInstances: 10 });

export {
  fetchAndStoreInstagramData,
  followerJourney,
  getSocialBladeAnalytics,
  smartChat,
  smartChatV2,
  addCompetitor,
  updateCompetitorAnalytics,
  sendCustomPasswordReset,
};
