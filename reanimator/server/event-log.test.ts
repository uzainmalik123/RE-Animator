import { describe, expect, it } from 'vitest';
import { EventLog } from './event-log.js';

describe('EventLog', () => {
  it('slices after an index, ends on a terminal event and ignores later pushes', () => {
    const log = new EventLog<number>((n) => n === 3);
    const seen: Array<[number, number]> = [];
    log.subscribe((e, i) => seen.push([e, i]));
    log.push(1);
    log.push(2);
    log.push(3);
    log.push(4);
    expect(log.events(0)).toEqual({ log: [2, 3], done: true });
    expect(log.done).toBe(true);
    expect(seen).toEqual([[1, 0], [2, 1], [3, 2]]);
  });

  it('stops notifying after unsubscribe or clear', () => {
    const log = new EventLog<number>(() => false);
    const seen: number[] = [];
    const off = log.subscribe((e) => seen.push(e));
    log.push(1);
    off();
    log.push(2);
    log.subscribe((e) => seen.push(e));
    log.clear();
    log.push(3);
    expect(seen).toEqual([1]);
    expect(log.events().log).toEqual([1, 2, 3]);
  });
});
