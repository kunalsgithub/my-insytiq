import fetch from "node-fetch";
import { apifyStartFailureMessage } from "./apifyErrors";
import {
  TRENDING_EXPLORE_ACTOR_ID,
  type TrendingDownloadMedias,
} from "./apifyFetcher";

export type TrendingExploreRunInput = {
  max_results: number;
  download_medias: TrendingDownloadMedias;
  country: string;
};

export type ApifyRunWaitResult =
  | { done: true; items: Record<string, unknown>[] }
  | { done: false; runId: string; status: string };

const TERMINAL_FAIL = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

export async function getApifyRunStatus(
  runId: string,
  apifyApiToken: string
): Promise<string> {
  const { status } = await fetchApifyRun(runId, apifyApiToken);
  return status;
}

export function isApifyRunTerminalFailure(status: string): boolean {
  return TERMINAL_FAIL.has(status);
}

async function fetchApifyRun(
  runId: string,
  apifyApiToken: string
): Promise<{ status: string; data: Record<string, unknown> }> {
  const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${apifyApiToken}` },
  });
  const runResult: { data?: { status?: string } & Record<string, unknown> } =
    await res.json();
  return {
    status: String(runResult.data?.status || "UNKNOWN"),
    data: (runResult.data || {}) as Record<string, unknown>,
  };
}

async function fetchDatasetItems(
  datasetId: string,
  apifyApiToken: string
): Promise<Record<string, unknown>[]> {
  const datasetRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items`,
    { headers: { Authorization: `Bearer ${apifyApiToken}` } }
  );
  const dataset = await datasetRes.json();
  return Array.isArray(dataset) ? dataset : [];
}

/** Start Explore trending actor (returns immediately). */
export async function startTrendingExploreRun(
  apifyApiToken: string,
  input: TrendingExploreRunInput
): Promise<string> {
  const url = `https://api.apify.com/v2/acts/${TRENDING_EXPLORE_ACTOR_ID}/runs`;
  const runResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apifyApiToken}`,
    },
    body: JSON.stringify(input),
  });

  const runJson: { data?: { id?: string } } = await runResponse.json();
  if (!runJson?.data?.id) {
    throw new Error(apifyStartFailureMessage(runJson));
  }
  console.log("[trending-apify] Started run", runJson.data.id, input);
  return runJson.data.id;
}

/** Poll until done, failed, or maxWaitMs. Does not throw on slow runs. */
export async function waitForTrendingExploreRun(
  runId: string,
  apifyApiToken: string,
  maxWaitMs: number
): Promise<ApifyRunWaitResult> {
  const pollIntervalMs = 5000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const { status, data } = await fetchApifyRun(runId, apifyApiToken);
    console.log("[trending-apify] Run", runId, "status:", status);

    if (status === "SUCCEEDED") {
      const datasetId = data.defaultDatasetId as string | undefined;
      if (!datasetId) {
        throw new Error("Apify run succeeded but no dataset id was returned");
      }
      const items = await fetchDatasetItems(datasetId, apifyApiToken);
      console.log("[trending-apify] Dataset items:", items.length);
      return { done: true, items };
    }

    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status} (run ${runId})`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  const { status } = await fetchApifyRun(runId, apifyApiToken);
  if (status === "SUCCEEDED") {
    const { data } = await fetchApifyRun(runId, apifyApiToken);
    const datasetId = data.defaultDatasetId as string | undefined;
    if (datasetId) {
      const items = await fetchDatasetItems(datasetId, apifyApiToken);
      return { done: true, items };
    }
  }

  return { done: false, runId, status };
}
