import { setGlobalOptions } from "firebase-functions";
import { fetchAndStoreInstagramData } from "./fetchAndStoreInstagramData";
import { followerJourney } from "./followerJourney";
import { getSocialBladeAnalytics } from "./getSocialBladeAnalytics";
import { smartChat } from "./smartChat";
import { smartChatV2 } from "./smartChat_v2";
import { addCompetitor, updateCompetitorAnalytics, getFollowerHistory } from "./competitorIntelligence";
import { getBrandCollabScore } from "./getBrandCollabScore";
import { subscriptionWebhook } from "./subscriptionWebhook";
import { onAuthUserCreated } from "./onAuthUserCreated";
import { reserveProfileAnalysisUsage } from "./reserveProfileAnalysisUsage";
import { signupWithIpLimit } from "./signupWithIpLimit";
import { proxyProfileImage } from "./proxyProfileImage";
import {
  syncTrendingDaily,
  syncTrendingNow,
  ensureTrendingPopulated,
} from "./syncTrendingFromApify";
import { trackAffiliateClick } from "./affiliateTracking";
import { attributeAffiliateSignup } from "./attributeAffiliateSignup";
import { evaluateCreatorAccess, clearPendingEarnings } from "./creatorEvaluation";
import {
  approveCreator,
  rejectCreator,
  markPayoutPaid,
  submitCreatorPayout,
} from "./creatorAdmin";

setGlobalOptions({ maxInstances: 10 });

export {
  fetchAndStoreInstagramData,
  followerJourney,
  getSocialBladeAnalytics,
  smartChat,
  smartChatV2,
  addCompetitor,
  updateCompetitorAnalytics,
  getFollowerHistory,
  getBrandCollabScore,
  subscriptionWebhook,
  onAuthUserCreated,
  reserveProfileAnalysisUsage,
  signupWithIpLimit,
  proxyProfileImage,
  syncTrendingDaily,
  syncTrendingNow,
  ensureTrendingPopulated,
  trackAffiliateClick,
  attributeAffiliateSignup,
  evaluateCreatorAccess,
  clearPendingEarnings,
  approveCreator,
  rejectCreator,
  markPayoutPaid,
  submitCreatorPayout,
};
