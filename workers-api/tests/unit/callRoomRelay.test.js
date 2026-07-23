import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CallRoom } from '../../src/durable/CallRoom.js';

// CallRoom.fetch() leans on two workers-runtime globals that don't exist (or
// reject status 101) in node: WebSocketPair and Response. Stub both so we can
// drive real signaling through the relay and assert fan-out / bye / busy.

class FakeSocket {
  constructor() { this.sent = []; this.listeners = {}; this.accepted = false; }
  accept() { this.accepted = true; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  send(data) { this.sent.push(data); }
  dispatch(type, evt) { for (const fn of this.listeners[type] || []) fn(evt); }
}

let servers;
const realWSPair = globalThis.WebSocketPair;
const realResponse = globalThis.Response;

beforeEach(() => {
  servers = [];
  globalThis.WebSocketPair = function () {
    const client = new FakeSocket();
    const server = new FakeSocket();
    servers.push(server);
    return { 0: client, 1: server };
  };
  globalThis.Response = class {
    constructor(body, init = {}) { this.body = body; this.status = init.status ?? 200; this.webSocket = init.webSocket; }
  };
});

afterEach(() => {
  globalThis.WebSocketPair = realWSPair;
  globalThis.Response = realResponse;
});

function wsRequest() {
  return { headers: { get: (h) => (h === 'Upgrade' ? 'websocket' : null) } };
}

describe('CallRoom signaling relay', () => {
  it('rejects non-websocket requests', async () => {
    const room = new CallRoom({}, {});
    const res = await room.fetch({ headers: { get: () => null } });
    expect(res.status).toBe(426);
  });

  it('fans a message out to the other peer only', async () => {
    const room = new CallRoom({}, {});
    await room.fetch(wsRequest()); // peer A
    await room.fetch(wsRequest()); // peer B
    const [a, b] = servers;

    a.dispatch('message', { data: '{"type":"offer"}' });
    expect(b.sent).toEqual(['{"type":"offer"}']);
    expect(a.sent).toEqual([]); // never echoed back to sender
  });

  it('tells the remaining peer bye when the other closes', async () => {
    const room = new CallRoom({}, {});
    await room.fetch(wsRequest());
    await room.fetch(wsRequest());
    const [a, b] = servers;

    a.dispatch('close', {});
    expect(b.sent).toEqual([JSON.stringify({ type: 'bye', reason: 'peer_left' })]);
  });

  it('returns busy (409) for a third peer', async () => {
    const room = new CallRoom({}, {});
    await room.fetch(wsRequest());
    await room.fetch(wsRequest());
    const res = await room.fetch(wsRequest());
    expect(res.status).toBe(409);
  });

  // The caller connects and sends its offer while the callee is still looking
  // at the ring notification — the room must hold it for the late joiner.
  it('replays signaling sent before the second peer joined', async () => {
    const room = new CallRoom({}, {});
    await room.fetch(wsRequest()); // caller
    const [a] = servers;
    a.dispatch('message', { data: '{"type":"offer"}' });
    a.dispatch('message', { data: '{"type":"ice","candidate":1}' });

    await room.fetch(wsRequest()); // callee joins after the fact
    const b = servers[1];
    expect(b.sent).toEqual(['{"type":"offer"}', '{"type":"ice","candidate":1}']);
  });

  it('never buffers bye, and clears the buffer when the room empties', async () => {
    const room = new CallRoom({}, {});
    await room.fetch(wsRequest());
    const [a] = servers;
    a.dispatch('message', { data: '{"type":"offer"}' });
    a.dispatch('message', { data: '{"type":"bye"}' }); // to nobody — dropped
    a.dispatch('close', {});                            // room empty — buffer cleared

    await room.fetch(wsRequest());
    expect(servers[1].sent).toEqual([]);
  });

  it('broadcasts POST /notify payloads to connected peers', async () => {
    const room = new CallRoom({}, {});
    await room.fetch(wsRequest());
    const [a] = servers;

    const payload = JSON.stringify({ type: 'bye', reason: 'declined' });
    const res = await room.fetch({
      method: 'POST',
      url: 'https://call-room/notify',
      headers: { get: () => null },
      text: async () => payload,
    });
    expect(res.status).toBe(200);
    expect(a.sent).toEqual([payload]);
  });
});
