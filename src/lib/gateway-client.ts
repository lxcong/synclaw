import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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

/** ConnectParams sent as params of the "connect" RPC request. */
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
  caps: string[];
  auth?: { token: string };
  device?: {
    id: string;
    publicKey: string;
    signature: string;
    signedAt: number;
    nonce: string;
  };
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

interface PendingRequest {
  resolve: (payload: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// Device Identity
// ---------------------------------------------------------------------------

interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem);
  const spki = key.export({ type: "spki", format: "der" }) as Buffer;
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function fingerprintPublicKey(publicKeyPem: string): string {
  const raw = derivePublicKeyRaw(publicKeyPem);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function loadOrCreateDeviceIdentity(filePath: string): DeviceIdentity {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as {
        version?: number;
        deviceId?: string;
        publicKeyPem?: string;
        privateKeyPem?: string;
      };
      if (
        parsed?.version === 1 &&
        typeof parsed.deviceId === "string" &&
        typeof parsed.publicKeyPem === "string" &&
        typeof parsed.privateKeyPem === "string"
      ) {
        return {
          deviceId: parsed.deviceId,
          publicKeyPem: parsed.publicKeyPem,
          privateKeyPem: parsed.privateKeyPem,
        };
      }
    }
  } catch {
    // fall through to regenerate
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const deviceId = fingerprintPublicKey(publicKeyPem);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const stored = {
    version: 1,
    deviceId,
    publicKeyPem,
    privateKeyPem,
    createdAtMs: Date.now(),
  };
  fs.writeFileSync(filePath, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 });

  return { deviceId, publicKeyPem, privateKeyPem };
}

function signPayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, "utf8"), key);
  return base64UrlEncode(sig);
}

function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string;
  nonce: string;
}): string {
  return [
    "v2",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token,
    params.nonce,
  ].join("|");
}

// ---------------------------------------------------------------------------
// GatewayClient
// ---------------------------------------------------------------------------

const PROTOCOL_VERSION = 3;
const DEFAULT_URL = "ws://localhost:18789";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;
const PING_INTERVAL_MS = 30_000;
const CONNECT_CHALLENGE_TIMEOUT_MS = 5_000;
const IDENTITY_PATH = path.join(
  process.cwd(),
  ".data",
  "device-identity.json"
);

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private connected = false;
  private connecting = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  /** Set when a non-retriable error occurs (e.g. auth failure). */
  private fatalError = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  /** ID of the pending "connect" RPC request during handshake. */
  private connectRequestId: string | null = null;
  /** Timer for the connect challenge timeout. */
  private connectChallengeTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingRequests = new Map<string, PendingRequest>();
  private subscribers = new Map<string, RunSubscriber[]>();

  /** Ed25519 device identity for Gateway authentication. */
  private deviceIdentity: DeviceIdentity;

  /** Resolves once the connect handshake succeeds for the current connection. */
  private helloPromise: Promise<void> | null = null;
  private helloResolve: (() => void) | null = null;
  private helloReject: ((err: Error) => void) | null = null;

  constructor(url?: string) {
    this.url = url ?? process.env.OPENCLAW_GATEWAY_URL ?? DEFAULT_URL;
    this.deviceIdentity = loadOrCreateDeviceIdentity(IDENTITY_PATH);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Open the WebSocket and complete the connect handshake. */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting && this.helloPromise) return this.helloPromise;
    if (this.fatalError) return; // Don't reconnect after auth failures
    this.intentionalClose = false;
    return this._connect();
  }

  /** Gracefully close the connection and stop reconnecting. */
  disconnect(): void {
    this.intentionalClose = true;
    this._stopPing();
    this._clearConnectChallengeTimer();
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

  /** Subscribe to agent events for a specific runId. Multiple subscribers are supported. */
  subscribe(runId: string, subscriber: RunSubscriber): void {
    const existing = this.subscribers.get(runId);
    if (existing) {
      existing.push(subscriber);
    } else {
      this.subscribers.set(runId, [subscriber]);
    }
  }

  /** Remove a specific subscriber for a given runId. */
  unsubscribe(runId: string, subscriber?: RunSubscriber): void {
    if (!subscriber) {
      this.subscribers.delete(runId);
      return;
    }
    const list = this.subscribers.get(runId);
    if (!list) return;
    const idx = list.indexOf(subscriber);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this.subscribers.delete(runId);
  }

  /** Whether the client has an active, handshake-completed connection. */
  get isConnected(): boolean {
    return this.connected;
  }

  // -----------------------------------------------------------------------
  // Internal — Connection & Handshake
  // -----------------------------------------------------------------------

  private _connect(): Promise<void> {
    this.connecting = true;

    this.helloPromise = new Promise<void>((resolve, reject) => {
      this.helloResolve = resolve;
      this.helloReject = reject;
    });

    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      // Don't send anything yet — wait for the connect.challenge event.
      this._queueConnect();
    });

    this.ws.on("message", (raw: WebSocket.Data) => {
      this._handleMessage(raw);
    });

    this.ws.on("close", () => {
      this.connected = false;
      this.connecting = false;
      this._stopPing();
      this._clearConnectChallengeTimer();
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

  /**
   * Start a timer waiting for the connect.challenge event from the Gateway.
   * If the challenge doesn't arrive in time, close the connection.
   */
  private _queueConnect(): void {
    this.connectRequestId = null;
    this._clearConnectChallengeTimer();

    this.connectChallengeTimer = setTimeout(() => {
      this.connectChallengeTimer = null;
      if (this.connectRequestId || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      console.error("[GatewayClient] Connect challenge timeout");
      if (this.helloReject) {
        this.helloReject(new Error("Connect challenge timeout"));
        this.helloResolve = null;
        this.helloReject = null;
      }
      this.ws?.close(1008, "connect challenge timeout");
    }, CONNECT_CHALLENGE_TIMEOUT_MS);
  }

  /**
   * Send the "connect" RPC request after receiving the challenge nonce.
   * Includes device identity with Ed25519 signature for scope authorization.
   */
  private _sendConnect(nonce: string): void {
    if (this.connectRequestId) return; // Already sent

    this._clearConnectChallengeTimer();

    const id = crypto.randomUUID();
    this.connectRequestId = id;

    const role = "operator";
    const scopes = ["operator.admin"];
    const clientId = "gateway-client";
    const clientMode = "backend";
    const token = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
    const signedAtMs = Date.now();

    // Build and sign device auth payload
    const payload = buildDeviceAuthPayload({
      deviceId: this.deviceIdentity.deviceId,
      clientId,
      clientMode,
      role,
      scopes,
      signedAtMs,
      token,
      nonce,
    });
    const signature = signPayload(this.deviceIdentity.privateKeyPem, payload);

    const params: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: clientId,
        displayName: "SyncClaw",
        version: "0.1.0",
        platform: process.platform,
        mode: clientMode,
      },
      role,
      scopes,
      caps: ["tool-events"],
      device: {
        id: this.deviceIdentity.deviceId,
        publicKey: base64UrlEncode(derivePublicKeyRaw(this.deviceIdentity.publicKeyPem)),
        signature,
        signedAt: signedAtMs,
        nonce,
      },
    };

    if (token) {
      params.auth = { token };
    }

    const frame: RequestFrame = { type: "req", id, method: "connect", params };
    this._send(frame);
  }

  private _clearConnectChallengeTimer(): void {
    if (this.connectChallengeTimer) {
      clearTimeout(this.connectChallengeTimer);
      this.connectChallengeTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Internal — Message Handling
  // -----------------------------------------------------------------------

  private _send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not open");
    }
    this.ws.send(JSON.stringify(data));
  }

  private _handleMessage(raw: WebSocket.Data): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(String(raw)) as Record<string, unknown>;
    } catch {
      console.error("[GatewayClient] Failed to parse incoming frame");
      return;
    }

    // Handle event frames (including connect.challenge during handshake)
    if (parsed.type === "event") {
      const eventFrame = parsed as unknown as EventFrame;

      // connect.challenge must be handled before anything else
      if (eventFrame.event === "connect.challenge") {
        const payload = eventFrame.payload as Record<string, unknown> | undefined;
        const nonce = payload && typeof payload.nonce === "string" ? payload.nonce : null;

        if (!nonce || nonce.trim().length === 0) {
          console.error("[GatewayClient] Connect challenge missing nonce");
          if (this.helloReject) {
            this.helloReject(new Error("Connect challenge missing nonce"));
            this.helloResolve = null;
            this.helloReject = null;
          }
          this.ws?.close(1008, "connect challenge missing nonce");
          return;
        }

        this._sendConnect(nonce.trim());
        return;
      }

      this._onEvent(eventFrame);
      return;
    }

    // Handle response frames
    if (parsed.type === "res") {
      const responseFrame = parsed as unknown as ResponseFrame;

      // Check if this is the connect handshake response
      if (responseFrame.id === this.connectRequestId) {
        this.connectRequestId = null;

        if (responseFrame.ok) {
          this._onConnected();
        } else {
          const errorMsg = responseFrame.error?.message ?? "Connect rejected";
          const isAuthError = /unauthorized|forbidden|auth/i.test(errorMsg);
          if (isAuthError) {
            this.fatalError = true;
            this.intentionalClose = true;
            console.warn("[GatewayClient] Auth failed, will not retry:", errorMsg);
          } else {
            console.error("[GatewayClient] Connect handshake failed:", errorMsg);
          }
          if (this.helloReject) {
            this.helloReject(new Error(errorMsg));
            this.helloResolve = null;
            this.helloReject = null;
          }
        }
        return;
      }

      this._onResponse(responseFrame);
      return;
    }

    // Unknown frame type — ignore gracefully.
  }

  /** Called when the connect handshake succeeds. */
  private _onConnected(): void {
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
    // Resolve pending request if one exists.
    // For "agent" requests, the first response (status: "accepted") resolves the
    // promise. The second response (status: "ok"/"error") arrives later without a
    // matching pending entry, but must still notify subscribers below.
    const pending = this.pendingRequests.get(frame.id);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(frame.id);

      if (frame.ok) {
        pending.resolve(frame.payload);
      } else {
        pending.reject(
          new Error(frame.error?.message ?? "Unknown error (no error message in response)")
        );
      }
    }

    // Notify subscribers on terminal agent run responses (runs regardless of
    // pending state so the second "final" response from "agent" requests
    // triggers onComplete/onError even after the pending entry was consumed).
    const payload = frame.payload as Record<string, unknown> | undefined;
    if (payload && typeof payload.runId === "string" && payload.status !== "accepted") {
      const subs = this.subscribers.get(payload.runId);
      if (subs) {
        for (const sub of [...subs]) {
          if (frame.ok) {
            sub.onComplete(payload.runId, payload);
          } else {
            sub.onError(
              payload.runId,
              frame.error ?? { code: -1, message: "Unknown error" }
            );
          }
        }
      }
    }
  }

  private _onEvent(frame: EventFrame): void {
    if (frame.event !== "agent" || !frame.payload) return;

    const runId = frame.payload.runId as string | undefined;
    if (!runId) return;

    const subs = this.subscribers.get(runId);
    if (!subs) return;

    const event: AgentEvent = {
      runId,
      seq: (frame.payload.seq as number) ?? 0,
      stream: (frame.payload.stream as string) ?? "unknown",
      ts: (frame.payload.ts as number) ?? Date.now(),
      data: (frame.payload.data as Record<string, unknown>) ?? {},
    };

    for (const sub of [...subs]) {
      sub.onEvent(event);
    }
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
