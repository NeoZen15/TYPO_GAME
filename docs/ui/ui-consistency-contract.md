# UI Consistency Contract (Site-wide)

Last update: 2026-03-13
Status: active

Purpose:
- keep visual hierarchy consistent across pages
- avoid typography/style drift when adding new screens
- ensure the theme switch behavior is always present and consistent

## 1) Mandatory rules

1. Every new full page must include the same theme switch component.
2. All non-game-specimen text must use the UI typography stack.
3. Titles and subtitles must use shared size tokens and shared spacing rules.
4. Case style must stay consistent by role:
   - page titles: sentence case
   - meta labels/chips: uppercase
5. Color system must stay constrained:
   - black/white/yellow for structure
   - green/red only for validation states
   - mode-selection accent colors are allowed on `/play` cards and `/play/{mode}/rules`

Exception:
- the sample word shown as the typeface challenge in gameplay can use the target typeface itself.

## 2) Canonical typography tokens

Defined in `app/globals.css`:
- `--ui-title-size`
- `--ui-title-line`
- `--ui-subtitle-size`
- `--ui-subtitle-line`
- `--ui-title-gap`

Canonical utility classes:
- `.ui-page-title`
- `.ui-page-subtitle`

## 3) Canonical shape tokens

- pills and compact actions: `border-radius: 999px`
- standard shell/cards: around `1.04rem` to `1.15rem`

## 4) Canonical color tokens

- background light: `#ffffff`
- foreground light: `#111114`
- background dark: `#000000`
- foreground dark: `#ffffff`
- yellow accent: `#ffd213`
- success: `#00c853`
- error: `#ff0000`

## 5) Spacing contract

Title/subtitle spacing:
- subtitle top margin must follow `--ui-title-gap`

Section rhythm:
- keep consistent vertical rhythm between headline, support text, and action groups
- avoid one-off ad-hoc spacing unless documented

## 6) Theme switch contract

All full pages must render `ThemeSwitch`:
- fixed top-right
- same dimensions and motion
- same localStorage key (`jdt-theme`)

## 7) Routing and mode pages

Current mode entry route:
- `/play` (mode selection page)

This page is the required transition point before mode-specific gameplay routes.

Allowed `/play` accent palette (mode identity only):
- training: `#40d38f`
- competition: `#ff934a`
- expert: `#58a9ff`

Rules pages using the same palette:
- `/play/training/rules`
- `/play/competition/rules`
- `/play/expert/rules`

Rules-page consistency requirements:
- mode kicker chip must stay centered in its pill
- rules content must scroll as one global panel
- avoid nested scroll zones inside individual rule cards
