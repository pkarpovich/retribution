# Improved Jungler Recommendation Algorithm

## Overview
Rewrite `src/utils/heroUtils.ts` scoring algorithm to produce better jungler recommendations by leveraging enriched hero data (`capabilities`, `strongAgainst`) and implementing factors that experienced MLBB players use during draft phase.

Current algorithm scores junglers across 8 components but misses key draft factors: strongAgainst matchups, granular mobility/CC analysis, CC chain synergy, invade resistance, and immunity vs CC.

## Context
- Main file: `src/utils/heroUtils.ts` (670 lines, full rewrite)
- Types: `src/types/hero.ts` (already updated with `HeroCapabilities`, `strongAgainst`)
- Data: `src/data/heroes.json` (enriched with `capabilities` and `strongAgainst`)
- Consumer: `src/App.tsx` uses `getJunglers()`, `recommendJunglers()`, and `RecommendationResult` type
- No tests exist currently

## Development Approach
- **Testing approach**: Regular (code first)
- Complete each task fully before moving to the next
- Make small, focused changes
- Public API must stay compatible: `getJunglers()`, `recommendJunglers()`, `RecommendationResult`
- Run `pnpm build && pnpm lint` after each task

## New Scoring Pipeline Design

```
Total Score = base_score
            + strong_against_bonus     [NEW]
            + team_balance
            + damage_type_balance
            + enemy_vulnerability       [IMPROVED: uses capabilities]
            + cc_chain_synergy         [NEW]
            + invade_resistance        [NEW]
            - counter_penalty
            + synergy_bonus
            + meta_bonus
            + early_late_game
```

### Component Details

**base_score** (keep existing logic)
- Tier score: SS=100, S=80, A=60, B=40, C=20, D=10
- Win rate: quadratic bonus from 50% baseline
- Pick rate reliability bonus

**strong_against_bonus** [NEW]
- For each enemy hero in jungler's `strongAgainst` list → add `weighted_score * weight`
- Mirror of counter_penalty but positive — "you counter THEM"
- Scale: similar to counter_penalty but inverted

**team_balance** (keep existing, minor tweak)
- Existing damage dealer / tank / support counting
- Use `capabilities.hasAOE` to differentiate teamfight vs pick junglers

**damage_type_balance** (keep existing)
- Physical vs magic balance, penalize 3+ same type

**enemy_vulnerability** [IMPROVED from enemy_analysis]
- Replace binary `hasEscape()` with `capabilities.mobilityScore` for enemies
- Squishy value = enemies without mobility are MUCH more valuable targets
- Formula: for each squishy enemy → `target_value = base * (3 - enemy.capabilities.mobilityScore) / 3`
- Pharsa (mob=0) → full value; Kagura (mob=2) → 1/3 value
- Assassin junglers get bonus proportional to total target_value
- Heroes with `hasImmunity` get bonus vs high-CC enemy teams (better than just escape)

**cc_chain_synergy** [NEW]
- Count total CC score from your team: `sum(teammate.capabilities.ccScore)`
- If team CC >= 3 and jungler is burst assassin → bonus (followup potential)
- If team CC <= 1 and jungler has CC → bonus (team needs CC)
- Formula: `teamCC >= 3 && junglerType === 'DAMAGE' → 25 * weight`

**invade_resistance** [NEW]
- If enemy team is early-game aggressive (2+ early game heroes):
  - Junglers WITH sustain (`capabilities.hasSustain`) → small bonus
  - Junglers WITH high mobility (mobilityScore >= 2) → small bonus
  - Junglers WITHOUT sustain AND low mobility → penalty
- Formula: `earlyEnemies >= 2 → sustainBonus + mobilityBonus - vulnerabilityPenalty`

**counter_penalty** (keep existing)
- Uses `counters` and `weakAgainst` data from API

**synergy_bonus** (keep existing)
- Uses `synergies` data from API

**meta_bonus** (keep existing)
- Ban rate and pick rate signals

**early_late_game** (keep existing, small enhancement)
- Add: if jungler is early-game AND enemy has late-game comp → extra bonus for tempo mismatch

## Implementation Steps

### Task 1: Scaffold new heroUtils.ts with helper functions
- [x] Create fresh `src/utils/heroUtils.ts` preserving public API signatures
- [x] Write helper functions using `capabilities`: `getMobilityScore(hero)`, `getCCScore(hero)`, `hasSustainCapability(hero)`, `hasImmunityCapability(hero)`
- [x] Keep existing helpers that still make sense: `isPrimarilyPhysical()`, `isPrimarilyMagic()`, `classifyJunglerType()`, `getLatestStats()`, `getTierScore()`
- [x] Write `getJunglers()` and `filterByRole()` (unchanged)
- [x] run `pnpm build` - must compile

### Task 2: Implement base_score and meta_bonus
- [x] Implement `calculateBaseScore()` — tier + win rate + pick rate (same logic)
- [x] Implement `calculateMetaBonus()` — ban rate + pick rate signals (same logic)
- [x] Implement `getDefaultWeights()` with new weight keys for new components
- [x] Update `RecommendationWeights` type to include `strong_against`, `cc_chain`, `invade_resistance`
- [x] run `pnpm build` - must compile

### Task 3: Implement strong_against_bonus
- [x] Implement `calculateStrongAgainstBonus()` — for each enemy in `hero.strongAgainst` → weighted bonus
- [x] Use `weighted_score * weights.strong_against` scaling
- [x] Cap at reasonable max (like counter_penalty cap of 120)
- [x] run `pnpm build` - must compile

### Task 4: Implement improved enemy_vulnerability
- [x] Implement `calculateEnemyVulnerability()` replacing old `calculateEnemyAnalysis()`
- [x] Use `capabilities.mobilityScore` for enemy squishy value calculation
- [x] Assassin bonus scales with total target vulnerability
- [x] Add `hasImmunity` bonus when enemy has high CC count
- [x] Keep anti-heal bonus for enemies with healers
- [x] run `pnpm build` - must compile

### Task 5: Implement cc_chain_synergy
- [x] Implement `calculateCCChainSynergy()` — count team CC from `capabilities.ccScore`
- [x] High team CC + burst jungler → followup bonus
- [x] Low team CC + CC jungler → fill-the-gap bonus
- [x] run `pnpm build` - must compile

### Task 6: Implement invade_resistance
- [x] Implement `calculateInvadeResistance()` — assess enemy early-game aggression
- [x] Junglers with sustain/high mobility → bonus vs aggressive comps
- [x] Fragile junglers (no sustain, low mobility) → penalty vs aggressive comps
- [x] Only activate when 2+ enemy heroes are early-game
- [x] run `pnpm build` - must compile

### Task 7: Implement team_balance, damage_type_balance, early_late_game
- [ ] Port `calculateTeamBalance()` — keep existing logic
- [ ] Port `calculateDamageTypeBalance()` — keep existing logic
- [ ] Port `calculateEarlyLateGameFactor()` with enhancement: early jungler vs late enemy comp → extra bonus
- [ ] run `pnpm build` - must compile

### Task 8: Implement counter_penalty and synergy_bonus
- [ ] Port `calculateCounterPenalty()` — same existing logic with weights
- [ ] Port `calculateSynergyBonus()` — same existing logic
- [ ] run `pnpm build` - must compile

### Task 9: Wire up scoring pipeline and recommendation
- [ ] Implement `calculateJunglerRecommendation()` combining all components
- [ ] Update `ScoreBreakdown` type to include new fields: `strong_against`, `cc_chain_synergy`, `invade_resistance`
- [ ] Update `getRecommendationLevel()` thresholds if needed
- [ ] Implement `generateWarnings()` — port existing + add new warning types
- [ ] Implement `generateStrengths()` — port existing + add new strength types
- [ ] Implement `recommendJunglers()` — same signature, uses new scoring
- [ ] run `pnpm build && pnpm lint` - must pass

### Task 10: Verify and tune
- [ ] Verify all requirements from Overview are implemented
- [ ] Run `pnpm build && pnpm lint` — all clean
- [ ] Manual sanity check: select 5 enemy comps and verify recommendations make sense
- [ ] Tune thresholds/weights if scores seem off

## Technical Details

### Weight Structure (Mythic rank example)
```ts
{
  tier: 0.3,
  stats: 0.5,
  team_balance: 1.2,
  enemy_comp: 1.0,
  counter_penalty: 10,
  weak_penalty: 15,
  strong_against: 8,       // NEW
  synergy_bonus: 5,
  meta: 0.8,
  cc_chain: 1.0,           // NEW
  invade_resistance: 0.8,  // NEW
}
```

### Enemy Vulnerability Formula
```
for each enemy:
  if role in [Mage, Marksman, Assassin]:
    mobilityFactor = max(0.2, (3 - enemy.capabilities.mobilityScore) / 3)
    targetValue += mobilityFactor

assassinBonus = targetValue * 15 * weights.enemy_comp

if enemyCCCount >= 3 && hero.capabilities.hasImmunity:
  immunityBonus = 20 * weights.enemy_comp
```

### CC Chain Synergy Formula
```
teamCCScore = sum(teammate.capabilities.ccScore for each teammate)

if teamCCScore >= 3 && junglerType === 'DAMAGE':
  bonus = 25 * weights.cc_chain
elif teamCCScore <= 1 && hero.capabilities.ccScore >= 2:
  bonus = 20 * weights.cc_chain
```

### Invade Resistance Formula
```
enemyEarlyCount = count enemies with isEarlyGame()

if enemyEarlyCount >= 2:
  sustainBonus = hero.capabilities.hasSustain ? 15 : 0
  mobilityBonus = hero.capabilities.mobilityScore >= 2 ? 10 : 0
  fragileFlag = !hero.capabilities.hasSustain && hero.capabilities.mobilityScore <= 1
  fragilePenalty = fragileFlag ? -20 : 0

  score = (sustainBonus + mobilityBonus + fragilePenalty) * weights.invade_resistance
```

## Post-Completion
- Test with various enemy compositions visually in the app
- Consider adding a "Why this pick?" expanded explanation using new scoring data
- Future: rank-specific tuning of new weights
