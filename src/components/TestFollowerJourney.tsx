import React, { useState } from "react";
import { fetchAndStoreInstagramData } from "../api/fetchAndStoreInstagramData";
import { getFollowerJourney } from "../api/getFollowerJourney";

export default function TestFollowerJourney() {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const userId = "test_user_001"; // any test ID you want

      console.log("▶️ Starting fetchAndStoreInstagramData...");
      const storeResponse = await fetchAndStoreInstagramData(userId, username);
      console.log("✅ Data stored:", storeResponse);

      console.log("▶️ Fetching follower journey...");
      const journeyResponse = await getFollowerJourney(userId);
      console.log("🌍 Follower Journey:", journeyResponse);

      setResult(journeyResponse);
    } catch (error) {
      console.error("❌ Error:", error);
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-900 text-white rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-2">Follower Journey Test</h2>

      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter Instagram username"
        className="p-2 rounded text-black mb-3 w-full"
      />

      <button
        onClick={handleTest}
        className="bg-blue-600 hover:bg-blue-700 p-2 rounded"
        disabled={loading}
      >
        {loading ? "Testing..." : "Run Test"}
      </button>

      {result && (
        <pre className="bg-black p-3 mt-4 rounded overflow-auto text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
