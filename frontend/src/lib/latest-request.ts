// Also checks identity when a transport resolves despite cancellation.
export class LatestRequest {
  private controller?: AbortController;
  begin() {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    return { signal: controller.signal, current: () => this.controller === controller && !controller.signal.aborted };
  }
  cancel() { this.controller?.abort(); }
}

export function suggestionIndex(key: string, current: number, count: number): number {
  if (!count) return -1;
  if (key === 'ArrowDown') return (current + 1) % count;
  if (key === 'ArrowUp') return current < 0 ? count - 1 : (current - 1 + count) % count;
  return current;
}
