# V4 Sources Diff Checklist (PDF vs TXT)

Last update: 2026-03-12

Sources compared:
- PDF: `/Users/launaymarion/Documents/JEUX_DE_TYPO/00_README_CREATION/01_JEUX DE TYPO_V4_.pdf`
- TXT: `/Users/launaymarion/Documents/JEUX_DE_TYPO/00_README_CREATION/JEUX_DE_TYPO_V4.txt`

Method used:
- text extraction from PDF with `pdftotext`
- normalization (accents/case/spacing/page markers)
- structural heading comparison
- sentence-level set comparison

## 1) Global verdict

- Content parity: `YES` (very high)
- Structural parity (sections): `YES`
- Business rules parity: `YES`
- Significant contradictions found: `NO`

Quantitative check:
- normalized token overlap (vocabulary): ~`99.66%`
- sentence-like units compared: `364` vs `364`
- real semantic differences detected: `3` (wording-level only)

## 2) Checklist (difference presence)

- [x] Same product scope (principle, modes, progression)
- [x] Same pedagogy core (Ebbinghaus, Leitner, SM2, Type Cards)
- [x] Same mastery model (levels 0->4, spaced repetition windows)
- [x] Same pool logic (~30 active typefaces)
- [x] Same word logic (~20 neutral words)
- [x] Same competition rule set (2 minutes, points logic)
- [x] Same backend/front separation principles
- [ ] Major logic conflict between PDF and TXT
- [ ] Missing full section in one source

## 3) Exact differences found

1. Terminology on one block:
- PDF uses `Training`
- TXT uses `Entraînement`
- Impact: none (same meaning)

2. Same terminology drift in one sentence:
- PDF: `... apparaître en mode Training`
- TXT: `... apparaître en mode Entraînement`
- Impact: none (language consistency only)

3. Minor typo/spacing variant:
- PDF extraction gives `lui-même` as `luimême` in one sentence
- TXT keeps `lui-même`
- Impact: none (text formatting artifact)

## 4) Non-semantic extraction artifacts (PDF only)

Expected artifacts from PDF extraction:
- page markers (`V2`, page numbers)
- forced line wraps
- occasional hyphenation/ligature artifacts

These are formatting artifacts, not product-rule differences.

## 5) Recommendation

Canonical source recommendation:
- keep `JEUX_DE_TYPO_V4.txt` as canonical editable content source
- keep PDF as presentation/reference snapshot

Reason:
- TXT is easier to version, diff, and update without extraction noise.

## 6) Actionable follow-up

- [ ] Optional: create `docs/v4-canonical.md` as normalized project canonical spec
- [ ] Optional: enforce one terminology (`Entraînement` vs `Training`) in all docs
- [ ] Optional: regenerate PDF from canonical text to remove drift risk

