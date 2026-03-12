import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

/**
 * Reserve one profile analysis usage for the current user.
 * Must be called on every Analyze click, before any cache logic.
 */
export async function reserveProfileAnalysisUsage(userId: string) {
  const callable = httpsCallable(functions, "reserveProfileAnalysisUsage");
  const payload: Record<string, unknown> = { userId };
  const res: any = await callable(payload);
  return res?.data ?? { success: true };
}

