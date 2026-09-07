/**
 * In-app confirm dialogs for the React renderer (ConfirmHost).
 * Main-process / pre-window prompts use Electron showAppDialog instead —
 * keep both: renderer cannot show OS-styled dialogs before the window exists.
 */
export type ConfirmTone = 'default' | 'warning' | 'danger';

export type ConfirmRequest = {
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmState = ConfirmRequest & {
  resolve: (ok: boolean) => void;
};

type Listener = (state: ConfirmState | null) => void;

let current: ConfirmState | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(current));
}

export function subscribeConfirm(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

/** In-app confirm — never uses window.confirm / OS dialogs. */
export function askConfirm(req: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    if (current) {
      current.resolve(false);
    }
    current = {
      ...req,
      resolve: (ok) => {
        current = null;
        emit();
        resolve(ok);
      },
    };
    emit();
  });
}

export function settleConfirm(ok: boolean) {
  if (!current) return;
  current.resolve(ok);
}
