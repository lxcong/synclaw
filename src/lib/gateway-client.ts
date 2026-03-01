import WebSocket from "ws";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentEvent {
  runId: string;
  seq: number;
  stream: string; // "lifecycle" | "tool" | "assistant" | "error"
  ts: number;
  data: Record<string, unknown>;
}

export interface RunSubscriber {
  onEvent: (event: AgentEvent) => void;
  onComplete: (runId: string, payload: unknown) => void;
  onError: (runId: string, error: { code: number; message: string }) => void;
}

/** Frame sent immediately after WebSocket open to negotiate protocol. */
interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    displayName: string;
    version: string;
    platform: string;
    mode: string;
  };
  role: string;
  scopes: string[];
  auth?: { token: string };
}

interface RequestFrame {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

interface ResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: number; message: string };
}

interface EventFrame {
  type: "event";
  event: string;
  payload?: Record<string, unknown>;
}

interface HelloOkFrame {
  type: "hello-ok";
  protocol: number;
  server: Record<string, unknown>;
  features: Record<string, unknown>;
}

type IncomingFrame = ResponseFrame | EventFrame | HelloOkFrame;

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// GatewayClient
// ---------------------------------------------------------------------------

const DEFAULT_URL = "ws://localhost:18789";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;
const PING_INTERVAL_MS = 30_000;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private connected = false;
  private connecting = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  private pendingRequests = new Map<string, PendingRequest>();
  private subscribers = new Map<string, RunSubscriber>();

  /** Resolves once the hello-ok handshake succeeds for the current connection. */
  private helloPromise: Promise<void> | null = null;
  private helloResolve: (() => void) | null = null;
  private helloReject: ((err: Error) => void) | null = null;

  constructor(url?: string) {
    this.url = url ?? process.env.OPENCLAW_GATEWAY_URL ?? DEFAULT_URL;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Open the WebSocket and complete the hello handshake. */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting && this.helloPromise) return this.helloPromise;
    this.intentionalClose = false;
    return this._connect();
  }

  /** Gracefully close the connection and stop reconnecting. */
  disconnect(): void {
    this.intentionalClose = true;
    this._stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.connecting = false;
    // Reject any outstanding requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Client disconnected"));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Send an RPC request and wait for the matching response.
   * Automatically connects if not already connected.
   */
  async request(method: string, params?: unknown): Promise<unknown> {
    await this.connect();

    const id = crypto.randomUUID();
    const frame: RequestFrame = { type: "req", id, method };
    if (params !== undefined) frame.params = params;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} (${id}) timed out after ${DEFAULT_TIMEOUT_MS}ms`));
      }, DEFAULT_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this._send(frame);
    });
  }

  /** Subscribe to agent events for a specific runId. */
  subscribe(runId: string, subscriber: RunSubscriber): void {
    this.subscribers.set(runId, subscriber);
  }

  /** Remove the subscriber for a given runId. */
  unsubscribe(runId: string): void {
    this.subscribers.delete(runId);
  }

  /** Whether the client has an active, handshake-completed connection. */
  get isConnected(): boolean {
    return this.connected;
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private _connect(): Promise<void> {
    this.connecting = true;

    this.helloPromise = new Promise<void>((resolve, reject) => {
      this.helloResolve = resolve;
      this.helloReject = reject;
    });

    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      this._sendConnectParams();
    });

    this.ws.on("message", (raw: WebSocket.Data) => {
      this._handleMessage(raw);
    });

    this.ws.on("close", () => {
      this.connected = false;
      this.connecting = false;
      this._stopPing();
      if (!this.intentionalClose) {
        this._scheduleReconnect();
      }
    });

    this.ws.on("error", (err: Error) => {
      // If we are still waiting on the hello handshake, reject it.
      if (this.helloReject && !this.connected) {
        this.helloReject(err);
        this.helloResolve = null;
        this.helloReject = null;
      }
      // The 'close' event will fire after 'error', triggering reconnect.
    });

    return this.helloPromise;
  }

  private _sendConnectParams(): void {
    const params: ConnectParams = {
      minProtocol: 1,
      maxProtocol: 1,
      client: {
        id: "gateway-client",
        displayName: "SyncClaw",
        version: "0.1.0",
        platform: "node",
        mode: "backend",
      },
      role: "operator",
      scopes: ["admin"],
    };

    const token = process.env.OPENCLAW_GATEWAY_TOKEN;
    if (token) {
      params.auth = { token };
    }

    this._send(params);
  }

  private _send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.ws.send(JSON.stringify(data));
  }

  private _handleMessage(raw: WebSocket.Data): void {
    let frame: IncomingFrame;
    try {
      frame = JSON.parse(String(raw)) as IncomingFrame;
    } catch {
      console.error("[GatewayClient] Failed to parse incoming frame:", String(raw));
      return;
    }

    switch (frame.type) {
      case "hello-ok":
        this._onHelloOk();
        break;
      case "res":
        this._onResponse(frame);
        break;
      case "event":
        this._onEvent(frame);
        break;
      default:
        // Unknown frame type — ignore gracefully.
        break;
    }
  }

  private _onHelloOk(): void {
    this.connected = true;
    this.connecting = false;
    this.reconnectAttempt = 0;
    this._startPing();
    if (this.helloResolve) {
      this.helloResolve();
      this.helloResolve = null;
      this.helloReject = null;
    }
  }

  private _startPing(): void {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, PING_INTERVAL_MS);
  }

  private _stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private _onResponse(frame: ResponseFrame): void {
    const pending = this.pendingRequests.get(frame.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(frame.id);

    if (frame.ok) {
      pending.resolve(frame.payload);
    } else {
      pending.reject(
        new Error(frame.error?.message ?? "Unknown error (no error message in response)")
      );
    }

    // Check if this response is for an agent run (has payload.runId and a
    // terminal status). A "res" with status !== "accepted" signals completion.
    const payload = frame.payload as Record<string, unknown> | undefined;
    if (payload && typeof payload.runId === "string" && payload.status !== "accepted") {
      const subscriber = this.subscribers.get(payload.runId);
      if (subscriber) {
        if (frame.ok) {
          subscriber.onComplete(payload.runId, payload);
        } else {
          subscriber.onError(
            payload.runId,
            frame.error ?? { code: -1, message: "Unknown error" }
          );
        }
      }
    }
  }

  private _onEvent(frame: EventFrame): void {
    if (frame.event !== "agent" || !frame.payload) return;

    const runId = frame.payload.runId as string | undefined;
    if (!runId) return;

    const subscriber = this.subscribers.get(runId);
    if (!subscriber) return;

    subscriber.onEvent({
      runId,
      seq: (frame.payload.seq as number) ?? 0,
      stream: (frame.payload.stream as string) ?? "unknown",
      ts: (frame.payload.ts as number) ?? Date.now(),
      data: (frame.payload.data as Record<string, unknown>) ?? {},
    });
  }

  // -----------------------------------------------------------------------
  // Auto-reconnect with exponential backoff
  // -----------------------------------------------------------------------

  private _scheduleReconnect(): void {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      MAX_BACKOFF_MS
    );
    this.reconnectAttempt++;

    console.log(
      `[GatewayClient] Connection lost. Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})...`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect().catch((err) => {
        console.error("[GatewayClient] Reconnect handshake failed:", err.message);
        // The 'close' handler will schedule another reconnect.
      });
    }, delay);
  }
}

// ---------------------------------------------------------------------------
// Singleton (globalThis cache — survives HMR in dev)
// ---------------------------------------------------------------------------

const globalForGateway = globalThis as unknown as {
  gatewayClient: GatewayClient | undefined;
};

export const gatewayClient =
  globalForGateway.gatewayClient ?? new GatewayClient();

if (process.env.NODE_ENV !== "production") {
  globalForGateway.gatewayClient = gatewayClient;
}
