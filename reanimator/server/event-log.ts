// An append-only event log with live listeners, ending at its first terminal event. The ritual's
// and the attack's SSE streams both replay from one of these (D-R15, D-R17).
export class EventLog<E> {
  private readonly log: E[] = [];
  private readonly listeners = new Set<(e: E, index: number) => void>();
  private ended = false;

  constructor(private readonly isTerminal: (e: E) => boolean) {}

  get done(): boolean {
    return this.ended;
  }

  push(e: E): void {
    if (this.ended) return;
    this.log.push(e);
    if (this.isTerminal(e)) this.ended = true;
    for (const fn of this.listeners) fn(e, this.log.length - 1);
  }

  // The events after index `after` (all of them when omitted).
  events(after = -1): { log: E[]; done: boolean } {
    return { log: this.log.slice(after + 1), done: this.ended };
  }

  subscribe(fn: (e: E, index: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  clear(): void {
    this.listeners.clear();
  }
}
