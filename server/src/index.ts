import { DurableObject } from 'cloudflare:workers';

// Come By's co-op relay. One Durable Object per room code: the host's
// browser runs the ranch, guests' browsers run their own dogs, and this
// only passes messages between them. Sockets use the hibernation API, so a
// quiet room costs nothing.
//
// Wire format:
// - Text frames are the relay's own control messages, JSON with a `t`.
// - Binary frames are the game's. Byte 0 routes them: from the host it is
//   the guest slot to send to (0 = every guest); from a guest the relay
//   overwrites it with that guest's slot before passing it to the host.
//   Nothing else in a binary frame is read here.
//
// Routes:
//   POST /rooms                          -> { code, token } a new room for a host
//   GET  /rooms/CODE/ws?role=host&token= -> the host's socket (and reconnects)
//   GET  /rooms/CODE/ws?role=guest&id=&name= -> a guest's socket
//   GET  /health                         -> { ok: true }

// `Env` (the ROOMS binding) is generated from wrangler.toml: `npm run types`.

// Consonants only, so a code never spells a word.
const LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
const CODE_LEN = 4;
const MAX_GUESTS = 3; // four dogs with the host's
const HOST_GRACE_MS = 30_000; // a host who drops may come back this quickly
const RESERVE_MS = 120_000; // a new room waits this long for its host
const SLOT_KEEP_MS = 90_000; // a guest who drops keeps their slot this long

// Close codes the client knows.
const CLOSED = 4000; // the host shut the ranch (or never came back)
const REPLACED = 4001; // the same player connected again elsewhere
const NO_ROOM = 4404;
const FULL = 4409;
const BAD_TOKEN = 4403;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS });
}

function newCode(): string {
  const b = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(b);
  return [...b].map((x) => LETTERS[x % LETTERS.length]).join('');
}

const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health' || url.pathname === '/') return json({ ok: true });

    if (url.pathname === '/rooms' && request.method === 'POST') {
      // Pick a code nobody is using; the room itself says whether it is free.
      for (let i = 0; i < 8; i++) {
        const code = newCode();
        const token = await env.ROOMS.getByName(code).reserve();
        if (token) return json({ code, token });
      }
      return json({ error: 'busy' }, 503);
    }

    const m = url.pathname.match(/^\/rooms\/([A-Za-z]+)\/ws$/);
    if (m && request.method === 'GET') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426, headers: CORS });
      return env.ROOMS.getByName(cleanCode(m[1])).fetch(request);
    }
    return json({ error: 'not found' }, 404);
  },
} satisfies ExportedHandler<Env>;

interface Seat {
  role: 'host' | 'guest';
  id: string;
  name: string;
  slot: number; // 0 for the host
}

interface Meta {
  token: string;
  created: number;
  hostGoneAt: number; // 0 while the host is here (or has not come yet)
  slots: Record<string, { slot: number; seen: number }>; // guest id -> slot, kept across drops
}

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive pings are answered without waking the room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private async meta(): Promise<Meta | null> {
    return (await this.ctx.storage.get<Meta>('meta')) ?? null;
  }

  private async setMeta(m: Meta) {
    await this.ctx.storage.put('meta', m);
  }

  private seat(ws: WebSocket): Seat | null {
    try {
      return (ws.deserializeAttachment() as Seat | null) ?? null;
    } catch {
      return null;
    }
  }

  private host(): WebSocket | null {
    return this.ctx.getWebSockets('host')[0] ?? null;
  }

  private guests(): WebSocket[] {
    return this.ctx.getWebSockets('guest');
  }

  private send(ws: WebSocket, msg: unknown) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* already closing */
    }
  }

  private shut(ws: WebSocket, code: number, reason: string) {
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
  }

  // A host asks for this code. Free if nobody holds it (or the last host
  // left long enough ago): returns the host's token, or null if taken.
  async reserve(): Promise<string | null> {
    const m = await this.meta();
    const now = Date.now();
    if (m && (this.host() || this.guests().length || now - m.created < RESERVE_MS || (m.hostGoneAt && now - m.hostGoneAt < HOST_GRACE_MS))) return null;
    const token = crypto.randomUUID();
    await this.ctx.storage.deleteAll();
    await this.setMeta({ token, created: Date.now(), hostGoneAt: 0, slots: {} });
    await this.ctx.storage.setAlarm(Date.now() + RESERVE_MS);
    return token;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const m = await this.meta();

    if (role === 'host') {
      if (!m || url.searchParams.get('token') !== m.token) {
        // Browsers cannot read an HTTP error on a socket, so say it with a close.
        this.ctx.acceptWebSocket(server, ['refused']);
        this.shut(server, BAD_TOKEN, 'not your ranch');
        return new Response(null, { status: 101, webSocket: client });
      }
      for (const old of this.ctx.getWebSockets('host')) this.shut(old, REPLACED, 'replaced');
      this.ctx.acceptWebSocket(server, ['host']);
      server.serializeAttachment({ role: 'host', id: 'host', name: url.searchParams.get('name') ?? '', slot: 0 } satisfies Seat);
      const back = m.hostGoneAt > 0;
      m.hostGoneAt = 0;
      await this.setMeta(m);
      await this.ctx.storage.deleteAlarm();
      const list = this.guests().map((g) => this.seat(g)).filter((s): s is Seat => !!s).map((s) => ({ slot: s.slot, id: s.id, name: s.name }));
      this.send(server, { t: 'welcome', role: 'host', slot: 0, guests: list });
      if (back) for (const g of this.guests()) this.send(g, { t: 'host-back' });
      return new Response(null, { status: 101, webSocket: client });
    }

    // A guest. The room must exist and its host be here (or just dropped).
    const id = (url.searchParams.get('id') ?? '').slice(0, 64) || crypto.randomUUID();
    const name = (url.searchParams.get('name') ?? 'DOG').slice(0, 16);
    const hostHere = !!this.host();
    if (!m || (!hostHere && !(m.hostGoneAt && Date.now() - m.hostGoneAt < HOST_GRACE_MS))) {
      this.ctx.acceptWebSocket(server, ['refused']);
      this.shut(server, NO_ROOM, 'no ranch with that code');
      return new Response(null, { status: 101, webSocket: client });
    }
    // The same player again (a reload, a dropped phone): the old socket goes.
    for (const g of this.guests()) if (this.seat(g)?.id === id) this.shut(g, REPLACED, 'replaced');
    const live = this.guests().filter((g) => this.seat(g)?.id !== id);
    const now = Date.now();
    for (const [gid, s] of Object.entries(m.slots)) if (now - s.seen > SLOT_KEEP_MS && !live.some((g) => this.seat(g)?.id === gid)) delete m.slots[gid];
    let slot = m.slots[id]?.slot ?? 0;
    const taken = new Set(live.map((g) => this.seat(g)?.slot));
    if (!slot || taken.has(slot)) {
      slot = 0;
      for (let s = 1; s <= MAX_GUESTS; s++) {
        const held = Object.entries(m.slots).some(([gid, v]) => gid !== id && v.slot === s);
        if (!taken.has(s) && !held) { slot = s; break; }
      }
    }
    if (!slot || live.length >= MAX_GUESTS) {
      this.ctx.acceptWebSocket(server, ['refused']);
      this.shut(server, FULL, 'the ranch is full');
      return new Response(null, { status: 101, webSocket: client });
    }
    m.slots[id] = { slot, seen: now };
    await this.setMeta(m);
    this.ctx.acceptWebSocket(server, ['guest', `slot:${slot}`]);
    server.serializeAttachment({ role: 'guest', id, name, slot } satisfies Seat);
    this.send(server, { t: 'welcome', role: 'guest', slot, host: hostHere });
    const h = this.host();
    if (h) this.send(h, { t: 'join', slot, id, name });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    const s = this.seat(ws);
    if (!s) return;
    if (typeof message === 'string') {
      // The host can close the ranch for everyone.
      if (s.role === 'host' && message.includes('"close"')) await this.closeRoom('the ranch closed');
      return;
    }
    if (message.byteLength < 1) return;
    const bytes = new Uint8Array(message);
    if (s.role === 'host') {
      const to = bytes[0];
      const list = to === 0 ? this.guests() : this.ctx.getWebSockets(`slot:${to}`);
      for (const g of list) {
        try {
          g.send(message);
        } catch {
          /* closing */
        }
      }
    } else {
      bytes[0] = s.slot;
      const h = this.host();
      if (h) {
        try {
          h.send(message);
        } catch {
          /* closing */
        }
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    const s = this.seat(ws);
    this.shut(ws, code === 1000 || (code >= 3000 && code < 5000) ? code : 1000, reason);
    if (!s || code === REPLACED) return;
    const m = await this.meta();
    // Replaced by a newer socket for the same player (a quick reconnect can
    // arrive before this close does): nothing has changed. Checked after
    // the read above, so a reconnect during it counts too.
    const others = this.ctx.getWebSockets(s.role).filter((o) => o !== ws);
    if (s.role === 'host' ? others.length > 0 : others.some((o) => this.seat(o)?.id === s.id)) return;
    if (!m) return;
    if (s.role === 'host') {
      if (code === CLOSED) {
        await this.closeRoom('the ranch closed');
        return;
      }
      // A drop: guests wait a little for the host to come back.
      m.hostGoneAt = Date.now();
      await this.setMeta(m);
      for (const g of this.guests()) this.send(g, { t: 'host-away' });
      await this.ctx.storage.setAlarm(Date.now() + HOST_GRACE_MS);
      return;
    }
    if (m.slots[s.id]) m.slots[s.id].seen = Date.now();
    await this.setMeta(m);
    const h = this.host();
    // A guest who left on purpose is gone; anyone else may be back soon.
    if (h) this.send(h, { t: 'leave', slot: s.slot, id: s.id, gone: code === CLOSED || code === 1000 });
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws, 1006, 'error');
  }

  // The host never came, or never came back.
  async alarm() {
    const m = await this.meta();
    if (this.host() && m && !m.hostGoneAt) return;
    await this.closeRoom('the ranch closed');
  }

  private async closeRoom(reason: string) {
    for (const g of this.guests()) this.shut(g, CLOSED, reason);
    for (const h of this.ctx.getWebSockets('host')) this.shut(h, CLOSED, reason);
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}
