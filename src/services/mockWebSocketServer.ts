import { WebSocketServer, WebSocket as WS } from 'ws';
import { createServer } from 'http';

interface MockStatsData {
  username: string;
  followers: number;
  following: number;
  lastUpdate: number;
}

class MockWebSocketServer {
  private wss: WebSocketServer;
  private statsData: Map<string, MockStatsData>;
  private updateIntervals: Map<string, NodeJS.Timeout>;

  constructor(port: number = 8080) {
    const server = createServer();
    this.wss = new WebSocketServer({ server });
    this.statsData = new Map();
    this.updateIntervals = new Map();

    server.listen(port, () => {
      console.log(`Mock WebSocket server running on port ${port}`);
    });

    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      // Extract username from URL
      const url = new URL(request.url || '', 'ws://localhost');
      const username = url.pathname.split('/')[2]; // /instagram/{username}/stats

      if (!username) {
        ws.close(1008, 'Username is required');
        return;
      }

      console.log(`Client connected for username: ${username}`);

      // Initialize or get stats data for this username
      if (!this.statsData.has(username)) {
        this.statsData.set(username, {
          username,
          followers: Math.floor(Math.random() * 1000000) + 10000,
          following: Math.floor(Math.random() * 100000) + 1000,
          lastUpdate: Date.now()
        });
      }

      // Send initial stats
      const data = this.statsData.get(username)!;
      ws.send(JSON.stringify({
        type: 'initial_stats',
        followers: data.followers,
        following: data.following
      }));

      // Start sending random updates if not already started
      if (!this.updateIntervals.has(username)) {
        const interval = setInterval(() => {
          this.sendRandomUpdate(username, ws);
        }, this.getRandomInterval());

        this.updateIntervals.set(username, interval);
      }

      ws.on('close', () => {
        console.log(`Client disconnected for username: ${username}`);
        // Don't clear the interval here as other clients might be connected
      });
    });
  }

  private getRandomInterval(): number {
    // Random interval between 2 and 10 seconds
    return Math.floor(Math.random() * 8000) + 2000;
  }

  private sendRandomUpdate(username: string, ws: WS) {
    const data = this.statsData.get(username);
    if (!data) return;

    // Randomly choose which metric to update (followers or following)
    const metric = Math.random() < 0.7 ? 'followers' : 'following';
    
    // 70% chance of increase, 30% chance of decrease
    const isIncrease = Math.random() < 0.7;
    const change = isIncrease ? 1 : -1;

    // Update the stats
    data[metric] = Math.max(0, data[metric] + change);
    data.lastUpdate = Date.now();

    // Send the update
    ws.send(JSON.stringify({
      type: 'stats_change',
      metric,
      change,
      timestamp: Date.now()
    }));

    // Schedule next update with a new random interval
    const currentInterval = this.updateIntervals.get(username);
    if (currentInterval) {
      clearInterval(currentInterval);
      const newInterval = setInterval(() => {
        this.sendRandomUpdate(username, ws);
      }, this.getRandomInterval());
      this.updateIntervals.set(username, newInterval);
    }
  }

  public stop() {
    // Clear all intervals
    this.updateIntervals.forEach(interval => clearInterval(interval));
    this.updateIntervals.clear();
    
    // Close all connections
    this.wss.clients.forEach(client => {
      client.close();
    });
    
    // Close the server
    this.wss.close();
  }
}

// Export a singleton instance
let instance: MockWebSocketServer | null = null;

export function getMockWebSocketServer(port?: number): MockWebSocketServer {
  if (!instance) {
    instance = new MockWebSocketServer(port);
  }
  return instance;
}

// For development/testing
if (process.env.NODE_ENV === 'development') {
  getMockWebSocketServer();
} 