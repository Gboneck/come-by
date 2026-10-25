// The socket to the co-op relay (server/), with a test switch for lag.
//
// Where the relay is: `?relay=URL` on the page, else VITE_RELAY_URL from the
// build, else (only under `npm run dev`) port 8787 on the page's own host,
// which is where `wrangler dev` listens. A static build with no relay set
// has no co-op, and says so.
//
// `?lag=150` holds every message this page sends or receives for 150ms
// (`&jitter=40` adds up to 40ms more, never out of order), so two local
// pages can play as if over a slow connection.

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export function relayBase(): string | null {
  const raw = params.get('relay') || (import.meta.env.VITE_RELAY_URL as string | undefined) || (import.meta.env.DEV ? `http://${location.hostname}:8787` : '');
  if (!raw) return null;
  return raw.replace(/\/+$/, '').replace(/^ws(s?):/, 'http$1:');
}

const wsBase = (base: string) => base.replace(/^http(s?):/, 'ws$1:');

export const LAG = Math.max(0, Number(params.get('lag')) || 0);
export const JITTER = Math.max(0, Number(params.get('jitter')) || 0);

// A new room for a host: its code and the token that proves it is theirs.
export async function createRoom(base: string): Promise<{ code: string; token: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${base}/rooms`, { method: 'POST', signal: ctl.signal });
    if (!r.ok) throw new Error(`relay ${r.status}`);
    const j = (await r.json()) as { code?: string; token?: string };
    if (!j.code || !j.token) throw new Error('relay said nothing');
    return { code: j.code, token: j.token };
  } finally {
    clearTimeout(timer);
  }
}

export interface LinkHandlers {
  open(): void;
  text(msg: { t: string; [k: string]: unknown }): void;
  binary(buf: ArrayBuffer): void;
  close(code: number, reason: string): void;
}

export class Link {
  private ws: WebSocket;
  private pingT: ReturnType<typeof setInterval> | null = null;
  private outAt = 0; // when the last delayed message goes (keeps them in order)
  private inAt = 0;
  open = false;
  closed = false;
  sent = 0; // bytes, for the test's numbers
  got = 0;

  constructor(base: string, path: string, private h: LinkHandlers) {
    this.ws = new WebSocket(`${wsBase(base)}${path}`);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this.later('in', () => {
      this.open = true;
      this.h.open();
    });
    this.ws.onmessage = (e) => {
      const d = e.data;
      this.later('in', () => {
        if (typeof d === 'string') {
          if (d === 'pong') return;
          try {
            this.h.text(JSON.parse(d));
          } catch { /* not ours */ }
        } else {
          this.got += (d as ArrayBuffer).byteLength;
          this.h.binary(d as ArrayBuffer);
        }
      });
    };
    this.ws.onclose = (e) => this.later('in', () => this.finish(e.code, e.reason));
    this.ws.onerror = () => { /* onclose follows */ };
    // Keep the socket warm through phone networks; the relay answers these
    // without waking the room.
    this.pingT = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send('ping');
    }, 20000);
  }

  private delay(dir: 'in' | 'out'): number {
    if (!LAG && !JITTER) return 0;
    const now = performance.now();
    const at = Math.max(dir === 'in' ? this.inAt : this.outAt, now + LAG + Math.random() * JITTER);
    if (dir === 'in') this.inAt = at;
    else this.outAt = at;
    return at - now;
  }

  private later(dir: 'in' | 'out', fn: () => void) {
    const ms = this.delay(dir);
    if (ms <= 0) fn();
    else setTimeout(fn, ms);
  }

  private finish(code: number, reason: string) {
    if (this.closed) return;
    this.closed = true;
    this.open = false;
    if (this.pingT) clearInterval(this.pingT);
    this.h.close(code, reason);
  }

  send(buf: ArrayBuffer) {
    this.sent += buf.byteLength;
    this.later('out', () => {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send(buf);
    });
  }

  sendText(s: string) {
    this.later('out', () => {
      if (this.ws.readyState === WebSocket.OPEN) this.ws.send(s);
    });
  }

  // Tests: the line drops as if the phone lost signal.
  drop() {
    try {
      this.ws.close(3001, 'dropped');
    } catch { /* already closed */ }
  }

  // Close on purpose (4000 = leaving, the room or the ranch).
  close(code = 4000, reason = 'bye') {
    if (this.pingT) clearInterval(this.pingT);
    try {
      this.ws.close(code, reason);
    } catch { /* already closed */ }
    this.finish(code, reason);
  }
}
