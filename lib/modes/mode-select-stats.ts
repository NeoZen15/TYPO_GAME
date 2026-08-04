import "server-only";

import { sql } from "@/lib/server/neon";

// The three numbers that decide which mode a player opens.
//
// The mode select page used to show what each mode IS (pool size, round length,
// how many answer keys exist). None of that helps someone choose: it describes the
// product, not the player's situation. What decides a click is what is waiting for
// you, and how you did last time.
//
// - Training: how many faces are due RIGHT NOW. Personal, actionable, and the only
//   figure on the page that expires. It is the same eligibility test the question
//   builder uses (next_due_after_q <= users.global_q_index, see
//   lib/game/training/provider.ts), so the count cannot promise a question the
//   engine would refuse to serve.
// - Competition: your best score. A timed mode is opened to beat something, and
//   without a personal best there is nothing to beat.
// - Expert: nothing to read, it is gated by how many answer keys a human has
//   approved, which is a property of the catalogue and not of the player.
//
// Three cheap reads, no fan-out: this runs on a page that renders on every visit.

export type ModeSelectStats = {
  /** Faces the engine would serve immediately. 0 means nothing is overdue. */
  trainingDueNow: number;
  /** Faces in the active pool, due or not. */
  trainingPoolSize: number;
  /** Highest completed competition score, 0 when no round was ever finished. */
  competitionBest: number;
  /** Completed competition rounds, so a first-timer is not shown a best of zero. */
  competitionRounds: number;
};

const queryRows = async <T>(query: Promise<unknown>) => (await query) as T[];

export async function loadModeSelectStats(userId: string): Promise<ModeSelectStats> {
  const [pool, competition] = await Promise.all([
    // in_active_pool is part of the test on purpose: a state row can exist for a
    // face that has left the pool, and the builder only ever draws from the pool.
    queryRows<{ due: number; total: number }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE uts.next_due_after_q <= u.global_q_index)::int AS due,
        COUNT(*)::int AS total
      FROM user_typeface_state uts
      JOIN users u ON u.user_id = uts.user_id
      WHERE uts.user_id = ${userId}::uuid AND uts.in_active_pool = true`),
    // Abandoned rounds are excluded: a round the player walked out of is not a
    // score they set, and showing it as their best would be a lie in their favour.
    queryRows<{ best: number; rounds: number }>(sql`
      SELECT COALESCE(MAX(score), 0)::int AS best, COUNT(*)::int AS rounds
      FROM sessions
      WHERE user_id = ${userId}::uuid AND mode = 'competition' AND status = 'completed'`),
  ]);

  return {
    trainingDueNow: pool[0]?.due ?? 0,
    trainingPoolSize: pool[0]?.total ?? 0,
    competitionBest: competition[0]?.best ?? 0,
    competitionRounds: competition[0]?.rounds ?? 0,
  };
}
