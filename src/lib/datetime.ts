import { APP_TIMEZONE } from "./format";

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Converte o valor de <input type="datetime-local"> (horário de Brasília) em Date.
 * O Brasil não adota horário de verão desde 2019, então o offset é fixo em -03:00.
 */
export function fromLocalInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "yyyy-mm-ddThh:mm" no horário de Brasília (para inputs). */
export function toLocalInput(date: Date): string {
  return new Date(date.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
