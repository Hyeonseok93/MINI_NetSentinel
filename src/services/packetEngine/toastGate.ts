/** Rate-limited toast gate — presentation is injected (no UI import). */
export type ToastNotifier = (title: string, body: string) => void;

export class ToastGate {
  suppressUntil = 0;
  lastAt = 0;
  dropped = 0;
  private notifier: ToastNotifier | null = null;

  setNotifier(notifier: ToastNotifier | null) {
    this.notifier = notifier;
  }

  muteFor(ms: number) {
    this.suppressUntil = Date.now() + ms;
    this.dropped = 0;
  }

  notify(enabled: boolean, title: string, body: string) {
    if (!enabled || !this.notifier) return;
    const now = Date.now();
    if (now < this.suppressUntil) {
      this.dropped += 1;
      return;
    }
    if (now - this.lastAt < 20_000) {
      this.dropped += 1;
      return;
    }
    this.lastAt = now;
    const extra = this.dropped > 0 ? ` (+${this.dropped} more suppressed)` : '';
    this.dropped = 0;
    this.notifier(title, `${body}${extra}`);
  }
}
