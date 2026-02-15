import { useEffect, useState } from "react";
import Papa from "papaparse";

// Use the provided Google Sheet for Top Influencer data
const TOP_INFLUENCER_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1PJ4DTnYDBFBWdaEKT2uhIBo-OlNThjFCf0c6tzngXZY/gviz/tq?tqx=out:csv&sheet=Top%20Influencers";

// Cache for storing parsed data
const globalDataCache = new Map();
let isInitialLoad = true;

// Rename and update the helper to parse M/K for any number field
function parseNumberWithSuffix(value) {
  if (typeof value === 'string') {
    if (value.endsWith('M')) return Number(value.replace('M', '').replace(/,/g, '')) * 1_000_000;
    if (value.endsWith('K')) return Number(value.replace('K', '').replace(/,/g, '')) * 1_000;
    return Number(value.replace(/,/g, ''));
  }
  return Number(value);
}

function findField(row, fieldName) {
  // Find a key that matches the field name, ignoring case, spaces, and underscores
  const normalized = s => s.replace(/[\s_]/g, '').toLowerCase();
  const key = Object.keys(row).find(
    k => normalized(k) === normalized(fieldName)
  );
  return key ? row[key] : undefined;
}

// Preload all data once
async function preloadAllData() {
  if (globalDataCache.size > 0) return globalDataCache;
  
  try {
    const response = await fetch(TOP_INFLUENCER_SHEET_CSV_URL);
    const csv = await response.text();
    
    return new Promise((resolve) => {
      Papa.parse(csv, {
        header: true,
        complete: (results) => {
          // Process and cache all data by category
          const allData = results.data;
          const categories = new Set();
          
          allData.forEach((row: any) => {
            if (row.Category) {
              const category = row.Category.trim().toLowerCase();
              categories.add(category);
              
              if (!globalDataCache.has(category)) {
                globalDataCache.set(category, []);
              }
              
              const mapped = {
                ...row,
                Username: findField(row, "Username"),
                Name: findField(row, "Name"),
                Avatar: findField(row, "Avatar"),
                Followers: findField(row, "Followers"),
                Following: findField(row, "Following"),
                Posts: findField(row, "Posts"),
                ER: findField(row, "ER"),
                AverageLikes: findField(row, "AverageLikes"),
                AverageComments: findField(row, "AverageComments"),
                Category: findField(row, "Category"),
              };
              // Debug log
              if (category === 'travel') {
                console.log('Mapped influencer row:', JSON.stringify(mapped, null, 2));
              }
              globalDataCache.get(category).push(mapped);
            }
          });
          
          resolve(globalDataCache);
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          resolve(new Map());
        }
      });
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    return new Map();
  }
}

export function useInfluencers(category: string) {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!category) {
      setData([]);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      
      try {
        // Check if we have cached data
        if (globalDataCache.has(category.toLowerCase())) {
          setData(globalDataCache.get(category.toLowerCase()));
          setIsLoading(false);
          return;
        }

        // If this is the first load, preload all data
        if (isInitialLoad) {
          isInitialLoad = false;
          await preloadAllData();
          
          if (globalDataCache.has(category.toLowerCase())) {
            setData(globalDataCache.get(category.toLowerCase()));
            setIsLoading(false);
            return;
          }
        }

        // Fallback: fetch data for specific category
        const response = await fetch(TOP_INFLUENCER_SHEET_CSV_URL);
        const csv = await response.text();
        
        Papa.parse(csv, {
          header: true,
          complete: (results) => {
            const filteredData = results.data
              .filter((row: any) =>
                row.Category &&
                row.Category.trim().toLowerCase() === category.trim().toLowerCase()
              )
              .map((row: any) => {
                const mapped = {
                ...row,
                  Username: findField(row, "Username"),
                  Name: findField(row, "Name"),
                  Avatar: findField(row, "Avatar"),
                  Followers: findField(row, "Followers"),
                  Following: findField(row, "Following"),
                  Posts: findField(row, "Posts"),
                  ER: findField(row, "ER"),
                  AverageLikes: findField(row, "AverageLikes"),
                  AverageComments: findField(row, "AverageComments"),
                  Category: findField(row, "Category"),
                };
                // Debug log
                if ((row.Category || '').trim().toLowerCase() === 'travel') {
                  console.log('Mapped influencer row (fallback):', JSON.stringify(mapped, null, 2));
          }
                return mapped;
        });
            
            setData(filteredData);
            setIsLoading(false);
          },
          error: (error) => {
            console.error('Error parsing CSV:', error);
            setData([]);
            setIsLoading(false);
          }
        });
      } catch (error) {
        console.error('Error fetching data:', error);
        setData([]);
        setIsLoading(false);
      }
    };

    loadData();
  }, [category]);

  return data;
}

// Preload function for external use
export const preloadInfluencerData = preloadAllData; 