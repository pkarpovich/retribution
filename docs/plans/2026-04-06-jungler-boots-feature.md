# Jungler Boots & Retribution Blessing Recommendation

## Overview
- Add per-hero boot and Retribution blessing recommendations to jungler recommendation cards
- Uses existing hero data (role, speciality, capabilities) + enemy team analysis to compute optimal boots
- Boots shown on both compact cards (pill tags) and expanded cards (detailed section with reasoning)
- No new data fetching — purely computational logic on existing `Hero` and enemy team data

## Context (from discovery)
- Files/components involved:
  - `src/types/hero.ts` — add `BootRecommendation` type to `RecommendationResult`
  - `src/utils/heroUtils.ts` — add `recommendBoots()` function, call from `calculateJunglerRecommendation()`
  - `src/components/CompactRecommendationCard/CompactRecommendationCard.tsx` — render boot tags
  - `src/components/CompactRecommendationCard/CompactRecommendationCard.module.css` — boot tag styles
- Related patterns: existing `capTag`, `strengthTag`, `warningTag` pill-style tags
- Reusable helpers: `isPrimarilyPhysical()`, `isPrimarilyMagic()`, `getCCScore()`, `getMobilityScore()`, `classifyJunglerType()`, `hasSustainCapability()`
- Dependencies: none new — all data already available in hero objects and enemy team array

## Development Approach
- **Testing approach**: vitest (setup vitest + write unit tests for boot recommendation logic)
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests** for code changes in that task
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes during implementation**
- Run tests after each change
- Maintain backward compatibility

## Testing Strategy
- **Unit tests**: vitest for `recommendBoots()` logic with various hero/enemy combinations
- **Build verification**: `pnpm build` + `pnpm lint` must pass after each task

## Progress Tracking
- Mark completed items with `[x]` immediately when done
- Add newly discovered tasks with + prefix
- Document issues/blockers with ! prefix
- Update plan if implementation deviates from original scope
- Keep plan in sync with actual work done

## Boot Recommendation Logic

### Boot Selection (based on enemy team + hero type)

Priority order:
1. **Enemy CC score high** (sum of `getCCScore()` across enemies >= 4, or >= 3 CC heroes) -> `Tough Boots`
2. **Enemy predominantly physical** (>= 3 physical damage dealers) -> `Warrior Boots`
3. **Hero is Mage** (`role` includes Mage, or `isPrimarilyMagic()`) -> `Arcane Boots`
4. **Hero is auto-attack based** (`role` includes Marksman, or speciality includes "Push"/"Damage" with Fighter role) -> `Swift Boots`
5. **Default** -> `Magic Shoes` (CDR is universally useful)

### Retribution Blessing Selection (based on hero type + capabilities)

Priority order:
1. **Hero is Tank/tanky** (`role` includes Tank, or `classifyJunglerType()` is UTILITY with `hasSustain`) -> `Bloody`
2. **Hero is burst-oriented** (`maxBurstDamage` > 400, or speciality includes "Burst"/"Finisher") -> `Flame`
3. **Default** -> `Ice` (most versatile, best for chase/escape)

### Reason Generation
Each recommendation includes a short reason string (max ~25 chars) explaining why:
- "High enemy CC" / "Enemy phys. heavy" / "Magic penetration" / "Attack speed scaling" / "Cooldown reduction"
- "HP sustain in fights" / "Burst stat steal" / "Chase & escape"

## Implementation Steps

### Task 1: Setup vitest
- [x] install vitest as dev dependency (add to package.json)
- [x] create `vitest.config.ts` with basic TypeScript config
- [x] add `"test": "vitest run"` script to package.json
- [x] create `src/utils/__tests__/heroUtils.test.ts` with a trivial passing test
- [x] run `pnpm test` + `pnpm lint` - must pass

### Task 2: Add BootRecommendation types
- [x] add `BootType` type: `'Tough Boots' | 'Warrior Boots' | 'Arcane Boots' | 'Swift Boots' | 'Magic Shoes' | 'Rapid Boots'`
- [x] add `RetributionBlessing` type: `'Ice' | 'Flame' | 'Bloody'`
- [x] add `BootRecommendation` interface: `{ boots: BootType; bootsReason: string; blessing: RetributionBlessing; blessingReason: string }`
- [x] add `bootRecommendation` optional field to `RecommendationResult`
- [x] run `pnpm build` + `pnpm lint` - must pass (no consumers yet, backward compatible)
- [x] write test: verify type imports work (smoke test)
- [x] run `pnpm test` + `pnpm lint` - must pass

### Task 3: Implement recommendBoots() logic
- [ ] add `recommendBoots(hero: Hero, enemyTeam: Hero[]): BootRecommendation` function in `heroUtils.ts`
- [ ] implement boot selection logic (enemy CC -> Tough, enemy phys -> Warrior, mage hero -> Arcane, AA hero -> Swift, default -> Magic Shoes)
- [ ] implement blessing selection logic (tank/sustain -> Bloody, burst -> Flame, default -> Ice)
- [ ] generate short reason strings for each choice
- [ ] call `recommendBoots()` from `calculateJunglerRecommendation()` and attach to result
- [ ] write tests for boot selection: mage hero gets Arcane Boots
- [ ] write tests for boot selection: high enemy CC gives Tough Boots
- [ ] write tests for boot selection: enemy phys-heavy gives Warrior Boots
- [ ] write tests for boot selection: marksman hero gets Swift Boots
- [ ] write tests for boot selection: default case gives Magic Shoes
- [ ] write tests for blessing selection: tank hero gets Bloody
- [ ] write tests for blessing selection: burst hero gets Flame
- [ ] write tests for blessing selection: default gives Ice
- [ ] write tests for edge case: enemy team empty (should still return valid recommendation)
- [ ] run `pnpm build` + `pnpm test` + `pnpm lint` - must pass

### Task 4: Render boot tags on compact card
- [ ] add boot pill tags row below jungler type label in compact view
- [ ] display boot name with color-coded styling (Tough=blue, Warrior=orange, Arcane=purple, Swift=yellow, Magic=cyan)
- [ ] display blessing name with color-coded styling (Ice=cyan, Flame=red, Bloody=magenta)
- [ ] add `.bootRow` and `.bootTag` CSS styles following existing `capTag` pattern
- [ ] only render when `bootRecommendation` is present (backward compatible)
- [ ] run `pnpm build` + `pnpm lint` - must pass

### Task 5: Render boot details on expanded card
- [ ] add "BUILD ADVICE" section between matchups and bar chart in expanded view
- [ ] render two side-by-side mini-cards: boots (name + reason) and blessing (name + reason)
- [ ] style with `color-mix()` backgrounds matching existing `strengthTag`/`warningTag` pattern
- [ ] add `.buildAdvice`, `.buildCard`, `.buildCardLabel`, `.buildCardReason` CSS styles
- [ ] ensure responsive layout (stack vertically on small screens)
- [ ] run `pnpm build` + `pnpm lint` - must pass

### Task 6: Verify acceptance criteria
- [ ] verify boot recommendation appears on compact cards
- [ ] verify boot recommendation details appear on expanded cards
- [ ] verify recommendation changes when enemy team changes
- [ ] verify recommendation changes based on hero type (mage vs fighter vs marksman)
- [ ] run full test suite (`pnpm test`)
- [ ] run `pnpm build` + `pnpm lint` - all must pass

### Task 7: [Final] Update documentation
- [ ] update CLAUDE.md Architecture section to mention boot recommendation
- [ ] update `RecommendationResult` description in CLAUDE.md Type System section

## Technical Details

### BootRecommendation interface
```typescript
export type BootType = 'Tough Boots' | 'Warrior Boots' | 'Arcane Boots' | 'Swift Boots' | 'Magic Shoes' | 'Rapid Boots';
export type RetributionBlessing = 'Ice' | 'Flame' | 'Bloody';

export interface BootRecommendation {
  boots: BootType;
  bootsReason: string;
  blessing: RetributionBlessing;
  blessingReason: string;
}
```

### Color mapping
```
Boots:
  Tough Boots    -> var(--blue)    (magic defense)
  Warrior Boots  -> var(--orange)  (physical defense)
  Arcane Boots   -> var(--purple)  (magic pen)
  Swift Boots    -> var(--yellow)  (attack speed)
  Magic Shoes    -> var(--cyan)    (CDR)
  Rapid Boots    -> var(--green)   (movement speed)

Blessing:
  Ice    -> var(--cyan)
  Flame  -> var(--red)
  Bloody -> var(--magenta)
```

### Helper function reuse
- `isPrimarilyPhysical(hero)` / `isPrimarilyMagic(hero)` — damage type detection
- `getCCScore(hero)` — CC threat per enemy hero
- `getMobilityScore(hero)` — mobility assessment
- `classifyJunglerType(hero)` — DAMAGE/UTILITY/HYBRID
- `hasSustainCapability(hero)` — sustain detection

## Post-Completion

**Manual verification:**
- Test with various enemy compositions (heavy CC team, all-physical team, mixed team)
- Test with different jungler types (mage jungler like Harley, marksman like YSS, tank like Barats, assassin like Ling)
- Verify compact card doesn't overflow on small screens with boot tags added
- Check both light and dark theme rendering
