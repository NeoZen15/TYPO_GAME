"use client";

import Link from "next/link";
import { objectivesCopy } from "@/content/copy";
import { BOARD_SYSTEM_CSS, CREAM, MODE_ACCENT } from "@/features/profile/components/board-system";
import { focusToParam, type TrainingFocus } from "@/lib/game/training/focus";
import type { ObjectivesData } from "@/lib/profile/objectives-data";

// The player's three objectives, on the Path, right under the teacher's band.
// Spec: docs/product/spec-objectifs-joueur.md, section 6.
//
// ALWAYS THE THREE, IN THIS ORDER: Light, Fix, Daily mission. The map says where
// the player stands; this says what to do now, and each row carries a button
// that keeps its promise. Light and Fix send their focus to /game in ?focus=,
// the mission sends nothing, because it steers nothing.
//
// NO ART DIRECTION OF ITS OWN, the discipline of AssignedBand next door: the
// panel, the mode chip, the list and the button are the shared system's, and the
// only local values are the row's own columns, copied from DEVOIR_CSS.
//
// The state is said in words, never in a colour: red and green belong to the
// game. The chips all carry the training accent because every row starts a
// training session. A step never names a typeface.
//
// Renders nothing when the data could not be read: the page stays whole.

const gameHref = (focus: TrainingFocus | null) =>
  focus ? `/game?focus=${encodeURIComponent(focusToParam(focus))}` : "/game";

const percent = (a: number) => Math.round(a * 100);

type Row = { key: string; chip: string; title: string; meta: string; href: string };

export default function ObjectivesBand({ data }: { data: ObjectivesData | null | undefined }) {
  if (!data) return null;
  const { light, fix, mission } = data.objectives;
  const nameOf = (slug: string) => data.names[slug] ?? slug;

  const lightRow: Row =
    light.palierId && light.label
      ? {
          key: "light",
          chip: light.mode === "maintain" ? objectivesCopy.maintainChip : objectivesCopy.lightChip,
          title: light.label,
          meta:
            light.mode === "maintain"
              ? objectivesCopy.maintainMeta(light.palierId, light.mastered, light.masteredTarget, percent(light.a))
              : objectivesCopy.lightMeta(light.palierId, light.mastered, light.masteredTarget, percent(light.a)),
          href: gameHref(light.focus),
        }
      : {
          key: "light",
          chip: objectivesCopy.lightChip,
          title: objectivesCopy.lightEmptyTitle,
          meta: objectivesCopy.lightEmptyMeta,
          href: gameHref(null),
        };

  const top = fix.pairs[0] ?? null;
  const fixRow: Row = top
    ? {
        key: "fix",
        chip: objectivesCopy.fixChip,
        title: objectivesCopy.fixTitle(nameOf(top.asked), nameOf(top.answered)),
        meta: objectivesCopy.fixMeta(top.count, fix.pairs.length),
        href: gameHref(fix.focus),
      }
    : {
        key: "fix",
        chip: objectivesCopy.fixChip,
        title: objectivesCopy.fixEmptyTitle,
        meta: objectivesCopy.fixEmptyMeta,
        href: gameHref(null),
      };

  // Reaching the target changes the words, never the button: a session does not
  // stop on a counter (I-17), and the mission does not either.
  const missionRow: Row = {
    key: "mission",
    chip: objectivesCopy.missionChip,
    title: objectivesCopy.missionTitle(mission.target),
    meta: mission.reached
      ? objectivesCopy.missionDoneMeta(mission.done, mission.target)
      : objectivesCopy.missionMeta(mission.done, mission.target),
    href: gameHref(null),
  };

  const accent = MODE_ACCENT.training ?? "var(--pf-cream)";

  return (
    <section className="st pf-goal" aria-label={objectivesCopy.bandLabel}>
      <style dangerouslySetInnerHTML={{ __html: BOARD_SYSTEM_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: GOAL_CSS }} />

      <div className="st-panel">
        <div className="st-panel__head">
          <h2 className="st-panel__title">{objectivesCopy.title}</h2>
          <span className="st-panel__meta">{objectivesCopy.meta}</span>
        </div>

        <ul className="st-rows">
          {[lightRow, fixRow, missionRow].map((row) => (
            <li key={row.key} className="pf-goal__row">
              <span
                className="st-session__mode"
                style={{
                  borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`,
                  color: `color-mix(in srgb, ${accent} 62%, var(--pf-cream))`,
                }}
              >
                {row.chip}
              </span>

              <span className="pf-goal__text">
                <span className="pf-goal__name">{row.title}</span>
                <span className="pf-goal__meta">{row.meta}</span>
              </span>

              <Link className="st-action st-action--compact st-action--primary" href={row.href}>
                {objectivesCopy.playLabel}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* DEVOIR_CSS of AssignedBand, under this band's prefix. Same values; the row has
   no countdown pill, so its grid drops that one column, and the score rules,
   which have nothing to show here, are left out. */
const GOAL_CSS = `
  /* The band is a single panel, so it drops the board's own stacking padding. */
  .pf-goal { padding-bottom: 0; gap: 0; }
  .pf-goal__row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.9rem; }
  .pf-goal__text { display: grid; gap: 0.15rem; min-width: 0; }
  .pf-goal__name { font-size: 0.95rem; color: var(--pf-cream); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pf-goal__meta { font-family: var(--pf-mono); font-size: 0.58rem; letter-spacing: 0.02em; color: rgb(${CREAM} / 0.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  @media (max-width: 720px) {
    .pf-goal__row { grid-template-columns: auto minmax(0, 1fr); row-gap: 0.5rem; }
    .pf-goal__text { grid-column: 1 / -1; grid-row: 2; }
    .pf-goal__row .st-action { grid-column: 1 / -1; grid-row: 3; justify-self: start; }
  }
`;
