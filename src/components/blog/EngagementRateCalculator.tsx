import { useState } from "react";
import { Link } from "react-router-dom";

function getBenchmarkLabel(
  er: number,
  followerCount: number
): { label: string; color: string } {
  const goodThreshold =
    followerCount < 10000
      ? 6
      : followerCount < 50000
        ? 4
        : followerCount < 500000
          ? 2
          : followerCount < 1000000
            ? 1.5
            : 1;
  const avgThreshold =
    followerCount < 10000
      ? 4
      : followerCount < 50000
        ? 2
        : followerCount < 500000
          ? 1
          : followerCount < 1000000
            ? 0.5
            : 0.3;

  if (er >= goodThreshold * 1.33) {
    return { label: "Excellent", color: "text-green-700 bg-green-50 border-green-200" };
  }
  if (er >= goodThreshold) {
    return { label: "Good", color: "text-green-600 bg-green-50 border-green-200" };
  }
  if (er >= avgThreshold) {
    return { label: "Average", color: "text-amber-600 bg-amber-50 border-amber-200" };
  }
  return { label: "Below average", color: "text-red-600 bg-red-50 border-red-200" };
}

export function EngagementRateCalculator() {
  const [followers, setFollowers] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [saves, setSaves] = useState("");
  const [shares, setShares] = useState("");
  const [result, setResult] = useState<number | null>(null);

  function calculate() {
    const f = parseFloat(followers);
    const l = parseFloat(likes) || 0;
    const c = parseFloat(comments) || 0;
    const s = parseFloat(saves) || 0;
    const sh = parseFloat(shares) || 0;
    const total = l + c + s + sh;
    if (!f || f <= 0 || !total) {
      setResult(null);
      return;
    }
    setResult(Math.round((total / f) * 10000) / 100);
  }

  const fNum = parseFloat(followers);
  const benchmark =
    result !== null && fNum > 0 ? getBenchmarkLabel(result, fNum) : null;

  const fields = [
    { label: "Followers", value: followers, set: setFollowers, placeholder: "e.g. 15000" },
    { label: "Avg. Likes per post", value: likes, set: setLikes, placeholder: "e.g. 450" },
    { label: "Avg. Comments per post", value: comments, set: setComments, placeholder: "e.g. 30" },
    { label: "Avg. Saves per post", value: saves, set: setSaves, placeholder: "e.g. 80 (optional)" },
    { label: "Avg. Shares per post", value: shares, set: setShares, placeholder: "e.g. 20 (optional)" },
  ] as const;

  return (
    <div className="my-8 rounded-2xl border border-gray-200 bg-gray-50 p-6">
      <h3 className="mb-1 font-semibold text-gray-900">Free Engagement Rate Calculator</h3>
      <p className="mb-6 text-sm text-gray-500">
        Enter your average post metrics across your last 10 posts
      </p>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map(({ label, value, set, placeholder }) => (
          <div key={label}>
            <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => set(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#7c1d5c] focus:ring-2 focus:ring-[#7c1d5c]/30"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={calculate}
        className="mb-4 w-full rounded-xl bg-[#7c1d5c] py-3 font-semibold text-white transition-colors hover:bg-[#6a1850]"
      >
        Calculate my engagement rate
      </button>

      {result !== null && (
        <div className="text-center">
          <p className="mb-2 text-5xl font-bold text-[#7c1d5c]">{result}%</p>
          <p className="mb-3 text-sm text-gray-500">Engagement rate</p>
          {benchmark && (
            <span
              className={`inline-block rounded-full border px-4 py-1.5 text-sm font-semibold ${benchmark.color}`}
            >
              {benchmark.label} for your follower tier
            </span>
          )}
          <p className="mt-4 text-xs text-gray-400">
            Want a full breakdown benchmarked against your niche?{" "}
            <Link to="/auth" className="text-[#7c1d5c] underline">
              Try Insytiq free — no login needed →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
