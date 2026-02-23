import React from "react";

interface InstagramDashboardProps {
  username?: string;
  profilePictureUrl?: string;
  followers?: number;
  following?: number;
  posts?: number;
  averageLikes?: number;
  averageComments?: number;
  engagementRate?: number;
}

const InstagramDashboard: React.FC<InstagramDashboardProps> = ({
  username = "",
  profilePictureUrl,
  followers = 0,
  following = 0,
  posts = 0,
  averageLikes = 0,
  averageComments = 0,
  engagementRate = 0,
}) => {
  const metrics = [
    { label: "Avg. likes", value: Math.round(averageLikes), icon: "🔥", color: "#a78bfa" },
    { label: "Avg. comments", value: averageComments.toFixed(1), icon: "📈", color: "#f472b6" },
    { label: "Engagement rate", value: `${engagementRate.toFixed(1)}%`, icon: "👥", color: "#60a5fa" },
  ];

  const displayUsername = username ? `@${username}` : "@username";
  return (
    <section className="w-full mt-8">
      <div className="bg-white rounded-xl shadow border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Profile summary */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
          {profilePictureUrl ? (
            <img
              src={profilePictureUrl}
              alt={username}
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
              onError={(e) => {
                // Suppress 403 errors (expected from Instagram CDN)
                const target = e.target as HTMLImageElement;
                // Replace with placeholder
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.profile-placeholder')) {
                  const placeholder = document.createElement('div');
                  placeholder.className = 'profile-placeholder w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200';
                  placeholder.innerHTML = '<span class="text-3xl">📷</span>';
                  parent.appendChild(placeholder);
                }
              }}
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
              <span className="text-3xl">📷</span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-bold">{displayUsername}</span>
            </div>
            <div className="flex gap-6 text-sm font-medium text-gray-700 mt-2">
              <span><b>{posts}</b> posts</span>
              <span><b>{followers.toLocaleString()}</b> followers</span>
              <span><b>{following.toLocaleString()}</b> following</span>
            </div>
          </div>
        </div>
        {/* Download/Copy buttons */}
        <div className="flex flex-col gap-2 md:items-end">
          <button className="px-4 py-2 rounded border bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center gap-2">
            <span>&#8681;</span> Download profile
          </button>
          <button className="px-4 py-2 rounded border bg-gray-50 hover:bg-gray-100 text-gray-700 flex items-center gap-2">
            <span>&#128279;</span> Copy profile URL
          </button>
        </div>
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-8">
        {metrics.map((metric, i) => (
          <div
            key={i}
            className="flex flex-col items-center bg-gray-50 rounded-xl py-6 shadow border"
          >
            <span
              className="mb-2 text-3xl"
              style={{ color: metric.color }}
            >
              {metric.icon}
            </span>
            <span className="text-2xl font-bold mb-1">{metric.value}</span>
            <span className="text-gray-500 text-sm">{metric.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default InstagramDashboard; 