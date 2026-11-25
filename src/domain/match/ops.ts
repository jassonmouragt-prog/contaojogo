import { z } from "zod";
import { EVENT_TYPES, PLAY_KINDS } from "@/db/schema/match-ops";

const id = z.string().min(8).max(64);
const stats = z.object({ shots: z.number().int(), shotsOnTarget: z.number().int(), corners: z.number().int(), offsides: z.number().int() });

/** Operações que o operador gera (online ou na fila offline). */
export const matchOpSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("clock"), clientOpId: id, at: z.number(), command: z.enum(["KICK_OFF", "PAUSE", "RESUME", "END_PERIOD"]) }),
  z.object({
    kind: z.literal("event"), clientOpId: id, at: z.number(), type: z.enum(EVENT_TYPES), teamId: z.uuid(), athleteId: z.uuid().nullable(),
    minute: z.number().int().min(0).max(200), ownGoal: z.boolean().optional(), penalty: z.boolean().optional(),
    assistAthleteId: z.uuid().nullable().optional(), playerOutId: z.uuid().nullable().optional(),
  }),
  z.object({ kind: z.literal("void"), clientOpId: id, at: z.number(), targetClientOpId: id }),
  z.object({ kind: z.literal("play"), clientOpId: id, at: z.number(), teamId: z.uuid(), play: z.enum(PLAY_KINDS), x: z.number().int().min(0).max(1000), y: z.number().int().min(0).max(600) }),
  z.object({ kind: z.literal("stats"), clientOpId: id, at: z.number(), home: stats, away: stats }),
]);
export type MatchOp = z.infer<typeof matchOpSchema>;
