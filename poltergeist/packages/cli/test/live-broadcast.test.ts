import type { SummonEvent } from '@poltergeist/core';
import { describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { createLiveBroadcast } from '../src/live-broadcast.js';

function fakeWs(bufferedAmount = 0) {
  const handlers = new Map<string, () => void>();
  const ws = {
    readyState: 1,
    bufferedAmount,
    send: vi.fn(),
    on: (ev: string, fn: () => void) => void handlers.set(ev, fn),
    close: vi.fn(),
    terminate: vi.fn(),
  };
  const types = () => ws.send.mock.calls.map(([s]) => (JSON.parse(String(s)) as { type: string; seq?: number }));
  return { ws, socket: ws as unknown as WebSocket, types, emit: (ev: string) => handlers.get(ev)?.() };
}

const started = { type: 'run.started', t: 0, runId: 'r1', runDir: '.', specDir: 'claims', target: 'http://127.0.0.1:1', criteria: ['3.2'], personas: ['wraith'], reps: 1 } as SummonEvent;
const spawned = { type: 'ghost.spawned', ghostId: 'g', criterion: '3.2', persona: 'wraith', rep: 1, actor: 'a', t: 2 } as SummonEvent;
const frame = (seq: number) => ({ type: 'ghost.frame', ghostId: 'g', seq, jpegBase64: 'AA==', t: 3 + seq }) as SummonEvent;
const repDone = { type: 'rep.finished', rep: 1, outcomes: { completed: 1, timeout: 0, planError: 0, systemError: 0 }, t: 9 } as SummonEvent;

describe('createLiveBroadcast', () => {
  it('sends a late joiner the hello, then the backlog with only the latest frame', () => {
    const b = createLiveBroadcast('r1');
    for (const e of [started, spawned, frame(0), frame(1)]) b.publish(e);
    const c = fakeWs();
    b.attach(c.socket);
    expect(c.types().map((m) => m.type)).toEqual(['live.hello', 'run.started', 'ghost.spawned', 'ghost.frame']);
    expect(c.types()[3]!.seq).toBe(1);
    expect(b.clientCount()).toBe(1);
  });

  it('skips frames for a backed-up client but never other events', () => {
    const b = createLiveBroadcast('r1', { maxBuffered: 10 });
    const c = fakeWs(11);
    b.attach(c.socket);
    for (const e of [spawned, frame(0), repDone]) b.publish(e);
    expect(c.types().map((m) => m.type)).toEqual(['live.hello', 'ghost.spawned', 'rep.finished']);
  });

  it('forgets a client once it closes, and closeAll closes the rest', () => {
    const b = createLiveBroadcast('r1');
    const gone = fakeWs();
    const stays = fakeWs();
    b.attach(gone.socket);
    b.attach(stays.socket);
    gone.emit('close');
    expect(b.clientCount()).toBe(1);
    b.closeAll(1001, 'evicted');
    expect(stays.ws.close).toHaveBeenCalledWith(1001, 'evicted');
  });
});
