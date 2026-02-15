import React from "react";
import { fetchAndStoreInstagramData } from "../api/fetchAndStoreInstagramData";

export default function TestFunction() {
  const callFunction = async () => {
    try {
      const data = await fetchAndStoreInstagramData("testUser123", "instagram_username_here");
      console.log("✅ Function Response:", data);
    } catch (err) {
      console.error("❌ Error calling function:", err);
    }
  };

  return (
    <div>
      <h1>Test fetchAndStoreInstagramData</h1>
      <button onClick={callFunction}>Run Test</button>
    </div>
  );
}
