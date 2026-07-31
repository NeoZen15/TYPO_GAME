// Statement-level, no runtime import at all, so Node can strip its types and
// load this module directly, the same constraint lib/game/training/session-summary.ts
// respects (see scripts/quality/check-session-lifecycle.mjs).
//
// Pure day-key arithmetic. Every key here is a calendar day already resolved
// to Europe/Paris by SQL (to_char((... AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD')).
// This module never converts a timezone: it only enumerates consecutive
// calendar days on text keys, so Date.UTC is safe to use as a plain calendar
// counter, not as a timezone conversion.

/** Jour calendaire précédent une clé YYYY-MM-DD. Arithmétique sur une date déjà résolue. */
const previousDayKey = (key: string): string => {
  const [y, m, d] = key.split("-").map(Number);
  const stamp = Date.UTC(y, m - 1, d) - 86_400_000;
  return new Date(stamp).toISOString().slice(0, 10);
};

/** Nombre de réponses par jour, du plus ancien au plus récent, index final = aujourd'hui. */
export const buildActivityWindow = (
  dayKeys: readonly string[],
  todayKey: string,
  windowDays: number
): number[] => {
  const counts = new Map<string, number>();
  for (const key of dayKeys) counts.set(key, (counts.get(key) ?? 0) + 1);

  const window: number[] = [];
  let cursor = todayKey;
  for (let i = 0; i < windowDays; i += 1) {
    window.unshift(counts.get(cursor) ?? 0);
    cursor = previousDayKey(cursor);
  }
  return window;
};

/** Série en cours. Un jour non encore joué ne la casse pas, règle conservée de l'existant. */
export const streakFromDayKeys = (dayKeys: readonly string[], todayKey: string): number => {
  const played = new Set(dayKeys);
  let cursor = played.has(todayKey) ? todayKey : previousDayKey(todayKey);
  let streak = 0;
  while (played.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
};

/** Plus longue série de jours consécutifs jamais atteinte. */
export const longestRunFromDayKeys = (dayKeys: readonly string[]): number => {
  const played = new Set(dayKeys);
  let best = 0;
  for (const key of played) {
    if (played.has(previousDayKey(key))) continue; // pas un début de série
    let run = 0;
    let cursor = key;
    while (played.has(cursor)) {
      run += 1;
      // avance d'un jour : deux reculs depuis le lendemain seraient faux, on repart de la clé
      const [y, m, d] = cursor.split("-").map(Number);
      cursor = new Date(Date.UTC(y, m - 1, d) + 86_400_000).toISOString().slice(0, 10);
    }
    best = Math.max(best, run);
  }
  return best;
};
