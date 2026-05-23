import { EventEmitter } from "node:events";

export interface SseClient {
  id: string;
  send: (event: string, data: unknown) => void;
}

const emitter = new EventEmitter();
// Avoid Node's default MaxListenersExceededWarning for large subscriber counts.
emitter.setMaxListeners(0);

const clients = new Map<string, SseClient>();

export function subscribe(client: SseClient): () => void {
  clients.set(client.id, client);

  const listener = (event: string, data: unknown) => {
    client.send(event, data);
  };
  emitter.on("publish", listener);

  return () => {
    clients.delete(client.id);
    emitter.off("publish", listener);
  };
}

export function publish(event: string, data: unknown): void {
  emitter.emit("publish", event, data);
}

export function subscriberCount(): number {
  return clients.size;
}
