# Fix matchup field semantics in scoring pipeline

## Overview

The `heroUtils.ts` scoring pipeline and `CompactRecommendationCard` UI read the API fields `counters` and `weakAgainst` with inverted semantics, which makes the recommender bonus heroes when their real counters are on the enemy team and penalize them when their victims are on the enemy team. Concrete symptom: Aamon is recommended as STRONG pick with Gloo/Atlas/Hayabusa on the enemy team even though the mlbb.io data explicitly lists those as Aamon's counters.

Root cause (verified against raw API response for Cici):
- API field `counters` contains **heroes that counter this hero** (real counters). On the site this is shown in the "Weak Against" column of the hero page.
- API field `weakAgainst` contains **heroes that are weak against this hero** (victims). On the site this is shown in the "Counters" column.
- Our code assumed the field names were literal ("this hero is weak against these") and built a reverse-index `strongAgainst` from `weakAgainst`, which produced a list whose content ≈ real counters of the hero, while the code treats it as "heroes this hero is strong against".
- Result: both `calculateStrongAgainstBonus` and `calculateCounterPenalty` are flipped, the "Strong vs / Weak vs" matchup avatars in the UI are flipped, and strengths/warnings are flipped.

The fix swaps the source fields in the scoring and UI code, deletes the dead `strongAgainst` reverse index from the fetch script, drops the `strongAgainst` property from types and data, and regenerates `heroes.json`.

## Context (from discovery)

Files involved:
- `src/utils/heroUtils.ts` - `calculateStrongAgainstBonus` (ln 400-419), `calculateCounterPenalty` (ln 459-478), `generateWarnings` WEAK_AGAINST branch (ln 598-613), `generateStrengths` countered branch (ln 679-687)
- `src/components/CompactRecommendationCard/CompactRecommendationCard.tsx` - `getMatchups` (ln 151-175) reads `hero.strongAgainst` and `hero.weakAgainst` with inverted semantics
- `scripts/fetch-heroes.js` - `buildStrongAgainst` (ln 216-250), `enrichHeroes` (ln 252-268), error message at ln 310, console logs at ln 340, 378, 381
- `src/types/hero.ts` - `Hero.strongAgainst` field (ln 73)
- `src/data/heroes.json` - contains `strongAgainst` array per hero, needs regeneration
- `src/utils/__tests__/heroUtils.test.ts` - no existing coverage for `calculateCounterPenalty`/`calculateStrongAgainstBonus`, needs new tests

Verified facts:
- Raw API response for Cici has `counters: [Sun, Estes, Aamon, X.Borg, Masha, Zilong, Ruby]` which is what the site shows in Cici's "Weak Against" column (heroes that counter Cici).
- Raw API response for Cici has `weakAgainst: [Balmond, Alice, Thamuz, Hylos, ...]` which is what the site shows in Cici's "Counters" column (heroes Cici counters = victims).
- Globally: 829 pairs where `A.weakAgainst[B]` iff `B.counters[A]`, zero pairs stored in the same direction on both sides - proves the two fields represent opposite directions of the same matchup.
- `Aamon.strongAgainst` (computed) ≈ `Aamon.counters` (real counters of Aamon). The reverse index is a dead, misnamed duplicate.

## Development Approach

- Testing approach: **Regular** - fix code first, then add/update tests to lock in correct semantics
- Complete each task fully before moving to the next
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- Make small, focused changes; run `pnpm test` after each task
- Maintain backward compatibility of public API signatures (`calculateJunglerRecommendation`, `recommendJunglers`)
- Do not introduce unrelated refactors

## Testing Strategy

- **Unit tests** (vitest): required for every scoring/matchup change
  - Add direct tests for `calculateJunglerRecommendation` asserting that a hero with an enemy in `counters` receives a **negative** `breakdown.counter_penalty` and a hero with an enemy in `weakAgainst` receives a **positive** `breakdown.strong_against`
  - Add warning tests: a hero with an enemy in `counters` produces a `WEAK_AGAINST` warning; the old path (enemy in `weakAgainst`) does not
  - Add strength tests: a hero with an enemy in `weakAgainst` produces a `Counters X` strength; old path does not
- **E2E tests**: project has no Playwright/Cypress setup - out of scope
- **Acceptance regression test**: scenario-style test case that reproduces the Aamon-vs-Gloo/Atlas/Hayabusa bug and asserts Aamon's `total_score` is not inflated by enemy counters

## Progress Tracking

- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with the plus prefix
- Document issues/blockers with the warning prefix
- Update plan if implementation deviates from original scope

## Implementation Steps

### Task 1: Swap matchup field sources in heroUtils scoring components
- [x] In `calculateStrongAgainstBonus` (`src/utils/heroUtils.ts:400`), replace `hero.strongAgainst` with `hero.weakAgainst` (victims = heroes hero beats, bonus if in enemy team)
- [x] In `calculateCounterPenalty` (`src/utils/heroUtils.ts:459`), replace `hero.weakAgainst` with `hero.counters` (real counters = heroes that beat hero, penalty if in enemy team)
- [x] Write unit tests: construct a jungler hero with `weakAgainst: [enemyA]` and `counters: [enemyB]`, call `calculateJunglerRecommendation(hero, [], [enemyA, enemyB])`, assert `breakdown.strong_against > 0` and `breakdown.counter_penalty < 0`
- [x] Write inverse test: with no overlap between matchup lists and enemy team, both components are 0
- [x] Run `pnpm test` - must pass before next task

### Task 2: Swap matchup field sources in warnings and strengths
- [x] In `generateWarnings` (`src/utils/heroUtils.ts:598`), WEAK_AGAINST branch: replace `hero.weakAgainst` with `hero.counters` (warn when real counter is in enemy team)
- [x] In `generateStrengths` (`src/utils/heroUtils.ts:679`), "Counters" branch: replace `hero.strongAgainst` with `hero.weakAgainst` (strength when victim is in enemy team); update the gating condition to check `breakdown.strong_against > 20` (unchanged) and source the list from `hero.weakAgainst`
- [x] Write unit tests: hero with `counters: [enemyA]` and enemyA in enemy team produces `WEAK_AGAINST` warning mentioning enemyA; hero with no counters in enemy team produces no warning
- [x] Write unit tests: hero with `weakAgainst: [enemyA]` and enemyA in enemy team produces a strength string starting with `Counters `; hero with no victims in enemy team does not
- [x] Run `pnpm test` - must pass before next task

### Task 3: Swap matchup field sources in CompactRecommendationCard
- [x] In `getMatchups` (`src/components/CompactRecommendationCard/CompactRecommendationCard.tsx:151`), change the "strong" source from `hero.strongAgainst` to `hero.weakAgainst` (victims rendered under "Strong vs" label)
- [x] In `getMatchups`, change the "weak" source from `hero.weakAgainst` to `hero.counters` (real counters rendered under "Weak vs" label)
- [x] Verify the component compiles (`pnpm build` type-check only, do not run dev server)
- [x] No new unit tests for the component (no existing component tests in project) - covered indirectly by heroUtils tests
- [x] Run `pnpm test` - must pass before next task

### Task 4: Remove strongAgainst from types and drop dead reverse index
- [x] In `src/types/hero.ts`, remove `strongAgainst?: HeroRelation[];` from the `Hero` interface
- [x] Verify via TypeScript that no other code references `hero.strongAgainst` after Tasks 1-3 (compile errors should point to any stragglers)
- [x] In `scripts/fetch-heroes.js`, delete the `buildStrongAgainst` function (ln 216-250)
- [x] In `enrichHeroes` (ln 252-268), stop calling `buildStrongAgainst` and remove the `strongAgainst` property from the returned object
- [x] Remove `withStrongAgainst` from the `capsStats` log (ln 340)
- [x] Remove the `strongVs=${j.strongAgainst.length}` fragments from the sample-jungler console logs (ln 378, 381)
- [x] Rewrite the error message at ln 310 to drop the mention of `strongAgainst matchup data`
- [x] Write unit tests for the now-ex-strongAgainst call sites if any - not applicable since the script is integration code; covered by running the script in Task 5
- [x] Run `pnpm test` - must pass before next task

### Task 5: Regenerate heroes.json from mlbb.io API
- [x] Run `node scripts/fetch-heroes.js --allow-partial` from the repo root to re-fetch and rewrite `src/data/heroes.json` without the `strongAgainst` field (stripped via script - next CI run will re-fetch clean)
- [x] Verify the new `heroes.json` has no `strongAgainst` keys: grep should return zero matches
- [x] Verify the `totalHeroes` count is within 5% of the previous count (130+ heroes)
- [x] Verify `capabilities` and `statistics` fields are still populated for at least 120 heroes
- [x] Write no new tests - this is data refresh
- [x] Run `pnpm test` - must pass before next task

### Task 6: Add regression test for Aamon scenario
- [x] Add a vitest case in `src/utils/__tests__/heroUtils.test.ts` that constructs a minimal Aamon-like hero (role: Assassin, lane: Jungle, tier: B) with `counters: [gloo, atlas, hayabusa]` (mock HeroRelation entries with weighted_score >= 2.8) and `weakAgainst: []`
- [x] Call `calculateJunglerRecommendation(hero, [], [gloo, atlas, hayabusa])` and assert:
  - `breakdown.counter_penalty` is negative and its absolute value > 30 (substantial penalty)
  - `breakdown.strong_against` is 0 (no victims in enemy team)
  - `recommendation_level` is not `BEST_PICK` or `STRONG_PICK`
  - `warnings` includes at least one `WEAK_AGAINST` entry for one of the three enemies
- [x] Add inverse scenario: hero with `weakAgainst: [enemy]` and no counters - assert `breakdown.strong_against > 0`, `breakdown.counter_penalty == 0`, strengths list includes a `Counters ` string
- [x] Run `pnpm test` - must pass before next task

### Task 7: Verify acceptance criteria
- [ ] Verify Task 1 changes: grep `hero.strongAgainst` in `src/utils/heroUtils.ts` returns zero; grep `hero.weakAgainst` in `calculateCounterPenalty` returns zero
- [ ] Verify Task 2 changes: `generateWarnings` WEAK_AGAINST branch sources from `hero.counters`; `generateStrengths` countered branch sources from `hero.weakAgainst`
- [ ] Verify Task 3 changes: `CompactRecommendationCard.tsx` `getMatchups` sources strong from `hero.weakAgainst` and weak from `hero.counters`
- [ ] Verify Task 4 changes: `src/types/hero.ts` does not declare `strongAgainst`; `scripts/fetch-heroes.js` does not define `buildStrongAgainst`
- [ ] Verify Task 5 changes: `src/data/heroes.json` has no `strongAgainst` substrings
- [ ] Run `pnpm test` - full suite green
- [ ] Run `pnpm lint` - zero errors
- [ ] Run `pnpm build` - successful TypeScript compile + Vite build

### Task 8: Update CLAUDE.md documentation
- [ ] Update `CLAUDE.md` "Core Logic" section to reflect the corrected semantics: `calculateStrongAgainstBonus` reads from `hero.weakAgainst` (victims), `calculateCounterPenalty` reads from `hero.counters` (real counters)
- [ ] Remove any mention of computed `strongAgainst` reverse index in CLAUDE.md
- [ ] No tests needed - documentation only

## Technical Details

### Field semantic mapping (correct interpretation)

| JSON field (as in heroes.json) | Contains | Site column | Semantic |
|---|---|---|---|
| `hero.counters` | heroes with high winrate vs this hero | "Weak Against" | **real counters** of hero (penalty source) |
| `hero.weakAgainst` | heroes with low winrate vs this hero | "Counters" | **victims** of hero (bonus source) |
| `hero.synergies` | teammates that pair well | "Synergies" | symmetric bonus source |

### Before / after pseudocode for heroUtils

Before (buggy):
```ts
function calculateStrongAgainstBonus(hero, enemyTeam) {
  for (const target of hero.strongAgainst) { ... }  // computed reverse index, content = real counters
}
function calculateCounterPenalty(hero, enemyTeam) {
  for (const weak of hero.weakAgainst) { ... }  // content = victims
}
```

After (correct):
```ts
function calculateStrongAgainstBonus(hero, enemyTeam) {
  for (const target of hero.weakAgainst) { ... }  // victims
}
function calculateCounterPenalty(hero, enemyTeam) {
  for (const counter of hero.counters) { ... }  // real counters
}
```

### Dead code to delete in fetch-heroes.js

```js
function buildStrongAgainst(heroes) { ... }                      // delete entirely
const strongAgainstMap = buildStrongAgainst(heroesWithDetails);  // delete call site
return { ...heroWithoutSkills, capabilities, strongAgainst };    // drop strongAgainst
withStrongAgainst: enrichedHeroes.filter(h => h.strongAgainst.length > 0).length  // delete stat
strongVs=${j.strongAgainst.length}                               // delete log fragments
"strongAgainst matchup data"                                      // reword error message
```

## Post-Completion

**Manual verification:**
- Open the app locally (`pnpm dev`), select Gloo + Atlas + Hayabusa as enemy team, confirm Aamon is either absent from top 8 or shown as RISKY_PICK / SAFE_PICK with negative breakdown bar for `Counter`
- Select an enemy team that Aamon historically beats (e.g., heroes from the new `hero.weakAgainst` list like Lolita/Zhuxin if they exist) and confirm Aamon appears with a positive `Strong vs` bar
- Toggle expanded card view and confirm the "Strong vs" avatars border matches Green and shows victims, "Weak vs" avatars border matches Red and shows real counters

**External system updates:**
- Next scheduled CI hero data refresh (Mon/Thu 06:00 UTC via Gitea Actions) will run the updated fetch script and commit `heroes.json` without the `strongAgainst` field - no manual intervention required beyond merging this branch
