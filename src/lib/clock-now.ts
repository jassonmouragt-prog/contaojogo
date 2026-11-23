import "server-only";
import { connection } from "next/server";

/** Horário da requisição (marca a renderização como dinâmica). */
export async function requestNow(): Promise<number> {
  await connection();
  return Date.now();
}
