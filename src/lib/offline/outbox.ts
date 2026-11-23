"use client";

import type { MatchOp } from "@/domain/match/ops";

/**
 * Fila persistente (IndexedDB) das operações do operador. Sobrevive a quedas
 * de internet e a recarregar a página; cada item é removido só depois que o
 * servidor confirma (aplicado, duplicado ou recusado).
 */
export type QueuedOp = MatchOp & { matchId: string; seq: number };

const DB = "contaojogo-operador";
const STORE = "outbox";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "clientOpId" });
      store.createIndex("byMatch", "matchId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { resolve(req ? (req.result as T) : undefined); db.close(); };
    t.onerror = () => { reject(t.error); db.close(); };
  });
}

export async function enqueue(op: QueuedOp) {
  await tx("readwrite", (s) => { s.put(op); });
}

export async function listQueued(matchId: string): Promise<QueuedOp[]> {
  const rows = (await tx<QueuedOp[]>("readonly", (s) => s.index("byMatch").getAll(matchId))) ?? [];
  return rows.sort((a, b) => a.seq - b.seq);
}

export async function removeQueued(ids: string[]) {
  if (!ids.length) return;
  await tx("readwrite", (s) => { ids.forEach((id) => s.delete(id)); });
}

export function newOpId(): string {
  return crypto.randomUUID();
}
