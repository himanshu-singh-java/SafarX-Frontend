import { Client } from '@stomp/stompjs';
import { WS_URL } from '../config';
import { getAuthToken } from './auth';

class WebSocketService {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscriptions = new Map();
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
          brokerURL: WS_URL,
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
            console.log('[STOMP] Connected to broker at', WS_URL);
            this.connected = true;
            this.connectionPromise = null;

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
            const errorMsg = (frame?.headers?.message || '').toLowerCase();
            console.warn('[STOMP Error frame]', frame?.headers?.message || frame);
            if (errorMsg.includes('unauthorized') || errorMsg.includes('forbidden') || errorMsg.includes('jwt') || errorMsg.includes('auth')) {
              console.warn('[STOMP] Authentication failure detected. Halting reconnect attempts.');
              if (this.client) {
                this.client.reconnectDelay = 0;
              }
              this.disconnect();
              reject(new Error('WebSocket authentication failed'));
            }
          },
          onWebSocketClose: () => {
            console.log('[STOMP] WebSocket connection closed. Invalidating subscription handles.');
            this.connected = false;
            this.connectionPromise = null;
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

  unsubscribeTopic(topic) {
    if (this.subscriptions.has(topic)) {
      const subData = this.subscriptions.get(topic);
      if (subData?.subHandle) {
        try {
          subData.subHandle.unsubscribe();
        } catch (e) {}
      }
      this.subscriptions.delete(topic);
      console.log('[STOMP] Explicitly removed topic subscription:', topic);
    }
  }

  clearRideSubscriptions() {
    Array.from(this.subscriptions.keys()).forEach((topic) => {
      if (topic.startsWith('/topic/ride/')) {
        this.unsubscribeTopic(topic);
      }
    });
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
