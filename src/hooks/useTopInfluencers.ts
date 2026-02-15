import { useEffect, useState } from "react";
import Papa from "papaparse";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1PJ4DTnYDBFBWdaEKT2uhIBo-OlNThjFCf0c6tzngXZY/gviz/tq?tqx=out:csv&sheet=Top%20Influencers";
const LS_KEY = "whoistrend_influencers_data_v1";
const LS_TTL = 1000 * 60 * 60; // 1 hour

// Global cache for all categories
const allCategoryCache = {
  data: null as null | any[],
  promise: null as null | Promise<any[]>,
};

function getCategoryData(category: string, allData: any[]) {
  return allData.filter(
    (row: any) =>
      row.Category &&
      row.Category.trim().toLowerCase() === category.trim().toLowerCase()
  );
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.data || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > LS_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function saveToLocalStorage(data: any[]) {
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {}
}

export function useTopInfluencers(category: string) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!category) {
      setData([]);
      return;
    }
    setLoading(true);

    // Try localStorage first
    if (!allCategoryCache.data) {
      const lsData = loadFromLocalStorage();
      if (lsData) {
        allCategoryCache.data = lsData;
      }
    }

    // If already cached, use it instantly
    if (allCategoryCache.data) {
      setData(getCategoryData(category, allCategoryCache.data));
      setLoading(false);
      return;
    }

    // If a fetch is already in progress, wait for it
    if (allCategoryCache.promise) {
      allCategoryCache.promise.then((allData) => {
        setData(getCategoryData(category, allData));
        setLoading(false);
      });
      return;
    }

    // Otherwise, fetch and parse the sheet
    allCategoryCache.promise = fetch(SHEET_URL)
      .then((res) => res.text())
      .then((csv) => {
        return new Promise<any[]>((resolve) => {
          Papa.parse(csv, {
            header: true,
            complete: (results) => {
              allCategoryCache.data = results.data;
              saveToLocalStorage(results.data);
              resolve(results.data);
            },
            error: () => {
              allCategoryCache.data = [];
              saveToLocalStorage([]);
              resolve([]);
            },
          });
        });
      });

    allCategoryCache.promise.then((allData) => {
      setData(getCategoryData(category, allData));
      setLoading(false);
    });
  }, [category]);

  return { data, loading };
} 