export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export type AppToast = {
  id: string;
  title: string;
  body: string;
  tone: ToastTone;
  createdAt: number;
};

type Listener = (toasts: AppToast[]) => void;

let toasts: AppToast[] = [];
const listeners = new Set<Listener>();
const MAX_TOASTS = 4;
const TTL_MS = 5200;

function emit() {
  listeners.forEach((l) => l(toasts.slice()));
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts.slice());
  return () => listeners.delete(listener);
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** In-app toast — never uses Windows Notification / OS balloons. */
export function showAppToast(
  title: string,
  body: string,
  tone: ToastTone = 'info'
): void {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  toasts = [{ id, title, body, tone, createdAt: Date.now() }, ...toasts].slice(0, MAX_TOASTS);
  emit();
  window.setTimeout(() => dismissToast(id), TTL_MS);
}
