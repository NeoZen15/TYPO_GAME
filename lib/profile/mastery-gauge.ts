// The training screen's progression indicator, as a whole percent.
//
// WHY A GAUGE AND NOT A COUNT. The screen used to print `facesMastered /
// poolSize`, counting only faces that had reached the top of a 0 to 4 scale
// that rises by at most one per first attempt correct answer, on faces
// deliberately spaced apart. Four correct sightings of the same face were
// needed before the number moved by one, so a first session read 0 / 30 and
// could not move. This reads the whole ladder instead of its last rung, so
// every first attempt success shows.
//
// Spec §15 / N-24 keeps the global eye level off the game screen. This is not
// that level: it is the state of the player's own set, and it says nothing
// about a rank.
//
// Free of runtime imports so `check:mastery-gauge` can exercise it directly.

// mastery_level runs 0..4 (db/migrations/003_users_sessions_pool.sql, CHECK
// mastery_level BETWEEN 0 AND 4). Read from there, never widened here.
export const MAX_MASTERY_LEVEL = 4;

/**
 * Share of the ladder the player's set has climbed, 0 to 100.
 *
 * KNOWN CEILING, stated rather than discovered later. A whole percent stops
 * resolving a single answer once the pool passes a few hundred faces: at 400
 * faces one success is 0.06 percent, so it takes a handful of answers to turn
 * the number over. A twenty answer session still moves it at that size, which
 * is what the guard pins. Should a player's pool ever reach the full catalogue,
 * this needs a decimal or a different scale.
 */
export const setMasteryPercent = (masteryLevels: number[]): number => {
  if (masteryLevels.length === 0) return 0;

  const ceiling = masteryLevels.length * MAX_MASTERY_LEVEL;
  const climbed = masteryLevels.reduce((sum, level) => sum + level, 0);

  return Math.round((climbed / ceiling) * 100);
};
