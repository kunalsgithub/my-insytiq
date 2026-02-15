// src/api/getFollowerJourney.ts
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export async function getFollowerJourneyData(username: string) {
  const callable = httpsCallable(functions, "getFollowerJourney");
  const response: any = await callable({ username });
  return response.data;
}
