/*
  Tiny event bus so the (React-free) axios layer can tell the AuthProvider
  that the session is gone, without importing React.
*/
type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe to "session expired". Returns an unsubscribe function. */
export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSessionExpired() {
  listeners.forEach((l) => l());
}
