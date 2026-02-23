import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatNumber } from "../lib/utils";
import SplashCursor from "./SplashCursor/SplashCursor";
import FollowerGrowthChart from "./FollowerGrowthChart";
import { RefreshCw } from "lucide-react";

interface LiveFollowerCounterProps {
  username: string;
  initialCount: number;
  className?: string;
  onRefresh?: () => void;
}

export function LiveFollowerCounter({
  username,
  initialCount,
  className = "",
  onRefresh,
}: LiveFollowerCounterProps) {
  const [count, setCount] = useState(initialCount);
  const [lastChange, setLastChange] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Update count when initialCount prop changes
  useEffect(() => {
    if (initialCount > 0) {
      setCount(initialCount);
    }
  }, [initialCount]);

  // WebSocket connection for real-time updates
  // Disabled until WebSocket server is available
  // useEffect(() => {
  //   const isDev = process.env.NODE_ENV === 'development';
  //   const wsUrl = isDev 
  //     ? `ws://localhost:8080/instagram/${username}/followers`
  //     : `wss://your-api-endpoint/instagram/${username}/followers`;

  //   const socket = new WebSocket(wsUrl);

  //   socket.onopen = () => {
  //     setConnectionStatus('connected');
  //   };

  //   socket.onmessage = (event) => {
  //     try {
  //       const data = JSON.parse(event.data);
  //       if (data.type === 'initial_count') {
  //         setCount(data.count);
  //       } else if (data.type === 'follower_change') {
  //         const change = data.change as number;
  //         setCount(prev => prev + change);
  //         setLastChange(change);
  //       }
  //     } catch (error) {
  //       // ignore
  //     }
  //   };

  //   socket.onerror = () => {
  //     setConnectionStatus('disconnected');
  //   };

  //   socket.onclose = () => {
  //     setConnectionStatus('disconnected');
  //     setTimeout(() => {
  //       setWs(null);
  //       setConnectionStatus('connecting');
  //     }, 5000);
  //   };

  //   setWs(socket);
  //   return () => {
  //     socket.close();
  //   };
  // }, [username]);

  console.log("InstagramAnalytics username:", username);

  return (
    <div
      className={
        "relative flex flex-col items-center justify-center mx-auto w-full " +
        className
      }
      style={{ minHeight: '220px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Splash Cursor overlay above the section */}
      {isHovered && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <SplashCursor />
        </div>
      )}
      {/* Main Content */}
      <div className={
        "relative z-10 flex flex-col items-center justify-center min-h-[180px] w-full bg-white rounded-xl shadow-lg border border-gray-200 p-8"
      }>
        <div className="text-lg font-medium mb-6 tracking-wide w-full flex items-center justify-between pl-2 pt-2 text-gray-700">
          <span>Live Follower Count</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
              title="Refresh follower count"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
        <motion.div
          key={count}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="text-[clamp(2rem,8vw,3.5rem)] font-extrabold text-center select-none text-gray-900"
          style={{ letterSpacing: 2 }}
        >
          {formatNumber(count)}
        </motion.div>
        <div className="text-xl font-light text-gray-500 mt-2 mb-6 text-center">
          Followers
        </div>
        <AnimatePresence>
          {lastChange && (
            <motion.div
              key={lastChange}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl font-bold " +
                (lastChange > 0 ? "text-green-500" : "text-red-500")
              }
              style={{ pointerEvents: 'none' }}
            >
              {lastChange > 0 ? `+${lastChange}` : lastChange}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function parseFollowers(value) {
  if (typeof value === 'string') {
    if (value.endsWith('M')) return Number(value.replace('M', '')) * 1_000_000;
    if (value.endsWith('K')) return Number(value.replace('K', '')) * 1_000;
    return Number(value.replace(/,/g, ''));
  }
  return Number(value);
} 