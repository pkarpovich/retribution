# Keep reading the jungle pick after it is locked (RAL-84)

## Overview

Today locking a jungle pick blanks its evaluation. `recommendJunglers` removes everything already on the board from the candidate list, including `yourTeam` (`src/utils/heroUtils.ts:1064-1070`), and `myTeam` contains `myPick` (`src/App.svelte:44`). From the lock onwards the app shows the hero's name, tier, boots and team needs (`src/components/SuggestionBlock.svelte:156-201`) and nothing about how the hero is faring against the draft that is still filling in.

RAL-84 asks for two things once the pick is locked and the other players reveal their heroes: whether the pick is getting stronger or weaker as heroes are added on both sides, and whether counterpicks have appeared against it and which ones.

This plan adds one panel to the locked view - a matchup index with a delta since the lock, and four named groups (taken against you / you beat / works with you / they can still take) - and a way to record your own hero before any enemy is revealed, which is the scenario the ticket opens with and which the app currently has no path for.

### The number, and why it is this number

Two review rounds established that the engine's situational score cannot be read as a trend. It measures *how much of the draft is known* as much as it measures the pick: several components return 0 on an empty enemy team and switch on with the first reveal, `calculateTeamBalance` does the same on the ally axis, and the shared `tanh` compression couples every component to every other. Measured, a matchup-neutral enemy could move it by twenty points and a matchup-neutral ally by twenty-five, in a panel whose job is to report that a counterpick appeared.

So the headline is not the engine's score. It is a **matchup index** built from the only two quantities that describe this hero against named opponents:

    matchupIndex = strongAgainst(pick, enemies) - counterPenalty(pick, enemies)

Both already exist in the engine as pure functions of `(hero, enemyTeam, weights)` (`src/utils/heroUtils.ts:546` and `:606`) - they read the hero's own relation lists and the enemy ids, nothing else. Taken raw, outside the squash, the index has the property the ticket needs and the engine's score does not.

The exact property, stated carefully because two earlier rounds were lost to overstating it:

> The index changes when, and only when, a relation with a **non-zero** `weighted_score` joins or leaves the enemy team.

Two qualifications are doing real work in that sentence, and both were found by measurement:

- **Zero-weight relations exist.** 16 relation rows across 9 of the 39 junglers carry `weighted_score` exactly 0 - Ling lists Masha and Melissa among its counters at weight 0, and Dyrroth lists Lukas among its victims. Selecting rows by id while pricing them by weight would put a hero in TAKEN AGAINST YOU while the number sat still, which is the exact failure this panel exists to prevent. So the readout **drops zero-weight relations from every group**. The number and the lists are then two views of one thing and genuinely cannot disagree.
- **The engine's cap has to go.** Both helpers end in `Math.min(..., 120)`. At Mythic weights the counter side saturates once the summed weight of revealed counters reaches 28.44, which four real counters reach: Sun's Natan 9.134, Aldous 8.978, Alucard 7.475 and Ruby 6.624 total 32.2, so a fifth counter would appear in the list and move the number by nothing. 11 of the 39 junglers can reach saturation inside five enemy slots. The cap exists to bound a scoring component inside a squashed budget; it has no business bounding a display index, so the panel computes from the uncapped values.

### Non-goals

- No trend chart and no per-step history. One number and one delta.
- The engine's own thirteen-component score is not shown in this panel. It still drives the suggestion list before the lock, unchanged. Anyone tempted to "restore" it to the locked view should read the two review rounds first: it was tried, twice, and it reports draft completeness dressed as pick quality.
- The panel reads matchups only. Team composition, damage-type balance, CC chain synergy, invade resistance and early/late tempo are not represented in it; WHAT TO BUY, TELL YOUR TEAM and the enemy read-out above already carry that ground.
- The pre-lock suggestion list is not touched: its ordering, its axis and its scoring stay as they are. `counterSeverity` feeds `buildReasons` there, so a regrade during its extraction would violate this - hence the tests in Task 1.
- No new localStorage entry and no new persisted state.
- The three existing RosterPanel tab labels are not renamed.

### Rejected alternatives

- **The engine's situational score, whole (`fit`).** Rejected on measurement: it gains 13 points when a harmless fifth enemy closes the last enemy slot, because `counter_threat` expires.
- **The same score minus `counter_threat`.** Rejected on measurement: `scale` is computed from a raw sum that still includes `counter_threat`, so the component leaves the total but not the compression; a matchup-neutral fifth enemy still moved it by up to 24 points on some boards, and a matchup-neutral first ally by up to 25.
- **Guarding the delta instead of changing the number.** Rejected: the guard has to cover the enemy set, the ally set and the match bans to be sound, and an enemy-set guard alone never fires again after a blind lock because the set only grows. Suppressing the delta while rendering the same number continuously also fixes nothing - the panel would refuse to do the subtraction while showing both operands.
- **Keeping the engine's 120 cap on the index.** Rejected: see above, it silently swallows a real counterpick on 11 of 39 junglers.
- **Event feed** (`+Chou -> -14`). Rejected: needs history the app does not keep, and forces an answer to what happens when a hero is removed from the board.
- **A fourth RosterPanel tab.** Rejected: three tabs divide the width evenly, a fourth wraps "Add enemy" on a phone, and shortening the labels would rewrite the RAL-82 tests.
- **A new persisted snapshot of the score at lock time.** Rejected: the pending match record already stores the enemies that were revealed, which is all the baseline needs.

## Skills to invoke

Load each skill below with the Skill tool and follow its conventions before implementing the tasks it covers.

- `css-baseline` - all new CSS in `src/components/PickRead.svelte` (Task 3). The project already uses container queries, logical properties, `color-mix` and OKLCH; the new component must match that level and must not cargo-cult older patterns.
- `agent-browser` - the visual check in Task 9. Note from the RAL-82 session: `agent-browser screenshot` returned exit 0 with no file and no output on this machine. Verify through DOM eval instead, and report the visual check as not done if neither works.

## Code-Quality Rules (verify before marking each task complete)

These come from the global and project CLAUDE.md files. A linter catches none of them.

### TypeScript / Svelte

- **No comments and no docstrings in new code.** Use clear names instead. The repository is itself comment-heavy; that is not licence to add more. This exact rule was overridden once in RAL-82 and had to be undone in a follow-up commit - do not repeat it.
- **ASCII hyphen `-` everywhere.** No em dash, no en dash, in code, tests, plan updates, commit messages or the PR body.
- **Early return.** Check failure and edge cases first with `if (!x) return`, keep the main path flat.
- **No inline arrow functions in component props.** Use a named handler or a curried `(item) => () => handler(item)`.
- **Imports at the top of the file**, never inside a function.
- **Check `package.json` before reaching for anything new.** Nothing in this plan needs a new dependency.
- **Surgical changes.** Every changed line traces to this plan. Do not improve adjacent code, do not refactor what is not in scope, do not delete pre-existing dead code that this plan does not name.

### Per-task gate

Before marking any task `[x]`: `pnpm test` green, `pnpm lint` clean, `pnpm build` clean (it runs `svelte-check`), and a `grep` over the diff confirming no comment was added to new code.

## Context (from discovery)

Files and components involved:

- `src/utils/heroUtils.ts` - `calculateStrongAgainstBonus` (546) and `calculateCounterPenalty` (606) hold the two computations the index is built from; `calculateCounterThreat` (639-660) holds the threat selection to extract; `generateWarnings` (770-814) holds the severity rule; `calculateJunglerRecommendation` (966) is still used to write match records.
- `src/utils/presentation.ts` - `matchupsFor` (118) already returns `strong` / `weak` / `synergy` and is currently computed for every suggestion and rendered nowhere; the comment at 192 states the rule that displayed magnitudes must come from the engine so screen and score cannot drift.
- `src/App.svelte` - `lock()` (93-125) is the only writer of `myPick` and of the pending match record; `roster` (68) is the filtered list and `heroes` (20) is the full one.
- `src/components/SuggestionBlock.svelte` - the branch order at 151-202; `signed()` at 84 formats 0 as `+0`.
- `src/components/TeamsStrip.svelte:39` - the empty jungle slot is an inert `<span>`; every prop in its interface (5-14) is required.
- `src/components/RosterPanel.svelte:5` - keeps its own copy of the mode union.
- `src/lib/draftStorage.ts` - `DraftMode` (5), `MODES` (22), validation with fallback (111).
- `src/lib/matches.svelte.ts` - `pending` getter (57-59), `log()` replaces the pending record (65-67).
- `src/utils/matchStats.ts` - `summarise` (32-63) and the self-describing `ABOUT` text (67-77).
- `src/components/StatsScreen.svelte:76-92` - renders SETTLED above the followed/overrode split.
- `src/types/match.ts:29-32` - `rank` is already `number | null` and `top` is already `MatchHero | null`.

Patterns to follow:

- Readout function in `presentation.ts` feeding a component of the matching name: `enemyReadout` -> `EnemyRead.svelte`. This plan adds `pickReadout` -> `PickRead.svelte`.
- Props down, callbacks up. Components receive computed data as props rather than importing stores, as decided in RAL-82.
- Tests run against frozen fixtures. `vitest.config.ts` aliases `heroes.json` to `src/__fixtures__/heroes.snapshot.json` by regex, for engine and UI projects alike.

Dependencies: none new.

## Development Approach

- **Testing approach**: regular (code first, then tests within the same task), matching how the rest of this repository was built.
- Complete each task fully before moving to the next.
- Make small, focused changes.
- **CRITICAL: every task MUST include new/updated tests** for the code it changes.
- **CRITICAL: all tests must pass before starting the next task.**
- **CRITICAL: update this plan file when scope changes during implementation.**
- Run `pnpm test` after each change.
- Maintain backward compatibility: stored drafts and stored match records written by the current version must keep loading.

## Testing Strategy

- **Unit tests (engine project, node)**: `src/utils/__tests__/heroUtils.test.ts`, `presentation.test.ts`, `matchStats.test.ts`.
- **Component tests (ui project, jsdom)**: `src/components/__tests__/PickRead.test.ts`, plus updates to `RosterPanel.test.ts`, `TeamsStrip.test.ts`, `SuggestionBlock.test.ts` and `StatsScreen.test.ts` where props or output change.
- **End to end through the app**: `src/__tests__/App.test.ts` carries the acceptance scenario and the roster-wiring assertion.
- No e2e/Playwright suite exists in this project. The manual browser check is listed under Post-Completion.
- **The suite must be shown to fail.** After the whole thing is green, deliberately rebuild the index from the post-squash breakdown values and confirm the matchup-neutral test goes red. A green suite that was never seen to fail proves nothing. This is Task 8.

## Progress Tracking

- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with a `+` prefix.
- Document issues and blockers with a `!` prefix.
- Update the plan if implementation deviates from the original scope.
- Keep the plan in sync with the work actually done.

## Solution Overview

Three moving parts.

**A number that moves only on a named event.** The matchup index: raw, uncapped, zero-weight relations excluded. Allies cannot move it, match bans cannot move it, team composition cannot move it, and no compression factor is in play. It is zero until a hero the engine actually prices as a relation appears on the enemy side.

**Names, not prose.** Four groups fed by data that is already computed: the counters among the revealed enemies with the severity the engine already assigns, the victims among them, the allies the pick works with, and the counters the enemy can still take. The first two are the index's own two terms spelled out. The third answers the ally half of the ticket, which the index by construction cannot. The fourth is forward-looking and deliberately outside the number.

**A way in.** The pick can currently only be set through a suggestion card, and there are no suggestions until an enemy is revealed - so a player who picks first cannot tell the app what they took. The inert jungle slot in the teams strip becomes the entry point for a fourth draft mode.

## Technical Details

### The matchup index

    matchupIndex(hero, enemies) = strongAgainst(hero, enemies) - counterPenalty(hero, enemies)

Each side is `sqrt(sum of weighted_score over that hero's positive-weight relations present on the enemy team) * 15 * (weight / 10)`, with `weights.strong_against` and `weights.counter_penalty` from `getDefaultWeights(userRank)`. That is exactly what `calculateStrongAgainstBonus` (`src/utils/heroUtils.ts:546-565`) and `calculateCounterPenalty` (`:606-625`) compute, minus their trailing `Math.min(..., 120)`.

Nothing else feeds the index. Not the ally list, not match bans, not enemy team composition, not `counter_threat`, and no `tanh` scale.

### Measured on the frozen snapshot

Sun, enemies revealed one at a time. Natan is a genuine counter of Sun; Masha is a victim; Gord, Miya and Hanabi have no priced relation to Sun either way:

| n | added | index |
|---|---|---|
| 0 | - | 0.0 |
| 1 | Gord | 0.0 |
| 2 | Masha (victim) | +37.2 |
| 3 | Natan (counter) | -30.8 |
| 4 | Miya | -30.8 |
| 5 | Hanabi | -30.8 |

Three neutral reveals, three flat readings. Two priced reveals, two movements.

For sizing the display and for choosing test fixtures, measured across all 39 junglers in the snapshot with the cap removed and zero-weight rows dropped:

- Worst reachable on five enemy slots: Barats at -139.8. Best: Natalia at +78.8. So plan for four digits and a sign, not three.
- 11 of the 39 would have been clipped by the old 120 cap on their five worst counters. This is the measurement that removed it.
- Sun's six priced counters are worth -68.0 to -40.4 individually; its ten priced victims +30.4 to +37.2. Those are per-relation ranges for one hero, not a property of the roster - do not generalise them, and do not use them to decide that some other hero's figure looks wrong.
- Zero-weight rows dropped from the groups: 16, across Ling, Yi Sun-shin, Dyrroth, Lukas, Hirara, Leomord, Freya, Yin and Martis.
- Every jungler has between 3 and 10 positive-weight synergy relations, so the WORKS WITH group has something to say for all of them. Exactly one synergy row in the snapshot carries weight 0 and is dropped like the rest.

### The delta

    sinceLock = matchupIndex(pick, enemies now) - matchupIndex(pick, enemies at lock)

The baseline is **reconstructed, not stored**. `matches.pending` carries the enemy ids present when the pick was locked (`src/App.svelte:104`); resolve them against the current roster and run the same function. Both sides are then computed from the same hero data with the same weights, so the difference isolates the change in the enemy team and nothing else - including across a hero-data refresh, which is why no `dataVersion` guard is needed.

One guard: the pending record must be for this pick (`pending.pick.id === myPick.id`). Without a pending record there is no baseline and no delta; the index is shown alone.

A blind mark writes a record with an empty enemy list, so from the first reveal onwards the delta exists and is exactly the index. When nothing priced has been revealed it reads `+0`, and that is shown rather than hidden: a visible zero says "nothing has changed since you locked", which is a real answer. An enemy removed after the lock moves the index back and the delta follows it to `+0`; the index is a function of the board, not of history.

### The severity rule

`generateWarnings` grades a counter by `weighted_score * (weights.counter_penalty / 10)`: above 5 is HIGH, above 2 is MEDIUM, otherwise LOW (`src/utils/heroUtils.ts:782-784`).

`counterSeverity(weightedScore, weights)` takes the **raw** `weighted_score` and applies the scale itself. Both call sites therefore pass the raw relation weight, never a pre-scaled one. This matters: Sun's Faramis relation is 3.55, which grades HIGH when the scale is applied inside and MEDIUM when it is applied twice or not at all, and no test in the repository currently asserts any severity, so the suite would stay green either way. Task 1 pins it.

### Public contracts added

To `src/utils/heroUtils.ts`:

```ts
export function strongAgainstRaw(hero: Hero, enemyTeam: Hero[], weights: RecommendationWeights): number
export function counterPenaltyRaw(hero: Hero, enemyTeam: Hero[], weights: RecommendationWeights): number
export function counterSeverity(weightedScore: number, weights: RecommendationWeights): RecommendationWarning['severity']
export interface CounterThreat { id: number; hero_name: string; tier: HeroTier; exposure: number }
export function liveCounterThreats(hero: Hero, yourTeam: Hero[], enemyTeam: Hero[], matchBans: Hero[]): CounterThreat[]
export function matchupIndex(hero: Hero, enemyTeam: Hero[], userRank?: UserRank): number
```

The two `Raw` functions are the uncapped bodies of the existing helpers; `calculateStrongAgainstBonus` and `calculateCounterPenalty` become one-line wrappers applying `Math.min(..., 120)`, so no engine number changes.

To `src/utils/presentation.ts`:

```ts
export interface PickBoard { myTeam: Hero[]; enemies: Hero[]; matchBans: Hero[]; roster: Hero[] }
export interface PickThreat { hero: Hero; severity: RecommendationWarning['severity'] }
export interface PickReadout {
  index: number
  sinceLock: number | null
  taken: PickThreat[]
  beaten: Hero[]
  worksWith: Hero[]
  live: Hero[]
  openSlots: number
}
export function pickReadout(pick: Hero, board: PickBoard, baseline: MatchRecord | null, userRank?: UserRank): PickReadout
```

`RecommendationWarning` is imported from `src/types/hero.ts`, where the severity union is declared inline on the field (`src/types/hero.ts:141-146`). There is no `WarningSeverity` alias in this repository and this plan does not add one.

`PickBoard.myTeam` includes the locked pick. It is used for `liveCounterThreats`, whose "gone" set means heroes the enemy can no longer take - and the pick is one of them - and for the synergy lookup. The index takes no team at all, so the `allies`-versus-`myTeam` trap that applies to `calculateJunglerRecommendation` does not exist here. It still applies in Task 6, where the record is written.

`PickBoard.roster` is the **full** hero list, not `App`'s `roster`, which filters out drafted heroes. The baseline enemies are drafted by definition, so a filtered roster would resolve them to nothing, make the baseline index 0, and turn every `sinceLock` into the whole index. Task 4 pins this with a test.

### Screen

The panel sits between the locked header and WHAT TO BUY, above the purchases, because it is the part that changes while the draft fills. All copy is English, like the rest of the interface.

**The template order has to change first, or none of this renders.** `SuggestionBlock.svelte:151` opens with `{#if !hasDraft}` - the "Start with the enemy team" prompt - and only reaches the locked branch in the `{:else if myPick}` arm at 156. `hasDraft` is `allies.length + enemies.length > 0` (`src/App.svelte:46`) and does not count the pick. So a hero marked on a blank board, which is the entire point of the fourth draft mode, falls into the onboarding prompt and the locked view never appears. The fix is to test `myPick` first, leaving the prompt as the second branch; `hasDraft` itself is not touched, so the prompt keeps its meaning everywhere else.

Kicker `AGAINST THIS BOARD`; the index on the right, signed, with the signed `since lock` delta beneath it when there is a baseline. Then up to four groups, each hidden when empty:

- `TAKEN AGAINST YOU` - red rail, severity tag per row.
- `YOU BEAT` - positive colour, plain rows.
- `WORKS WITH YOU` - muted positive, allies only. This is the one group the index does not price, and it is what answers the ticket's ally clause.
- `THEY CAN STILL TAKE` - muted, with the open slot count in the group header. Gone at five enemies.

When the first two groups are empty the index is 0 by construction, and one line replaces them: `Nothing on their board cuts either way.` The other two groups can still render alongside it.

### Fourth draft mode

`DraftMode` gains `'pick'`. Entering it: the jungle slot in the teams strip, currently an inert `<span>` (`src/components/TeamsStrip.svelte:39`), becomes a button. While the mode is active the RosterPanel tab row is replaced by a single row reading `YOUR JUNGLE PICK` with a `CANCEL` control; tapping a hero sets the pick and returns the mode to `'enemy'`.

### One writer for the pick, and what rank means

`lock()` currently sets `myPick` and writes the match record, and it is the only path. With a second entry point the two would drift, so both call one function. Three cases, because the roster offers every undrafted hero while `recommendJunglers` shows only the top eight:

| situation | rank | shown | top | followedAdvice |
|---|---|---|---|---|
| hero is in the suggestion list | its position | list length | first suggestion | rank === 1 |
| suggestions on screen, hero is not among them | `shown + 1` | list length | first suggestion | false |
| no suggestions on screen at all | `null` | 0 | `null` | false |

The middle row is the one an earlier draft of this plan got wrong: choosing a hero outside the visible eight while advice is on screen is an override, not a blind pick, and encoding it as `rank: null` would have made both the statistics and the export say the opposite. `shown + 1` means "below the displayed list". `src/types/match.ts` needs no change.

**Two components render `rank` and `shown` as a literal position and both need teaching**, or the sentinel becomes visible nonsense. `src/components/MatchBanner.svelte:21` and `src/components/StatsScreen.svelte:129` carry the same expression, `{#if record.rank}#{record.rank} of {record.shown}{/if}`. A pick marked outside the visible eight would read **"#9 of 8"** - and `MatchBanner` renders on the draft screen itself whenever a pending record exists, so it is the first thing the player sees after using the very entry point this plan adds. It is the common case, not an edge: the fourth draft mode exists to record the hero the player actually took, which is usually not in the engine's top eight.

The blind case has a smaller version of the same problem: `{#if record.rank}` is falsy for `null` and the separator sits outside the conditional, so both renderers emit a leading " · ". No record with a null rank exists today, so that string first becomes reachable after Task 6.

`src/utils/matchStats.ts:47` splits games into followed and overrode by `followedAdvice`. A blind pick has it `false` and would be counted as disagreeing with the engine, which never advised. The split must only count records with `rank !== null`, the rest must be counted somewhere visible, and the `ABOUT` text the export is built around (`src/utils/matchStats.ts:67-77`) currently tells a reading agent that "followedAdvice is rank === 1", which would make it draw the same wrong conclusion.

## What Goes Where

- **Implementation Steps** (`[ ]`): everything achievable in this repository - engine extractions, readout, component, wiring, tests.
- **Post-Completion** (no checkboxes): the manual pass on a real device, and the steps that need the user's word.

## Implementation Steps

### Task 1: Expose what the engine already computes

**Files:**
- Modify: `src/utils/heroUtils.ts`
- Modify: `src/utils/__tests__/heroUtils.test.ts`

Four extractions, none of which may change a number the engine produces.

`strongAgainstRaw` and `counterPenaltyRaw` are the current bodies of `calculateStrongAgainstBonus` and `calculateCounterPenalty` without the trailing `Math.min(..., 120)`; the existing functions become wrappers that apply it. `counterSeverity` takes the grading rule out of `generateWarnings` (`src/utils/heroUtils.ts:782-784`) and applies the `weights.counter_penalty / 10` scale itself, so `generateWarnings` hands it the raw `weighted_score`. `liveCounterThreats` takes the selection out of `calculateCounterThreat` (`:646-657`) and returns one entry per priced counter with its id, name, tier and tier-weighted `exposure`; `calculateCounterThreat` then sums `exposure` and keeps its own formula unchanged. Sorting, the `THREAT_SLOTS` cap, the open-slot cap and the "gone" set (your team, enemy team, match bans - personal bans deliberately excluded) all move into the new function unchanged.

`matchupIndex` is the difference of the two `Raw` functions, with weights from `getDefaultWeights(userRank)`, over relations with a positive `weighted_score`.

"The existing tests pass untouched" proves purity for the wrappers and for `liveCounterThreats`, whose numbers are pinned below. It proves **nothing** for `counterSeverity`: no test in this repository asserts a warning's severity today, so a transposed threshold or a double-applied scale stays green. Its own tests are therefore not optional, and its blast radius reaches `buildReasons` in `presentation.ts`, which puts the first HIGH warning on the pre-lock suggestion card that this plan lists as a non-goal.

- [x] split `strongAgainstRaw` / `counterPenaltyRaw` out of the two helpers, leaving the capped wrappers in place
- [x] extract `counterSeverity` and call it from `generateWarnings`, passing the raw `weighted_score`
- [x] extract `liveCounterThreats` from `calculateCounterThreat` and sum `exposure` in the caller
- [x] add `matchupIndex`, dropping relations whose `weighted_score` is 0
- [x] confirm every existing test in `heroUtils.test.ts` and `invariants.test.ts` passes with **no edits at all**
- [x] write `counterSeverity` tests directly below, exactly at and above both scaled thresholds, across two ranks, asserting the scale is applied once and inside
- [x] write a parity test through `generateWarnings` for a relation that straddles the scaled and unscaled bands - Sun against Faramis, `weighted_score` 3.55, must come out HIGH
- [x] write a test that `matchupIndex` is exactly 0 for every jungler against a board carrying no positive-weight relation to it
- [x] write a test that a priced victim raises it, a priced counter lowers it, and an unrelated hero leaves it bit-identical
- [x] write a test that four counters plus a fifth still move the index, since the cap is gone - Sun against Natan, Aldous, Alucard, Ruby, then Faramis
- [x] write a test that the summed `exposure` reproduces the component the score charged, plus the edge cases: no open slots returns empty, a drafted or match-banned counter is absent, a personally banned counter is still present
- [x] run `pnpm test` - must pass before Task 2

### Task 2: pickReadout in the presentation layer

**Files:**
- Modify: `src/utils/presentation.ts`
- Modify: `src/utils/__tests__/presentation.test.ts`

`pickReadout` computes `index` with `matchupIndex(pick, board.enemies, userRank)`, and builds the groups from `matchupsFor(pick, board.enemies, board.myTeam)`: `.weak` becomes `taken` with severities from `counterSeverity` applied to each relation's raw `weighted_score`, `.strong` becomes `beaten`, `.synergy` becomes `worksWith`. `live` comes from `liveCounterThreats(pick, board.myTeam, board.enemies, board.matchBans)` resolved against `board.roster`, dropping ids the roster does not contain the way `matchupsFor` already does. `openSlots` is `MAX_ENEMIES - board.enemies.length`.

**Every group drops relations whose `weighted_score` is 0.** `matchupsFor` does not filter today, so this is a change in what it feeds, applied in `pickReadout` rather than in `matchupsFor` itself - the suggestion cards do not render matchups and nothing else consumes it, but leaving the shared helper alone keeps the change inside this feature.

`sinceLock` is `index` minus the index recomputed against the enemies named in `baseline.enemies`, resolved against `board.roster`. It is `null` when `baseline` is null or `baseline.pick.id` differs from the pick, and `0` when the board's priced relations are unchanged since the lock.

- [x] add `PickBoard`, `PickThreat`, `PickReadout` and `pickReadout` to `src/utils/presentation.ts`
- [x] write tests: names the counter among revealed enemies and carries its severity; names the victim; names the ally in `worksWith`; `live` is capped by open slots and empty at five enemies
- [x] write the load-bearing test: adding an enemy with no priced relation to the pick leaves `index` **exactly** unchanged
- [x] write the zero-weight test with Ling and Masha from the frozen snapshot: the relation exists, its `weighted_score` is 0, so Masha appears in **neither** `taken` nor the index, and the two agree
- [x] write tests that neither an added ally, nor an added match ban, nor any change of enemy team composition moves `index`
- [x] write tests for the baseline: same pick yields the movement since the recorded enemies; a record for a different pick yields `null`; a null baseline yields `null`; an enemy removed after the lock returns the delta to 0
- [x] write a test that a pick with no enemies revealed produces a readout with `index` exactly 0 and the first two groups empty
- [x] run `pnpm test` - must pass before Task 3

### Task 3: PickRead component

**Files:**
- Create: `src/components/PickRead.svelte`
- Create: `src/components/__tests__/PickRead.test.ts`

One prop, `readout: PickReadout`. Renders the `AGAINST THIS BOARD` kicker, the signed index, the signed `since lock` delta only when `sinceLock` is not null - including when it is 0, which prints `+0` - and the four groups described in Technical Details, each omitted when its list is empty. When the first two groups are empty it renders the fallback line in their place, leaving the other two to render if they have entries. Rows carry a `HeroAvatar` and the hero name; the taken group adds the severity tag.

Reuse the existing visual vocabulary rather than inventing one: kicker, rail, figure and swatch styles already exist in `SuggestionBlock.svelte` and `EnemyRead.svelte`.

Sizing, since two figures live here and they have different widths. `signed()` (`src/components/SuggestionBlock.svelte:84`) rounds, so the index prints at most `-140` on the frozen snapshot - three digits and a sign. The delta is the difference of two indices and is therefore wider: on a board where enemies are removed and replaced it spans roughly -219 to +219, four digits and a sign. Size for those two, not for one.

The panel also needs one short line the player can read saying the number looks at the enemy board only. Without it the `WORKS WITH YOU` group produces a confusing pairing on a real draft - a named ally appears while the headline sits still - and the kicker `AGAINST THIS BOARD` reads as covering both sides. A caption on the figure or on that group's header is enough; the kicker itself stays as it is.

- [x] create `src/components/PickRead.svelte` with the header, the four groups and the fallback line
- [x] add the copy scoping the number to the enemy board
- [x] style it to match the existing panels, using the project's custom properties for every colour and space value
- [x] write tests: all four groups render with their heroes and the severity tag appears on a taken row
- [x] write tests: an empty group is absent; the fallback line appears with the first two empty while the others still render; the delta is absent when `sinceLock` is null and prints `+0` when it is 0
- [x] write a test that the widest index and the widest delta render as expected strings - `-140` and a four-digit delta - since jsdom has no layout and cannot decide clipping; the real no-clipping check is Task 9's browser pass
- [x] write a test that the enemy-board copy renders
- [x] run `pnpm test` - must pass before Task 4

### Task 4: Show the panel in the locked view

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/components/SuggestionBlock.svelte`
- Modify: `src/components/__tests__/SuggestionBlock.test.ts`
- Modify: `src/__tests__/App.test.ts`

`App` derives the readout when `myPick` is set and passes it down as a single `pickRead` prop; `SuggestionBlock` renders `PickRead` between the `.locked` header and the WHAT TO BUY panel. The board passed in is `myTeam`, `enemies`, `matchBans` and **`heroes`** - the full roster from line 20, not `roster` from line 68, for the reason in Technical Details. `matches.pending` is the baseline.

This task also reorders the template so the locked branch is tested before the onboarding prompt, for the reason in Technical Details under "Screen". Without it the locked view is unreachable on a blank board and Task 6 cannot pass its own acceptance test.

`App.test.ts` is in this task's files because the roster choice cannot be tested anywhere else: `pickReadout`'s own tests pass a roster directly, and a blind lock has an empty baseline where both readings agree. The test that discriminates has to lock a hero that already has a priced relation to a revealed enemy.

- [x] reorder `src/components/SuggestionBlock.svelte` so `{#if myPick}` is the first branch and the `!hasDraft` prompt is the second; leave `hasDraft` itself alone
- [x] derive `pickRead` in `src/App.svelte` from `heroes`, and pass it to `SuggestionBlock`
- [x] add the `pickRead` prop to `SuggestionBlock` and render `PickRead` in the locked branch, above WHAT TO BUY
- [x] update the existing `SuggestionBlock` tests for the new prop and confirm none of them depended on the old branch order
- [x] write a test that the locked branch renders the panel when given a readout and omits it when given null
- [x] write a test that a pick with an otherwise blank board renders the locked view and not the "Start with the enemy team" prompt
- [x] write the roster test in `App.test.ts`: reveal an enemy the pick has a priced relation to, lock the pick, and assert `sinceLock` reads `+0` with a non-zero index - it reads the whole index if the filtered roster was passed
- [x] run `pnpm test` - must pass before Task 5

### Task 5: A fourth draft mode for marking your own hero

**Files:**
- Modify: `src/lib/draftStorage.ts`
- Modify: `src/components/TeamsStrip.svelte`
- Modify: `src/components/RosterPanel.svelte`
- Modify: `src/App.svelte`
- Modify: `src/components/__tests__/TeamsStrip.test.ts`
- Modify: `src/components/__tests__/RosterPanel.test.ts`
- Modify: `src/lib/__tests__/draftStorage.test.ts`
- Modify: `src/__tests__/App.test.ts`

The mode and its only way in have to land together. `TeamsStrip`'s props are a required typed interface (`src/components/TeamsStrip.svelte:5-14`) and `src/App.svelte` is its only caller, so adding `onChoosePick` without passing it fails `svelte-check`, which `pnpm build` runs - the task could not meet its own gate. Deferring the wiring would also leave a button that calls nothing and a `'pick'` mode that `pick()` does not handle, so a hero tapped in that mode would land on the enemy team.

`DraftMode` gains `'pick'` and `MODES` gains the matching entry; the existing validation already falls back to the default for anything unrecognised, so older stored drafts keep loading. `RosterPanel.svelte:5` keeps its own copy of the union (`type Mode = 'ally' | 'enemy' | 'ban'`) rather than importing it - widening only `draftStorage.ts` leaves the two out of step and `mode === 'pick'` becomes a comparison against a non-overlapping literal. Import `DraftMode` there instead of growing a second copy; those are the only two declarations of the union in the repository.

The inert jungle `<span>` in `TeamsStrip` becomes a button with a new `onChoosePick` callback and an accessible label. While `mode === 'pick'`, `RosterPanel` replaces its tab row with a single row reading `YOUR JUNGLE PICK` and a `CANCEL` control that calls `onModeChange('enemy')`; the grid, the search and the role chips are untouched, so a hero can be found the same way in every mode.

At the end of this task the `'pick'` branch sets `myPick` and logs nothing; Task 6 gives it the match record.

- [x] add `'pick'` to `DraftMode` and `MODES` in `src/lib/draftStorage.ts`
- [x] replace the local union in `src/components/RosterPanel.svelte` with an import of `DraftMode`
- [x] turn the empty jungle slot in `src/components/TeamsStrip.svelte` into a button with an `onChoosePick` callback
- [x] replace the tab row in `src/components/RosterPanel.svelte` with the pick-mode row while the mode is active
- [x] wire it up in `src/App.svelte`: pass `onChoosePick` to set `mode = 'pick'`, and add the `'pick'` branch to `pick()` so a tapped hero becomes the pick and the mode returns to `'enemy'`
- [x] write tests: the empty jungle slot calls its callback; the filled slot still clears the pick
- [x] write tests: pick mode hides the tabs and shows the cancel control, cancel asks for `'enemy'`, the roster grid still renders and still hands tapped heroes back
- [x] write the App-level wiring test: tapping the empty jungle slot enters pick mode, tapping a roster hero fills `myPick`, the mode returns to `'enemy'`, and no enemy was added - without it the component tests stay green while `App` never passes the callback or routes the tap to the enemy team
- [x] write a test that a stored draft with an unknown mode still loads with the default
- [x] run `pnpm test` and `pnpm build` - both must pass before Task 6

### Task 6: One writer for the pick, three kinds of record

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/__tests__/App.test.ts`

`lock()` and the Task 5 path collapse into one function that sets `myPick` and writes the pending match record according to the three-case table in Technical Details. The suggestion case is exactly what `lock()` does today. The other two build the record from a direct evaluation.

**The direct evaluation takes `allies`, not the team including the hero:**

```ts
calculateJunglerRecommendation(hero, allies, enemies, 'Mythic', { matchBans, signatures: signatures.ids })
```

`calculateTeamBalance` walks `yourTeam` counting damage dealers and tanks (`src/utils/heroUtils.ts:267-277`), so a hero present in its own team list counts itself and depresses its own `damageNeed`. The existing `lock()` path is safe only by accident - it reads `suggestion.result`, which was scored while `myPick` was still null and `myTeam` therefore equalled `allies`. `signatures` is the rune store; the engine wants `number[]`, which is why the call passes `signatures.ids` exactly as `src/App.svelte:62` already does. This trap is specific to the record; the panel's index takes no team at all.

`needs` is the one thing computed against the pick-inclusive team, as `lock()` already does. Do not let that line pull the evaluation call along with it.

- [x] merge `lock()` and the Task 5 path into one pick-taking function in `src/App.svelte`
- [x] implement the three record cases, passing `allies` and `signatures.ids` to the direct evaluation
- [x] write a test for the ticket's opening scenario: with no enemies revealed, mark a hero through the jungle slot and confirm the panel appears with an index of 0
- [x] write a test that a pick marked with no suggestions on screen writes a record with `rank: null` and `shown: 0`
- [x] write a test that a hero picked from the roster while suggestions are on screen but outside them writes `rank: shown + 1` with `top` preserved
- [x] write a test that locking from a suggestion card is unchanged - same rank, same `followedAdvice`
- [x] run `pnpm test` - must pass before Task 7

### Task 7: Teach the statistics, the screens and the export what rank means now

**Files:**
- Modify: `src/utils/matchStats.ts`
- Modify: `src/components/StatsScreen.svelte`
- Modify: `src/components/MatchBanner.svelte`
- Modify: `src/utils/__tests__/matchStats.test.ts`
- Modify: `src/components/__tests__/StatsScreen.test.ts`
- Create: `src/components/__tests__/MatchBanner.test.ts`

A record with `rank: null` describes a game where no ranked list was on screen. Counting it as "overrode" would say the player disagreed with advice that was never given. The split at `src/utils/matchStats.ts:47` must skip those records - and only those: a record with `rank === shown + 1` is a genuine override and stays in the overrode column.

That guard alone breaks what the screen shows. `summarise` increments `settled` and then one of `followed` / `overrode` from the same record (`:44-47`), and `StatsScreen.svelte:76-92` renders SETTLED above the two of them as a split. Guarding only the second increment makes ten settled games with three blind picks read as 10 / 4 / 3, which looks like an arithmetic error. So `MatchSummary` gains a `blind` tally counted the same way, and the SETTLED kicker carries it the way it already carries `pending` (`src/components/StatsScreen.svelte:79`) - no new layout, no CSS. The invariant is `followed + overrode + blind === settled` per outcome.

**Both renderers of the rank have to be taught the two new shapes**, for the reason in Technical Details: `#{rank} of {shown}` prints "#9 of 8" for an off-list pick, and drops to a dangling separator for a blind one. `MatchBanner` is on the draft screen and is the first thing seen after using the new entry point, so it matters more than the log. Give each shape its own label - something like `below #8` for `rank === shown + 1` and a plain blind marker for `rank === null` - and fix the separator so it does not lead.

The export carries the same misreading in prose. `ABOUT` (`src/utils/matchStats.ts:67-77`) tells a reading agent that "followedAdvice is rank === 1", and CLAUDE.md says the export is meant to be handed to an agent with no other context - so the text is contract, not commentary. It has to say that a null rank means no suggestion list was on screen, that `shown + 1` means the pick was below the displayed list, and that only null-rank records are blind.

- [ ] guard the followed/overrode split on `rank !== null` and count those records into a new `blind` tally
- [ ] add `blind` to `MatchSummary` and show it in the SETTLED kicker beside the open count
- [ ] label the below-list and blind shapes in `MatchBanner.svelte` and `StatsScreen.svelte`, and stop the separator leading when there is no rank
- [ ] extend `ABOUT` to explain a null rank, the `shown + 1` convention, and the blind category
- [ ] check the rest of `matchStats.ts` for other places a null rank would distort a figure, and fix any found
- [ ] write a test that a blind-pick record lands in `blind` and in neither `followed` nor `overrode`
- [ ] write a test that a `rank: shown + 1` record lands in `overrode`, not in `blind`
- [ ] write a test for the invariant `followed + overrode + blind === settled` on a mix of records, won and lost
- [ ] write a `StatsScreen` test that a settled blind record shows the blind count in the SETTLED kicker
- [ ] write `MatchBanner` and `StatsScreen` tests that a `rank: shown + 1` record never prints "#9 of 8", that a blind record prints no leading separator, and that an in-list record still prints "#3 of 8" as before
- [ ] run `pnpm test` - must pass before Task 8

### Task 8: The acceptance scenario, and proving the tests bite

**Files:**
- Modify: `src/__tests__/App.test.ts`
- Modify (temporarily, restored before the task closes): `src/utils/heroUtils.ts`

The scenario, from the first line of the ticket:

> I take Sun in the game and mark Sun in the app before any enemy is revealed. The enemies reveal one at a time. Gord changes nothing - the index stays 0 and the delta reads +0. Masha, a victim, takes it to +37. Natan, a genuine counter, drops it to -31 and appears under TAKEN AGAINST YOU with a HIGH tag. Miya and Hanabi change nothing at all - the index holds at -31 and so does the delta.

The baseline for a blind mark is an empty enemy list and is never refreshed, so from the first reveal the delta equals the index. It reads `+0` only while nothing priced has appeared; after Natan it holds at -31 through the last two reveals. A neutral reveal means *the numbers do not change*, not that they return to zero - and if this test is written the other way, the tempting repair is to re-baseline the record on every reveal, which destroys the since-lock reading the ticket asked for.

Written against the frozen snapshot so a data refresh cannot move it. If those heroes are not in the snapshot, pick an equivalent set by relationship, say so in the test name, and assert the shape - neutral reveals flat, victim up, counter down - rather than the exact figures.

Then the honesty pass, as in RAL-82. The perturbation point is `matchupIndex` in `src/utils/heroUtils.ts`: rebuild it from the post-squash `breakdown.strong_against` and `breakdown.counter_penalty` instead of the raw functions, run the suite, and confirm the neutral-reveal test goes red - those values drift whenever any enemy is added because `scale` moves. This is a temporary edit to production code, which is why the file is listed above; restore it and confirm `git diff` on it is empty before closing the task. Record both outcomes in the PR description later.

- [ ] write the scenario end to end in `src/__tests__/App.test.ts`, asserting that each neutral reveal leaves both the index and the delta exactly as they were - `+0` before anything priced appears, held at the current value afterwards
- [ ] extend it: the counter is named with its severity and the index falls
- [ ] deliberately rebuild `matchupIndex` from the post-squash breakdown, run the suite, and record that the neutral-reveal assertion fails
- [ ] restore `src/utils/heroUtils.ts`, confirm `git diff` on it is empty, and confirm the suite is green again
- [ ] run `pnpm test` - must pass before Task 9

### Task 9: Verify acceptance criteria

- [ ] verify the ticket's first half: the index moves on every priced matchup and stays exactly put otherwise, including after four counters where the old cap would have clipped it
- [ ] verify the ticket's ally clause: revealing an ally the pick has a synergy with puts it in WORKS WITH YOU, the index correctly does not move, and the panel's own copy explains why - the pairing is only readable if the explanation is on screen and not just in this plan
- [ ] verify the ticket's second half: appearing counterpicks are named with their severity, and a zero-weight relation appears in neither the list nor the number
- [ ] verify the opening scenario: a hero can be marked before any enemy is revealed, the locked view renders on an otherwise blank board, and the panel reads from that moment
- [ ] verify the delta is present from the first reveal after a lock and reports the movement since the recorded enemies
- [ ] run the full suite: `pnpm test`
- [ ] run `pnpm lint` and `pnpm build`
- [ ] grep the diff for comments added to new code and remove any found
- [ ] check the panel in a browser on `pnpm dev` (port 50200) at phone width and past the 46rem split, using `agent-browser`; if the screenshot command is still broken on this machine, verify through DOM eval and say plainly that no screenshot exists

### Task 10: Update documentation

- [ ] update `CLAUDE.md` where it describes what the locked view shows and how the match log treats rank
- [ ] record that the panel's index is the raw uncapped matchup pair, that zero-weight relations are dropped from both the number and the lists, and that it is deliberately not the engine's situational score - with one line on why, so a later session does not "upgrade" it back
- [ ] move this plan to `docs/plans/completed/`

## Post-Completion

*No checkboxes - these need a real device, a real match, or the user's word.*

**Manual verification:**

- Run one real draft on the iPad: pick first, mark the hero through the jungle slot, then reveal enemies one at a time and check that the panel reads the way it should under a pick timer rather than at rest.
- Check that a reveal which changes nothing visibly changes nothing, since that is the property the design was rebuilt around.
- Check the locked column does not become too long to scroll comfortably now that it carries another panel with four groups.

**Things needing the user's word:**

- Committing, pushing, opening the PR. None of it happens without an explicit request.
- RAL-84 is in Backlog in Linear and its status has not been touched. `Fixes RAL-84` in the commit body and the PR description, plus `ral-84` in the branch name, should let Linear close it on merge.
