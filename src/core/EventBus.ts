type Handler<T> = (payload: T) => void;

/** Tiny typed pub/sub. Used by the scene model, selection, history and services. */
export class EventBus<E extends object> {
  private readonly handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const h = handler as Handler<never>;
    set.add(h);
    return () => {
      set.delete(h);
    };
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    this.handlers.get(type)?.forEach((h) => (h as Handler<E[K]>)(payload));
  }
}
