import "server-only";

import { sql } from "@/lib/server/neon";
import type { EyeProfile } from "@/lib/profile/mock-profile";
import { PALIER_TAXONOMY, type TypefaceAttrs } from "@/lib/profile/palier-taxonomy";
import {
  MISSION_TARGET_DEFAULT,
  buildObjectives,
  type ConfusionRow,
  type ObjectiveFace,
  type ObjectivePalier,
  type Objectives,
} from "@/lib/profile/objectives";
import { RUNTIME_ALLOWED_LICENSE_TYPES, UFL_LEGACY_SLUGS } from "@/lib/game/license-guard";
import { LATIN_UNREADY_SLUGS } from "@/lib/game/latin-coverage-guard";

// The reads behind the three objectives of the Path (tranche 3 of
// docs/product/spec-objectifs-joueur.md). lib/profile/objectives.ts chooses and
// stays pure; this module only fetches what it needs and hands it over.
//
// PERSONAL DATA ONLY (I-27). Every read below is keyed on the player alone.
// Nothing touches assignments, assignment_recipients or a class, and the fact
// table is read in context 'personal' only: a devoir played in class neither
// feeds Fix nor fills the daily mission, the wall is one way in both directions.
//
// A separate module on purpose, next to lib/profile/profile-stats.ts rather than
// inside it: the eye is computed there, and the page hands it here, so the
// paliers the cards speak of are exactly the ones the map shows.
//
// NEVER FATAL. Any read error gives null and a log line, and the page renders
// without the band. The log carries the error's name and code, never its
// message: the Neon driver can put the whole connection string in there.

const queryRows = async <T>(query: Promise<unknown>) => (await query) as T[];

/** What the client receives. Plain data, serialisable across the server boundary. */
export type ObjectivesData = {
  objectives: Objectives;
  /** Display names of the faces the chosen pairs name, keyed by slug. */
  names: Record<string, string>;
};

type ConfusionDbRow = { asked: string; answered: string; count: number };
type TodayRow = { good_first_tries: number };
type FaceRow = {
  typeface_slug: string;
  due: boolean;
  primary_category: string;
  sub_category: string;
  aperture_profile: string;
  contrast_profile: string;
};
type NameRow = { typeface_slug: string; display_name: string };

const PALIER_IDS = Object.keys(PALIER_TAXONOMY);

/** The paliers of the map, flattened, roadmap ones left out: they can never be proposed. */
const paliersOf = (eye: EyeProfile): ObjectivePalier[] =>
  eye.axes.flatMap((axis) =>
    axis.paliers
      .filter((p) => !p.roadmap)
      .map((p) => ({ id: p.id, label: p.label, state: p.state, a: p.a, mastered: p.mastered })),
  );

/** Same attribute mapping as buildEye in profile-stats.ts, through the same predicates. */
const paliersOfFace = (attrs: TypefaceAttrs): string[] =>
  PALIER_IDS.filter((id) => PALIER_TAXONOMY[id](attrs));

const logFailure = (error: unknown) => {
  const name = error instanceof Error ? error.name : typeof error;
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "none";
  console.error(`[profile] objectives unavailable, band hidden (${name}, code ${code})`);
};

export async function loadObjectives(userId: string, eye: EyeProfile): Promise<ObjectivesData | null> {
  try {
    const allowedLicenses = [...RUNTIME_ALLOWED_LICENSE_TYPES];
    const legacySlugs = [...UFL_LEGACY_SLUGS];
    const latinUnready = [...LATIN_UNREADY_SLUGS];

    const [confusionRows, todayRows, faceRows] = await Promise.all([
      // Wrong first answers with the face asked and the face chosen, personal
      // context only. Both faces must still be servable, the same four filters
      // as getPoolRows in the training provider: a pair whose face has left the
      // catalog cannot be served, so the card must not promise it.
      queryRows<ConfusionDbRow>(sql`
        SELECT e.typeface_slug AS asked, e.answer_slug AS answered, COUNT(*)::int AS count
        FROM user_event_fact e
        JOIN typefaces_core ta ON ta.typeface_slug = e.typeface_slug
        JOIN typefaces_core tb ON tb.typeface_slug = e.answer_slug
        WHERE e.user_id = ${userId}::uuid
          AND e.event_type = 'answer'
          AND e.is_correct = false
          AND e.answer_slug IS NOT NULL
          AND e.context = 'personal'
          AND e.attempt_index = 1
          AND ta.activation_status = true AND tb.activation_status = true
          AND (ta.license_type::text = ANY(${allowedLicenses}::text[]) OR ta.typeface_slug = ANY(${legacySlugs}::text[]))
          AND (tb.license_type::text = ANY(${allowedLicenses}::text[]) OR tb.typeface_slug = ANY(${legacySlugs}::text[]))
          AND ta.typeface_slug <> ALL(${latinUnready}::text[])
          AND tb.typeface_slug <> ALL(${latinUnready}::text[])
        GROUP BY e.typeface_slug, e.answer_slug`),
      // Today's good first answers, personal context only. Same Paris day
      // expression as the daily goal in profile-stats.ts, compared inline so the
      // mission and the rest of the profile agree on where the day starts.
      queryRows<TodayRow>(sql`
        SELECT COUNT(*)::int AS good_first_tries
        FROM user_event_fact
        WHERE user_id = ${userId}::uuid AND event_type = 'answer'
          AND attempt_index = 1 AND is_correct
          AND context = 'personal'
          AND to_char((event_ts_utc AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD')
              = to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD')`),
      // The active pool as the engine would serve it (same four filters as
      // getPoolRows), each face with whether a review is due now, against the
      // player's own question counter.
      queryRows<FaceRow>(sql`
        SELECT uts.typeface_slug,
               (uts.next_due_after_q <= COALESCE(u.global_q_index, 0)) AS due,
               tc.primary_category::text AS primary_category,
               tc.sub_category::text AS sub_category,
               tc.aperture_profile::text AS aperture_profile,
               tc.contrast_profile::text AS contrast_profile
        FROM user_typeface_state uts
        JOIN typefaces_core tc ON tc.typeface_slug = uts.typeface_slug
        LEFT JOIN users u ON u.user_id = uts.user_id
        WHERE uts.user_id = ${userId}::uuid
          AND uts.in_active_pool = true
          AND tc.activation_status = true
          AND (tc.license_type::text = ANY(${allowedLicenses}::text[]) OR tc.typeface_slug = ANY(${legacySlugs}::text[]))
          AND tc.typeface_slug <> ALL(${latinUnready}::text[])`),
    ]);

    const faces: ObjectiveFace[] = faceRows.map((r) => ({
      slug: r.typeface_slug,
      paliers: paliersOfFace({
        primary: r.primary_category,
        sub: r.sub_category,
        aperture: r.aperture_profile,
        contrast: r.contrast_profile,
      }),
      inPool: true,
      due: r.due === true,
    }));

    const confusions: ConfusionRow[] = confusionRows.map((r) => ({
      asked: r.asked,
      answered: r.answered,
      count: r.count,
    }));

    const objectives = buildObjectives({
      paliers: paliersOf(eye),
      derivable: PALIER_IDS,
      faces,
      confusions,
      todayCorrectPersonal: todayRows[0]?.good_first_tries ?? 0,
      missionTarget: MISSION_TARGET_DEFAULT,
    });

    // Names for the faces the chosen pairs name, and those only.
    const slugs = [...new Set(objectives.fix.pairs.flatMap((p) => [p.asked, p.answered]))];
    const nameRows =
      slugs.length > 0
        ? await queryRows<NameRow>(sql`
            SELECT typeface_slug, display_name FROM typefaces_core
            WHERE typeface_slug = ANY(${slugs}::text[])`)
        : [];
    const names: Record<string, string> = {};
    for (const r of nameRows) names[r.typeface_slug] = r.display_name;

    return { objectives, names };
  } catch (error) {
    logFailure(error);
    return null;
  }
}
