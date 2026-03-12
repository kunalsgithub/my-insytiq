/**
 * Default usage shape for new users only.
 * MUST match backend planLimits.ts / usageEnforcement.ts.
 * Used only on signup; all enforcement is server-side.
 */

function firstDayOfNextMonthISO(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

const FREE_PROFILE_ANALYSIS = 2;
const FREE_SMART_CHAT = 150;

export type DefaultUsage = {
  profileAnalysis: { monthlyUsed: number; monthlyLimit: number; resetDate: string };
  brandCollabScore: {
    lifetimeUsed: number;
    monthlyUsed: number;
    monthlyLimit: number;
    resetDate: string;
  };
  smartChat: { monthlyUsed: number; monthlyLimit: number; resetDate: string };
};

/** Default usage for new user. Never allow usage to be undefined on user doc. */
export function getDefaultUsageForNewUser(): DefaultUsage {
  const resetDate = firstDayOfNextMonthISO();
  return {
    profileAnalysis: {
      monthlyUsed: 0,
      monthlyLimit: FREE_PROFILE_ANALYSIS,
      resetDate,
    },
    brandCollabScore: {
      lifetimeUsed: 0,
      monthlyUsed: 0,
      monthlyLimit: 0,
      resetDate,
    },
    smartChat: {
      monthlyUsed: 0,
      monthlyLimit: FREE_SMART_CHAT,
      resetDate,
    },
  };
}
