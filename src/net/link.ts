// The socket to the co-op relay (server/), with a test switch for lag.
//
// Where the relay is: `?relay=URL` on the page, else VITE_RELAY_URL from the
// build, else (only under `npm run dev`) port 8787 on the page's own host,
// which is where `wrangler dev` listens. A static build with no relay set
// has no co-op, and says so.
//
// `?lag=150` holds every message this page sends or receives for 150ms
// (`&jitter=40` adds up to 40ms more, never out of order), so two local
// pages can play as if over a slow connection. `&loss=0.05` loses that share
// of packets: over a WebSocket (TCP) a lost packet is sent again, so the
// message, and everything behind it, arrives 200-500ms late.
//
// Phones: a socket can die without a word (the train goes into a tunnel,
// Wi-Fi hands over to mobile data). Quiet lines are pinged every 3s (the
// relay answers without waking the room); nothing at all for 9s and the
// line is given up and dialled again. A change of network asks at once.

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export function relayBase(): string | null {
  const raw = params.get('relay') || (import.meta.env.VITE_RELAY_URL as string | undefined) || (import.meta.env.DEV ? `http://${location.hostname}:8787` : '');
  if (!raw) return null;
  return raw.replace(/\/+$/, '').replace(/^ws(s?):/, 'http$1:');
}

const wsBase = (base: string) => base.replace(/^http(s?):/, 'ws$1:');

export const LAG = Math.max(0, Number(params.get('lag')) || 0);
export const JITTER = Math.max(0, Number(params.get('jitter')) || 0);
export const LOSS = Math.min(0.5, Math.max(0, Number(params.get('loss')) || 0));
const QUIET_MS = 3000; // ping a line this quiet
const DEAD_MS = 9000; // give up on a line this quiet
const ASK_MS = 3000; // after a change of network, an answer is due this soon

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
  private lastIn = performance.now(); // anything heard, pongs included
  private pingAt = 0;
  private askAt = 0; // a change of network: when we asked
  private onNet = () => this.ask();
  open = false;
  closed = false;
  sent = 0; // bytes, for the test's numbers
  got = 0;

  constructor(base: string, path: string, private h: LinkHandlers) {
    this.ws = new WebSocket(`${wsBase(base)}${path}`);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => this.later('in', () => {
      if (this.closed) return;
      this.open = true;
      this.lastIn = performance.now();
      this.h.open();
    });
    this.ws.onmessage = (e) => {
      const d = e.data;
      this.later('in', () => {
        if (this.closed) return;
        this.lastIn = performance.now();
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
    this.pingT = setInterval(() => this.beat(), 1000);
    window.addEventListener('online', this.onNet);
    (navigator as Navigator & { connection?: EventTarget }).connection?.addEventListener?.('change', this.onNet);
  }

  // Once a second: ping a quiet line, give up on a dead one. Not while the
  // page is hidden (its timers are throttled, so the clock lies).
  private beat() {
    if (this.closed || !this.open || document.hidden) return;
    const now = performance.now();
    if (now - this.lastIn > DEAD_MS || (this.askAt && now - this.askAt > ASK_MS && this.lastIn < this.askAt)) {
      this.dead();
      return;
    }
    if (now - this.lastIn > QUIET_MS && now - this.pingAt > QUIET_MS) {
      this.pingAt = now;
      this.sendText('ping');
    }
  }

  // Is the line still there? (A new network, a page coming back into view.)
  ask() {
    if (this.closed || !this.open) return;
    this.askAt = performance.now();
    this.sendText('ping');
  }

  // Give up on a line that has gone quiet: dial again without waiting for
  // a goodbye that will never come.
  private dead() {
    try {
      this.ws.close(3002, 'quiet');
    } catch { /* already closed */ }
    this.finish(3002, 'quiet');
  }

  private delay(dir: 'in' | 'out'): number {
    if (!LAG && !JITTER && !LOSS) return 0;
    const now = performance.now();
    const resend = LOSS && Math.random() < LOSS ? 200 + Math.random() * 300 : 0;
    const at = Math.max(dir === 'in' ? this.inAt : this.outAt, now + LAG + Math.random() * JITTER + resend);
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
    window.removeEventListener('online', this.onNet);
    (navigator as Navigator & { connection?: EventTarget }).connection?.removeEventListener?.('change', this.onNet);
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

  // Tests: the line goes dead without a word (nothing in or out from now on).
  silence() {
    this.ws.onmessage = null;
    this.ws.onclose = null;
    this.ws.send = () => {};
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
