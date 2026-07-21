/**
 * CallRoom — Durable Object signaling hub for one voice call (keyed by callId).
 * Relays JSON signaling messages {type: offer|answer|ice|bye} between the two
 * WebRTC peers. Media flows P2P; only SDP+ICE pass through here. Max 2 sockets.
 *
 * The caller connects (and sends its offer) while the callee is still looking
 * at the ring notification, so messages with no recipient are buffered and
 * replayed when the second peer joins — without this the offer is lost and the
 * call can never connect. 'bye' is never buffered: it targets a live peer, and
 * a stale one would kill the next join.
 *
 * Non-WS POST /notify broadcasts a JSON payload to every connected socket —
 * lets REST lifecycle endpoints (decline/end) reach the waiting caller.
 */
const MAX_PENDING = 64; // offer + a realistic ICE trickle; drop beyond this

export class CallRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
    this.pending = [];
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      if (request.method === 'POST' && new URL(request.url).pathname === '/notify') {
        const payload = await request.text();
        for (const s of this.sockets) {
          try { s.send(payload); } catch { /* peer gone; drop */ }
        }
        return new Response('ok');
      }
      return new Response('Expected WebSocket', { status: 426 });
    }
    // ponytail: hard cap 2 peers per room; third caller gets busy, no queue.
    if (this.sockets.size >= 2) {
      return new Response('busy', { status: 409 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    this.sockets.add(server);

    // Late joiner: replay the signaling sent while they weren't here yet.
    if (this.sockets.size === 2 && this.pending.length) {
      for (const m of this.pending) {
        try { server.send(m); } catch { /* joiner already gone */ }
      }
      this.pending = [];
    }

    server.addEventListener('message', (evt) => {
      // Fan out to the other peer only (2-socket room, so "everyone else").
      let delivered = false;
      for (const s of this.sockets) {
        if (s !== server) {
          try { s.send(evt.data); delivered = true; } catch { /* peer gone; drop */ }
        }
      }
      if (!delivered && this.pending.length < MAX_PENDING) {
        try {
          if (JSON.parse(evt.data)?.type !== 'bye') this.pending.push(evt.data);
        } catch { /* non-JSON; drop */ }
      }
    });

    const close = () => {
      this.sockets.delete(server);
      if (this.sockets.size === 0) this.pending = [];
      // Tell the remaining peer the other side left.
      for (const s of this.sockets) {
        try { s.send(JSON.stringify({ type: 'bye', reason: 'peer_left' })); } catch { /* ignore */ }
      }
    };
    server.addEventListener('close', close);
    server.addEventListener('error', close);

    return new Response(null, { status: 101, webSocket: client });
  }
}
