import * as SecureStore from 'expo-secure-store';

export type Connection = {
  url: string;
  token: string;
  // Optional Cloudflare Access service token, sent on every request.
  cfClientId?: string;
  cfClientSecret?: string;
};

export type SessionInfo = {
  id: string;
  name: string;
  kind: string;
  command: string[];
  cwd: string;
  createdAt: string;
  exited: boolean;
  exitCode: number;
  clients: number;
};

export type CreateSession = {
  name?: string;
  kind?: string;
  script?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
};

// React Native's WebSocket accepts custom headers as a third argument;
// the DOM typings don't know about it.
const RNWebSocket = WebSocket as unknown as new (
  url: string,
  protocols: string | string[] | undefined,
  options: { headers: Record<string, string> },
) => WebSocket;

const STORE_KEY = 'connection';

export async function loadConnection(): Promise<Connection | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  return raw ? (JSON.parse(raw) as Connection) : null;
}

export async function saveConnection(conn: Connection) {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(conn));
}

export async function clearConnection() {
  await SecureStore.deleteItemAsync(STORE_KEY);
}

export function normalizeUrl(url: string) {
  let u = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(u)) u = 'https://' + u;
  return u;
}

export class Api {
  constructor(private conn: Connection) {}

  headers(): Record<string, string> {
    const h: Record<string, string> = { Authorization: `Bearer ${this.conn.token}` };
    if (this.conn.cfClientId && this.conn.cfClientSecret) {
      h['CF-Access-Client-Id'] = this.conn.cfClientId;
      h['CF-Access-Client-Secret'] = this.conn.cfClientSecret;
    }
    return h;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.conn.url + path, {
      method,
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        if (res.status === 403) msg = 'Bloqueado pelo Cloudflare Access (confira o service token)';
      }
      throw new Error(msg);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  health() {
    return this.request<{ ok: boolean; host: string }>('GET', '/api/health');
  }

  listSessions() {
    return this.request<SessionInfo[]>('GET', '/api/sessions');
  }

  createSession(req: CreateSession) {
    return this.request<SessionInfo>('POST', '/api/sessions', req);
  }

  deleteSession(id: string) {
    return this.request<void>('DELETE', `/api/sessions/${id}`);
  }

  openSocket(id: string) {
    const wsUrl = this.conn.url.replace(/^http/, 'ws') + `/api/sessions/${id}/ws`;
    return new RNWebSocket(wsUrl, undefined, { headers: this.headers() });
  }
}
