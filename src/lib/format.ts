export const APP_TIMEZONE = "America/Sao_Paulo";

/** 2538000 → "42:18". Minutos podem passar de 59 (ex.: "92:05"). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Data/hora no padrão dos cartões do PDF: "20 NOV • 18:30". */
export function formatMatchDate(date: Date, timeZone: string = APP_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const month = get("month").replace(".", "").toUpperCase();
  return `${get("day")} ${month} • ${get("hour")}:${get("minute")}`;
}

/** Placar no formato "2 - 1". */
export function formatScore(home: number, away: number): string {
  return `${home} - ${away}`;
}

/** "yyyy-mm-dd" da data no fuso informado. */
export function toLocalDay(date: Date, timeZone: string = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Lista de dias ao redor de `center` (yyyy-mm-dd), inclusive. */
export function dayRange(center: string, before: number, after: number): string[] {
  const base = new Date(`${center}T12:00:00Z`).getTime();
  const out: string[] = [];
  for (let i = -before; i <= after; i++) {
    out.push(new Date(base + i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/** Início do dia (00:00 em Brasília, UTC-3 fixo) de um "yyyy-mm-dd". */
export function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00-03:00`);
}
