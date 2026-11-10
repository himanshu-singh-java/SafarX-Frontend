import { Client } from '@stomp/stompjs';
import { getAuthToken } from './auth';

/**
 * SafarX WebSocket & STOMP Service
 * Uses native browser WebSocket connecting directly to Spring Boot at ws://localhost:8080/ws-ride/websocket
 * Authenticated via JWT Bearer token on CONNECT (matches Spring Boot WebSocketConfig).
 * Handles multi-tab resilience, background tab sleep, auto-resubscription on reconnect, and location streaming.
 */
class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map(); // topic -> { callbacks: Set, subHandle: StompSubscription | null }
    this.connectionPromise = null;
  }

  connect() {
    if (this.client && this.client.connected) {
      this.connected = true;
      return Promise.resolve(this.client);
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const token = getAuthToken();

      if (!this.client) {
        this.client = new Client({
          brokerURL: 'ws://localhost:8080/ws-ride/websocket',
          connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
          beforeConnect: () => {
            const freshToken = getAuthToken();
            if (freshToken && this.client) {
              this.client.connectHeaders = { Authorization: `Bearer ${freshToken}` };
            }
          },
          reconnectDelay: 2000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          debug: () => {},
          onConnect: () => {
            console.log('[STOMP] Connected to ws://localhost:8080/ws-ride/websocket');
            this.connected = true;
            this.connectionPromise = null;

            // Re-establish ALL registered topic subscriptions on the new broker connection
            this.subscriptions.forEach((subData, topic) => {
              try {
                subData.subHandle = this.client.subscribe(topic, (msg) => {
                  try {
                    const data = JSON.parse(msg.body);
                    subData.callbacks.forEach((cb) => cb(data));
                  } catch (e) {
                    subData.callbacks.forEach((cb) => cb(msg.body));
                  }
                });
                console.log('[STOMP] Topic subscribed on connect:', topic);
              } catch (err) {
                console.warn('[STOMP] Subscribe on connect failed for topic:', topic, err);
                subData.subHandle = null;
              }
            });

            resolve(this.client);
          },
          onStompError: (frame) => {
            console.warn('[STOMP Warning frame]', frame?.headers?.message || frame);
          },
          onWebSocketClose: () => {
            console.log('[STOMP] WebSocket connection closed. Invalidating subscription handles.');
            this.connected = false;
            this.connectionPromise = null;
            // Mark all handles as null so next onConnect will re-subscribe
            this.subscriptions.forEach((subData) => {
              subData.subHandle = null;
            });
          },
          onDisconnect: () => {
            console.log('[STOMP] Disconnected.');
            this.connected = false;
            this.connectionPromise = null;
            this.subscriptions.forEach((subData) => {
              subData.subHandle = null;
            });
          },
        });

        this.client.activate();
      } else if (!this.client.active) {
        this.client.activate();
      }
    });

    return this.connectionPromise;
  }

  ensureConnected() {
    if (this.client && this.client.connected) {
      return Promise.resolve(this.client);
    }
    return this.connect();
  }

  subscribe(topic, callback) {
    // Strictly validate topic pattern to match Spring Boot regex: ^/topic/(ride|driver)/\d+$
    if (!topic || !topic.match(/^\/topic\/(ride|driver)\/\d+$/)) {
      console.warn('[WebSocket] Skipped subscription: invalid destination pattern:', topic);
      return () => {};
    }

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, { callbacks: new Set(), subHandle: null });
    }

    const subData = this.subscriptions.get(topic);
    subData.callbacks.add(callback);

    const isReady = this.client && this.client.connected;

    if (isReady && !subData.subHandle) {
      try {
        subData.subHandle = this.client.subscribe(topic, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            subData.callbacks.forEach((cb) => cb(data));
          } catch (e) {
            subData.callbacks.forEach((cb) => cb(msg.body));
          }
        });
        console.log('[STOMP] Immediate subscription active for:', topic);
      } catch (err) {
        console.warn('[STOMP] Subscribe error:', topic, err);
        subData.subHandle = null;
      }
    } else if (!isReady) {
      this.connect().catch((err) => {
        console.warn('[STOMP] Connect error during subscribe:', err);
      });
    }

    // Unsubscribe helper
    return () => {
      subData.callbacks.delete(callback);
      if (subData.callbacks.size === 0) {
        if (subData.subHandle) {
          try {
            subData.subHandle.unsubscribe();
          } catch (e) {}
        }
        this.subscriptions.delete(topic);
        console.log('[STOMP] Cleanly unsubscribed from topic:', topic);
      }
    };
  }

  publish(destination, body) {
    if (!this.client || !this.client.connected) {
      console.warn('[STOMP] Cannot publish: client not connected to broker');
      return;
    }
    try {
      this.client.publish({
        destination,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    } catch (e) {
      console.warn('[STOMP] Publish error:', e);
    }
  }

  async sendLocationUpdate(rideId, driverId, latitude, longitude) {
    try {
      if (!this.client || !this.client.connected) {
        await this.ensureConnected();
      }
      if (!this.client || !this.client.connected) {
        return;
      }
      this.client.publish({
        destination: '/app/update-location',
        body: JSON.stringify({
          rideId: Number(rideId) || 0,
          driverId: Number(driverId) || 0,
          latitude: parseFloat(Number(latitude).toFixed(6)),
          longitude: parseFloat(Number(longitude).toFixed(6)),
        }),
      });
    } catch (e) {
      console.warn('[STOMP] sendLocationUpdate error:', e);
    }
  }

  disconnect() {
    if (this.client) {
      this.subscriptions.forEach((subData) => {
        if (subData.subHandle) {
          try {
            subData.subHandle.unsubscribe();
          } catch (e) {}
        }
      });
      this.subscriptions.clear();
      try {
        this.client.deactivate();
      } catch (e) {}
      this.client = null;
      this.connected = false;
      this.connectionPromise = null;
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;
