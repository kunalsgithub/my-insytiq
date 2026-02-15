import React from 'react';

const LiveFollowerCount = ({ initialCount, username }: { initialCount: number, username: string }) => (
  <div className="mb-8">
    <h3 className="text-lg font-bold mb-2">Live Followers for @{username}</h3>
    <div className="text-3xl font-extrabold text-purple-600">{initialCount}</div>
  </div>
);

export default LiveFollowerCount; 