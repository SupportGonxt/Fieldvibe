/**
 * CallRoom — Durable Object signaling hub for one voice call (keyed by callId).
 * Relays JSON signaling messages {type: offer|answer|ice|bye} between the two
 * WebRTC peers. Media flows P2P; only SDP+ICE pass through here. Max 2 sockets.
 */
export class CallRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
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

    server.addEventListener('message', (evt) => {
      // Fan out to the other peer only (2-socket room, so "everyone else").
      for (const s of this.sockets) {
        if (s !== server) {
          try { s.send(evt.data); } catch { /* peer gone; drop */ }
        }
      }
    });

    const close = () => {
      this.sockets.delete(server);
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
