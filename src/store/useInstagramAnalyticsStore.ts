import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface InstagramAnalyticsStore {
  loadedKeys: string[];
  isLoaded: (key: string) => boolean;
  markLoaded: (key: string) => void;
  clearForUser: (userId: string) => void;
}

export const useInstagramAnalyticsStore = create<InstagramAnalyticsStore>()(
  persist(
    (set, get) => ({
      loadedKeys: [],

      isLoaded: (key: string) => {
        return get().loadedKeys.includes(key);
      },

      markLoaded: (key: string) => {
        set((state) => {
          if (state.loadedKeys.includes(key)) {
            return state; // Already loaded, don't mutate
          }
          const next = [...state.loadedKeys, key];
          return { loadedKeys: next };
        });
      },

      clearForUser: (userId: string) => {
        set((state) => {
          const next = state.loadedKeys.filter(
            (k) => !k.startsWith(`${userId}:`)
          );
          return { loadedKeys: next };
        });
      },
    }),
    {
      name: "instagram-analytics-loaded-keys", // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
    }
  )
);
