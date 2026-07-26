import type {
  Hero,
  HeroTier,
  UserRank,
  JunglerType,
  RecommendationLevel,
  RecommendationWeights,
  RecommendationResult,
  JunglerEvaluation,
  ScoreBreakdown,
  RecommendationWarning,
  BootRecommendation
} from '../types/hero';

// ---------------------------------------------------------------------------
// Public API: getJunglers, recommendJunglers, calculateJunglerRecommendation
// ---------------------------------------------------------------------------

export function getJunglers(heroes: Hero[]): Hero[] {
  return heroes.filter(hero => hero.lane?.includes('Jungle'));
}

// ---------------------------------------------------------------------------
// Capability helpers (NEW — use enriched hero.capabilities data)
// ---------------------------------------------------------------------------

export function getMobilityScore(hero: Hero): number {
  const mobilitySpecs = ['Charge', 'Chase', 'Blink'];
  const specScore = Math.min(mobilitySpecs.filter(i => hero.speciality.includes(i)).length, 3);
  if (hero.capabilities) return Math.min(Math.max(hero.capabilities.mobilityScore, specScore), 3);
  if (specScore > 0) return specScore;
  if (hero.role.includes('Assassin')) return 1;
  return 0;
}

export function getCCScore(hero: Hero): number {
  if (hero.capabilities) return hero.capabilities.ccScore;
  const ccIndicators = ['Crowd Control', 'Control', 'Initiator'];
  const matches = ccIndicators.filter(i => hero.speciality.includes(i));
  return Math.min(matches.length * 2, 3);
}

export function hasSustainCapability(hero: Hero): boolean {
  if (hero.capabilities) return hero.capabilities.hasSustain;
  return hero.speciality.includes('Regen') || hero.speciality.includes('Support');
}

export function hasImmunityCapability(hero: Hero): boolean {
  if (hero.capabilities) return hero.capabilities.hasImmunity;
  return false;
}

// ---------------------------------------------------------------------------
// Kept helpers: tier, stats, classification, damage type, roles
// ---------------------------------------------------------------------------

export function getTierScore(tier: HeroTier): number {
  const scores: Record<HeroTier, number> = {
    'SS': 100,
    'S': 80,
    'A': 60,
    'B': 40,
    'C': 20,
    'D': 10
  };
  return scores[tier] || 0;
}

export function getLatestStats(hero: Hero, userRank: UserRank = 'Mythic') {
  const rankStats = hero.statistics.filter(s => s.rank_name === userRank);
  const latest = rankStats.find(s => s.timeframe_name === 'Past 7 days');
  if (latest) return latest;

  const allRankStats = hero.statistics.filter(s => s.rank_name === 'ALL');
  const latestAll = allRankStats.find(s => s.timeframe_name === 'Past 7 days');
  return latestAll || allRankStats[0] || hero.statistics[0];
}

function isPrimarilyPhysical(hero: Hero): boolean {
  const physicalIndicators = ['Marksman', 'Fighter'];
  const physicalSpecs = ['Physical Damage', 'Damage'];

  const hasPhysicalRole = hero.role.some(r => physicalIndicators.includes(r));
  const hasMagicRole = hero.role.includes('Mage');
  const hasMagicSpec = hero.speciality.includes('Magic Damage');

  if (hasMagicRole || hasMagicSpec) return false;
  return hasPhysicalRole || physicalSpecs.some(s => hero.speciality.includes(s));
}

function isPrimarilyMagic(hero: Hero): boolean {
  return hero.role.includes('Mage') || hero.speciality.includes('Magic Damage');
}

function isEarlyGame(hero: Hero): boolean {
  const earlyIndicators = ['Burst', 'Initiator', 'Charge', 'Push'];
  return earlyIndicators.some(indicator => hero.speciality.includes(indicator));
}

function isLateGame(hero: Hero): boolean {
  const lateIndicators = ['Finisher'];
  return lateIndicators.some(indicator => hero.speciality.includes(indicator));
}

function isDamageDealer(hero: Hero): boolean {
  const damageRoles = ['Assassin', 'Marksman', 'Mage'];
  const damageSpecs = ['Finisher', 'Burst', 'Damage', 'Magic Damage', 'Mixed Damage'];

  const hasDamageRole = hero.role.some(r => damageRoles.includes(r));
  const hasDamageSpec = hero.speciality.some(s => damageSpecs.includes(s));

  return hasDamageRole || hasDamageSpec;
}

export function classifyJunglerType(hero: Hero): JunglerType {
  const utilityIndicators = {
    roles: ['Tank'],
    specialities: ['Guard', 'Initiator', 'Crowd Control', 'Control', 'Support', 'Regen']
  };

  const damageIndicators = {
    roles: ['Assassin', 'Marksman'],
    specialities: ['Finisher', 'Burst', 'Chase', 'Damage', 'Magic Damage', 'Mixed Damage']
  };

  let utilityScore = 0;
  let damageScore = 0;

  for (const role of hero.role) {
    if (utilityIndicators.roles.includes(role)) {
      utilityScore += 2;
    }
    if (damageIndicators.roles.includes(role)) {
      damageScore += 2;
    }
  }

  for (const spec of hero.speciality) {
    if (utilityIndicators.specialities.includes(spec)) {
      utilityScore += 1;
    }
    if (damageIndicators.specialities.includes(spec)) {
      damageScore += 1;
    }
  }

  if (utilityScore > damageScore) {
    return 'UTILITY';
  } else if (damageScore > utilityScore) {
    return 'DAMAGE';
  }
  return 'HYBRID';
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

export function getDefaultWeights(userRank: UserRank): RecommendationWeights {
  const weightsByRank: Record<UserRank, RecommendationWeights> = {
    'Epic': {
      tier: 0.5,
      stats: 0.3,
      team_balance: 0.8,
      enemy_comp: 0.6,
      counter_penalty: 7,
      strong_against: 4,
      synergy_bonus: 3,
      meta: 0.4,
      cc_chain: 0.5,
      invade_resistance: 0.4
    },
    'Legend': {
      tier: 0.4,
      stats: 0.4,
      team_balance: 1.0,
      enemy_comp: 0.8,
      counter_penalty: 10,
      strong_against: 6,
      synergy_bonus: 5,
      meta: 0.6,
      cc_chain: 0.7,
      invade_resistance: 0.6
    },
    'Mythic': {
      tier: 0.3,
      stats: 0.5,
      team_balance: 1.2,
      enemy_comp: 1.0,
      counter_penalty: 15,
      strong_against: 8,
      synergy_bonus: 5,
      meta: 0.8,
      cc_chain: 1.0,
      invade_resistance: 0.8
    },
    'Mythical Honor': {
      tier: 0.3,
      stats: 0.6,
      team_balance: 1.5,
      enemy_comp: 1.2,
      counter_penalty: 18,
      strong_against: 10,
      synergy_bonus: 6,
      meta: 1.0,
      cc_chain: 1.2,
      invade_resistance: 1.0
    },
    'Mythical Glory+': {
      tier: 0.2,
      stats: 0.7,
      team_balance: 1.8,
      enemy_comp: 1.5,
      counter_penalty: 20,
      strong_against: 12,
      synergy_bonus: 8,
      meta: 1.2,
      cc_chain: 1.5,
      invade_resistance: 1.2
    }
  };

  return weightsByRank[userRank];
}

// ---------------------------------------------------------------------------
// Scoring components (will be enhanced in subsequent tasks)
// ---------------------------------------------------------------------------

function calculateBaseScore(
  hero: Hero,
  userRank: UserRank,
  weights: RecommendationWeights
): number {
  const tierScore = getTierScore(hero.tier);
  const stats = getLatestStats(hero, userRank);

  let statBonus = 0;
  if (stats) {
    const wrDiff = stats.win_rate - 50;
    const winRateModifier = wrDiff * Math.abs(wrDiff) * 0.08;

    const pickRateReliability = stats.pick_rate > 0.5 ? Math.min(stats.pick_rate * 0.5, 3) : 0;

    statBonus = winRateModifier + pickRateReliability;
  }

  return ((tierScore * weights.tier) + (statBonus * weights.stats)) * FOUNDATION_SCALE;
}

function calculateTeamBalance(
  hero: Hero,
  yourTeam: Hero[],
  weights: RecommendationWeights
): number {
  if (yourTeam.length === 0) return 0;

  const confidence = Math.min(yourTeam.length / MAX_ALLIES, 1);
  const heroType = classifyJunglerType(hero);

  const teamStats = {
    damageDealers: 0,
    tanks: 0,
    hasAOE: false
  };

  for (const teammate of yourTeam) {
    if (isDamageDealer(teammate)) {
      teamStats.damageDealers += 1;
    }
    if (teammate.role.includes('Tank')) {
      teamStats.tanks += 1;
    }
    if (teammate.capabilities?.hasAOE) {
      teamStats.hasAOE = true;
    }
  }

  let score = 0;

  const damageNeed = teamStats.damageDealers === 0 ? 60 :
                     teamStats.damageDealers === 1 ? 30 :
                     teamStats.damageDealers === 2 ? 10 : -10;

  const utilityNeed = teamStats.damageDealers >= 3 ? 50 :
                      teamStats.damageDealers === 2 ? 30 : 0;

  if (heroType === 'DAMAGE') {
    score += damageNeed * weights.team_balance;
  } else if (heroType === 'UTILITY') {
    score += utilityNeed * weights.team_balance;
  } else if (heroType === 'HYBRID') {
    score += Math.max(damageNeed, utilityNeed) * 0.6 * weights.team_balance;
  }

  if (teamStats.tanks === 0 && heroType === 'UTILITY') {
    score += 30 * weights.team_balance;
  }

  if (teamStats.tanks >= 2 && heroType === 'UTILITY') {
    score -= 20 * weights.team_balance;
  }

  if (!teamStats.hasAOE && hero.capabilities?.hasAOE) {
    score += 20 * weights.team_balance;
  }

  return score * confidence;
}

function calculateDamageTypeBalance(
  hero: Hero,
  yourTeam: Hero[],
  weights: RecommendationWeights
): number {
  const physicalCount = yourTeam.filter(h => isPrimarilyPhysical(h)).length;
  const magicCount = yourTeam.filter(h => isPrimarilyMagic(h)).length;

  const heroIsPhysical = isPrimarilyPhysical(hero);
  const heroIsMagic = isPrimarilyMagic(hero);

  let score = 0;

  if (heroIsPhysical && physicalCount >= 3) {
    score -= 20 * weights.team_balance;
  } else if (heroIsMagic && magicCount >= 3) {
    score -= 20 * weights.team_balance;
  }

  if (heroIsPhysical && physicalCount < magicCount) {
    score += 15 * weights.team_balance;
  } else if (heroIsMagic && magicCount < physicalCount) {
    score += 15 * weights.team_balance;
  }

  return score;
}

const FULL_SHARE_AT = 0.4;
const SPECIALIST_STEP = 15;
const SPECIALIST_CAP = 3;
const HIGH_CC_SHARE = 0.6;
const DURABLE_PROFILE = 0.7;
const CC_SATURATES_AT = 4;
const CATCH_BONUS = 25;
const ANTI_HEAL_BONUS = 25;
const ARMOR_BREAK_BONUS = 30;
const ARMOR_AGNOSTIC_MAX = 2;
const IMMUNITY_DAMPING = 0.5;
const MAX_ALLIES = 4;
const BAN_RATE_SATURATES_AT = 50;
const PICK_RATE_SATURATES_AT = 3;
const FOUNDATION_SCALE = 3;
const SITUATIONAL_BUDGET = 0.5;
const SITUATIONAL_REFERENCE = 150;

function hasSurvivability(hero: Hero): boolean {
  const capabilities = hero.capabilities;
  if (!capabilities) return hasSustainCapability(hero);
  if (capabilities.selfSustain || capabilities.hasShield || capabilities.damageReduction) return true;
  return (capabilities.statProfile?.durability ?? 0) >= DURABLE_PROFILE;
}

export interface EnemyRuleReadout {
  revealed: number;
  squishy: number;
  tanks: number;
  ccCount: number;
  sustainCount: number;
  immunityCount: number;
  mobilityShare: number;
  mitigation: number;
  antiHealPoints: number;
  armourBreakPoints: number;
  catchPoints: number;
}

export function enemyRuleReadout(
  enemyTeam: Hero[],
  userRank: UserRank = 'Mythic'
): EnemyRuleReadout | null {
  if (enemyTeam.length === 0) return null;

  const weights = getDefaultWeights(userRank);
  const revealed = enemyTeam.length;

  let squishy = 0;
  let tanks = 0;
  let ccCount = 0;
  let sustainCount = 0;
  let immunityCount = 0;
  let mobilityValue = 0;
  let mitigationValue = 0;

  for (const enemy of enemyTeam) {
    if (enemy.role.includes('Tank')) tanks += 1;
    if (!enemy.role.includes('Tank') && enemy.role.some(r => ['Mage', 'Marksman', 'Assassin'].includes(r))) {
      squishy += 1;
    }
    if (getCCScore(enemy) >= 1) ccCount += 1;
    if (enemy.capabilities?.selfSustain || enemy.capabilities?.allySustain) sustainCount += 1;
    if (hasImmunityCapability(enemy)) immunityCount += 1;

    mobilityValue += Math.min(getMobilityScore(enemy), 3) / 3;
    mitigationValue += (enemy.capabilities?.statProfile?.durability ?? 0.5) * 0.6
      + (enemy.capabilities?.damageReduction ? 0.2 : 0)
      + (enemy.capabilities?.hasShield ? 0.2 : 0);
  }

  const mobilityShare = mobilityValue / revealed;
  const damping = 1 - IMMUNITY_DAMPING * (immunityCount / revealed);

  return {
    revealed,
    squishy,
    tanks,
    ccCount,
    sustainCount,
    immunityCount,
    mobilityShare,
    mitigation: mitigationValue / revealed,
    antiHealPoints: ANTI_HEAL_BONUS * (sustainCount / revealed) * weights.enemy_comp,
    armourBreakPoints: ARMOR_BREAK_BONUS * (mitigationValue / revealed) * weights.enemy_comp,
    catchPoints: CATCH_BONUS * mobilityShare * damping * weights.enemy_comp,
  };
}

function calculateEnemyVulnerability(
  hero: Hero,
  enemyTeam: Hero[],
  weights: RecommendationWeights
): number {
  if (enemyTeam.length === 0) return 0;

  const heroType = classifyJunglerType(hero);

  const enemyStats = {
    tanks: 0,
    squishyTargetValue: 0,
    ccCount: 0,
    mobilityValue: 0,
    sustainCount: 0,
    immunityCount: 0,
    mitigationValue: 0
  };

  for (const enemy of enemyTeam) {
    if (enemy.role.includes('Tank')) {
      enemyStats.tanks += 1;
    }

    enemyStats.mobilityValue += Math.min(getMobilityScore(enemy), 3) / 3;

    if (enemy.capabilities?.selfSustain || enemy.capabilities?.allySustain) {
      enemyStats.sustainCount += 1;
    }

    if (hasImmunityCapability(enemy)) {
      enemyStats.immunityCount += 1;
    }

    enemyStats.mitigationValue += (enemy.capabilities?.statProfile?.durability ?? 0.5) * 0.6
      + (enemy.capabilities?.damageReduction ? 0.2 : 0)
      + (enemy.capabilities?.hasShield ? 0.2 : 0);

    const isSquishyRole =
      !enemy.role.includes('Tank') && (
        enemy.role.includes('Mage') ||
        enemy.role.includes('Marksman') ||
        enemy.role.includes('Assassin')
      );

    if (isSquishyRole) {
      const enemyMobility = getMobilityScore(enemy);
      const mobilityFactor = Math.max(0.2, (3 - enemyMobility) / 3);
      enemyStats.squishyTargetValue += mobilityFactor;
    }

    if (getCCScore(enemy) >= 1) {
      enemyStats.ccCount += 1;
    }
  }

  let score = 0;

  const revealed = enemyTeam.length;
  const ramp = (share: number) => 50 * Math.min(share / FULL_SHARE_AT, 1);
  const tankBonus = ramp(enemyStats.tanks / revealed);
  const squishyBonus = ramp(enemyStats.squishyTargetValue / revealed);

  if (heroType === 'DAMAGE') {
    score += squishyBonus * weights.enemy_comp;
  } else if (heroType === 'UTILITY') {
    score += tankBonus * weights.enemy_comp;
  } else if (heroType === 'HYBRID') {
    score += Math.max(tankBonus, squishyBonus) * 0.6 * weights.enemy_comp;
  }

  if (hero.role.includes('Assassin')) {
    score += Math.min(enemyStats.squishyTargetValue, SPECIALIST_CAP) * SPECIALIST_STEP * weights.enemy_comp;
  }

  if (hero.role.includes('Tank')) {
    score += Math.min(enemyStats.tanks, SPECIALIST_CAP) * SPECIALIST_STEP * weights.enemy_comp;
  }

  if (enemyStats.ccCount / revealed >= HIGH_CC_SHARE && hasImmunityCapability(hero)) {
    score += 20 * weights.enemy_comp;
  }

  const lockdown = Math.min(getCCScore(hero) / CC_SATURATES_AT, 1);
  const slippery = 1 - IMMUNITY_DAMPING * (enemyStats.immunityCount / revealed);
  score += CATCH_BONUS * (enemyStats.mobilityValue / revealed) * lockdown * slippery * weights.enemy_comp;

  if (hero.capabilities?.antiHeal) {
    score += ANTI_HEAL_BONUS * (enemyStats.sustainCount / revealed) * weights.enemy_comp;
  }

  const armorBreak = Math.min((hero.capabilities?.armorAgnostic ?? 0) / ARMOR_AGNOSTIC_MAX, 1);
  score += ARMOR_BREAK_BONUS * armorBreak * (enemyStats.mitigationValue / revealed) * weights.enemy_comp;

  return score;
}

function calculateStrongAgainstBonus(
  hero: Hero,
  enemyTeam: Hero[],
  weights: RecommendationWeights
): number {
  if (!hero.weakAgainst) return 0;

  const enemyIds = new Set(enemyTeam.map(e => e.id));
  let rawScore = 0;

  for (const target of hero.weakAgainst) {
    if (enemyIds.has(target.id)) {
      rawScore += target.weighted_score;
    }
  }

  const totalBonus = Math.sqrt(rawScore) * 15 * (weights.strong_against / 10);

  return Math.min(totalBonus, 120);
}

function calculateCCChainSynergy(
  hero: Hero,
  yourTeam: Hero[],
  weights: RecommendationWeights
): number {
  if (yourTeam.length === 0) return 0;

  const teamCCScore = yourTeam.reduce((sum, teammate) => sum + getCCScore(teammate), 0);
  const junglerType = classifyJunglerType(hero);

  let bonus = 0;

  if (teamCCScore >= 3 && junglerType === 'DAMAGE') {
    bonus = 25 * weights.cc_chain;
  } else if (teamCCScore <= 1 && getCCScore(hero) >= 2) {
    bonus = 20 * weights.cc_chain;
  }

  return bonus;
}

function calculateInvadeResistance(
  hero: Hero,
  enemyTeam: Hero[],
  weights: RecommendationWeights
): number {
  const enemyEarlyCount = enemyTeam.filter(e => isEarlyGame(e)).length;

  if (enemyEarlyCount < 2) return 0;

  const survivable = hasSurvivability(hero);
  const sustainBonus = survivable ? 15 : 0;
  const mobilityBonus = getMobilityScore(hero) >= 2 ? 10 : 0;
  const fragile = !survivable && getMobilityScore(hero) <= 1;
  const fragilePenalty = fragile ? -20 : 0;

  return (sustainBonus + mobilityBonus + fragilePenalty) * weights.invade_resistance;
}

function calculateCounterPenalty(
  hero: Hero,
  enemyTeam: Hero[],
  weights: RecommendationWeights
): number {
  const enemyIds = new Set(enemyTeam.map(e => e.id));
  let weakScore = 0;

  if (hero.counters) {
    for (const counter of hero.counters) {
      if (enemyIds.has(counter.id)) {
        weakScore += counter.weighted_score;
      }
    }
  }

  const weakPenalty = Math.sqrt(weakScore) * 15 * (weights.counter_penalty / 10);

  return Math.min(weakPenalty, 120);
}

function calculateSynergyBonus(
  hero: Hero,
  yourTeam: Hero[],
  weights: RecommendationWeights
): number {
  const teamIds = new Set(yourTeam.map(t => t.id));
  let rawScore = 0;

  if (hero.synergies) {
    for (const synergy of hero.synergies) {
      if (teamIds.has(synergy.id)) {
        rawScore += synergy.weighted_score;
      }
    }
  }

  const totalBonus = Math.sqrt(rawScore) * 15 * (weights.synergy_bonus / 10);
  return Math.min(totalBonus, 120);
}

function calculateMetaBonus(
  hero: Hero,
  userRank: UserRank,
  weights: RecommendationWeights
): number {
  const stats = getLatestStats(hero, userRank);
  if (!stats) return 0;

  const banSignal = Math.min(stats.ban_rate / BAN_RATE_SATURATES_AT, 1);
  const pickSignal = Math.min(stats.pick_rate / PICK_RATE_SATURATES_AT, 1);

  return (banSignal * 20 + pickSignal * 10) * weights.meta;
}

function calculateEarlyLateGameFactor(
  hero: Hero,
  yourTeam: Hero[],
  enemyTeam: Hero[],
  weights: RecommendationWeights
): number {
  const heroIsEarly = isEarlyGame(hero);
  const heroIsLate = isLateGame(hero);

  if (heroIsEarly && heroIsLate) return 0;
  if (!heroIsEarly && !heroIsLate) return 0;

  let teamEarlyCount = 0;
  let teamLateCount = 0;
  let enemyEarlyCount = 0;
  let enemyLateCount = 0;

  for (const teammate of yourTeam) {
    if (isEarlyGame(teammate)) teamEarlyCount++;
    if (isLateGame(teammate)) teamLateCount++;
  }

  for (const enemy of enemyTeam) {
    if (isEarlyGame(enemy)) enemyEarlyCount++;
    if (isLateGame(enemy)) enemyLateCount++;
  }

  let score = 0;

  if (heroIsEarly) {
    if (teamEarlyCount >= 2) {
      score += 20 * weights.team_balance;
    }
    if (enemyLateCount >= 3) {
      score += 25 * weights.enemy_comp;
    }
  }

  if (heroIsLate) {
    if (teamLateCount >= 2) {
      score += 20 * weights.team_balance;
    }
    if (enemyEarlyCount >= 3) {
      score -= 15 * weights.enemy_comp;
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// Recommendation level
// ---------------------------------------------------------------------------

const LEVEL_BANDS: [number, RecommendationLevel][] = [
  [0.97, 'BEST_PICK'],
  [0.92, 'STRONG_PICK'],
  [0.85, 'GOOD_PICK'],
  [0.75, 'SAFE_PICK']
];

function getRelativeLevel(totalScore: number, bestScore: number): RecommendationLevel {
  if (bestScore <= 0) return 'RISKY_PICK';
  const ratio = totalScore / bestScore;
  for (const [threshold, level] of LEVEL_BANDS) {
    if (ratio >= threshold) return level;
  }
  return 'RISKY_PICK';
}

// ---------------------------------------------------------------------------
// Warnings and strengths
// ---------------------------------------------------------------------------

function generateWarnings(
  hero: Hero,
  enemyTeam: Hero[],
  weights: RecommendationWeights
): RecommendationWarning[] {
  const warnings: RecommendationWarning[] = [];
  const enemyIds = new Set(enemyTeam.map(e => e.id));
  const weakScale = weights.counter_penalty / 10;

  if (hero.counters) {
    for (const counter of hero.counters) {
      if (enemyIds.has(counter.id)) {
        const scaledScore = counter.weighted_score * weakScale;
        const severity = scaledScore > 5 ? 'HIGH' :
                        scaledScore > 2 ? 'MEDIUM' : 'LOW';
        warnings.push({
          type: 'WEAK_AGAINST',
          hero: counter.hero_name,
          severity,
          message: `${hero.hero_name} is weak against ${counter.hero_name}`
        });
      }
    }
  }

  const enemyEarlyCount = enemyTeam.filter(e => isEarlyGame(e)).length;
  if (enemyEarlyCount >= 2 && !hasSustainCapability(hero) && getMobilityScore(hero) <= 1) {
    warnings.push({
      type: 'INVADE_VULNERABLE',
      severity: 'HIGH',
      message: `${hero.hero_name} is vulnerable to early invades from aggressive enemy comp`
    });
  }

  const enemyCCCount = enemyTeam.filter(e => getCCScore(e) >= 1).length;
  if (enemyCCCount >= 3 && !hasImmunityCapability(hero)) {
    warnings.push({
      type: 'HIGH_CC_THREAT',
      severity: 'MEDIUM',
      message: `Enemy has ${enemyCCCount} CC heroes — ${hero.hero_name} lacks immunity`
    });
  }

  return warnings;
}

function generateStrengths(
  hero: Hero,
  enemyTeam: Hero[],
  breakdown: ScoreBreakdown,
  userRank: UserRank = 'Mythic'
): string[] {
  const strengths: string[] = [];
  const heroType = classifyJunglerType(hero);

  if (breakdown.team_balance > 30) {
    if (heroType === 'DAMAGE') {
      strengths.push('Team needs damage dealer');
    } else if (heroType === 'UTILITY') {
      strengths.push('Team needs utility/tank');
    } else {
      strengths.push('Versatile pick for team composition');
    }
  }

  if (breakdown.damage_type_balance > 10) {
    if (isPrimarilyPhysical(hero)) {
      strengths.push('Balances team with physical damage');
    } else if (isPrimarilyMagic(hero)) {
      strengths.push('Balances team with magic damage');
    }
  }

  if (breakdown.enemy_analysis > 40) {
    const squishyCount = enemyTeam.filter(e =>
      e.role.includes('Mage') || e.role.includes('Marksman')
    ).length;
    if (squishyCount >= 2) {
      strengths.push(`Enemy has ${squishyCount} squishy targets`);
    }
  }

  if (breakdown.early_late_game > 20) {
    if (isEarlyGame(hero)) {
      strengths.push('Strong early game pressure');
    } else if (isLateGame(hero)) {
      strengths.push('Excellent late game scaling');
    }
  }

  if (breakdown.strong_against > 20) {
    const enemyIds = new Set(enemyTeam.map(e => e.id));
    const countered = (hero.weakAgainst || [])
      .filter(wa => enemyIds.has(wa.id))
      .map(wa => wa.hero_name);
    if (countered.length > 0) {
      strengths.push(`Counters ${countered.join(', ')}`);
    }
  }

  if (breakdown.cc_chain_synergy > 15) {
    const junglerType = classifyJunglerType(hero);
    if (junglerType === 'DAMAGE') {
      strengths.push('Can follow up on team CC chains');
    } else {
      strengths.push('Fills team CC gap');
    }
  }

  if (breakdown.invade_resistance > 10) {
    strengths.push('Resistant to early invades');
  }

  if (breakdown.synergy_bonus > 15) {
    strengths.push('Strong synergy with team');
  }

  if (breakdown.meta_bonus > 15) {
    strengths.push('High meta relevance');
  }

  const stats = getLatestStats(hero, userRank);
  if (stats && stats.win_rate > 52) {
    strengths.push(`${stats.win_rate.toFixed(1)}% win rate`);
  }

  return strengths;
}

// ---------------------------------------------------------------------------
// Boot & blessing recommendation
// ---------------------------------------------------------------------------

export function recommendBoots(hero: Hero, enemyTeam: Hero[]): BootRecommendation {
  const boots = selectBoots(hero, enemyTeam);
  const blessing = selectBlessing(hero);
  return { ...boots, ...blessing };
}

function selectBoots(hero: Hero, enemyTeam: Hero[]): Pick<BootRecommendation, 'boots' | 'bootsReason'> {
  const totalEnemyCC = enemyTeam.reduce((sum, e) => sum + getCCScore(e), 0);
  const ccHeroCount = enemyTeam.filter(e => getCCScore(e) >= 1).length;

  if (totalEnemyCC >= 4 || ccHeroCount >= 3) {
    return { boots: 'Tough Boots', bootsReason: 'High enemy CC' };
  }

  const physicalDealerCount = enemyTeam.filter(e => isPrimarilyPhysical(e)).length;
  if (physicalDealerCount >= 3) {
    return { boots: 'Warrior Boots', bootsReason: 'Enemy phys. heavy' };
  }

  if (hero.role.includes('Mage') || isPrimarilyMagic(hero)) {
    return { boots: 'Arcane Boots', bootsReason: 'Magic penetration' };
  }

  const isAutoAttackBased = hero.role.includes('Marksman') ||
    (hero.role.includes('Fighter') && (
      hero.speciality.some(s => s === 'Push') ||
      (hero.speciality.some(s => s === 'Damage') && hero.capabilities?.hasAOE === false)
    ));
  if (isAutoAttackBased) {
    return { boots: 'Swift Boots', bootsReason: 'Attack speed scaling' };
  }

  return { boots: 'Magic Shoes', bootsReason: 'Cooldown reduction' };
}

function selectBlessing(hero: Hero): Pick<BootRecommendation, 'blessing' | 'blessingReason'> {
  if (hero.role.includes('Tank') || (classifyJunglerType(hero) === 'UTILITY' && hasSustainCapability(hero))) {
    return { blessing: 'Bloody', blessingReason: 'HP sustain in fights' };
  }

  const hasBurstDamage = (hero.capabilities?.maxBurstDamage ?? 0) > 400;
  const hasBurstSpec = hero.speciality.some(s => s === 'Burst' || s === 'Finisher');
  if (hasBurstDamage || hasBurstSpec) {
    return { blessing: 'Flame', blessingReason: 'Burst stat steal' };
  }

  return { blessing: 'Ice', blessingReason: 'Chase & escape' };
}

// ---------------------------------------------------------------------------
// Public API: calculateJunglerRecommendation, recommendJunglers
// ---------------------------------------------------------------------------

export function calculateJunglerRecommendation(
  hero: Hero,
  yourTeam: Hero[],
  enemyTeam: Hero[],
  userRank: UserRank = 'Mythic',
  weights?: RecommendationWeights
): JunglerEvaluation {
  const finalWeights = weights || getDefaultWeights(userRank);

  const baseScore = calculateBaseScore(hero, userRank, finalWeights);
  const teamBalanceScore = calculateTeamBalance(hero, yourTeam, finalWeights);
  const damageTypeBalanceScore = calculateDamageTypeBalance(hero, yourTeam, finalWeights);
  const enemyAnalysisScore = calculateEnemyVulnerability(hero, enemyTeam, finalWeights);
  const strongAgainstBonus = calculateStrongAgainstBonus(hero, enemyTeam, finalWeights);
  const ccChainSynergyScore = calculateCCChainSynergy(hero, yourTeam, finalWeights);
  const invadeResistanceScore = calculateInvadeResistance(hero, enemyTeam, finalWeights);
  const counterPenalty = calculateCounterPenalty(hero, enemyTeam, finalWeights);
  const synergyBonus = calculateSynergyBonus(hero, yourTeam, finalWeights);
  const metaBonus = calculateMetaBonus(hero, userRank, finalWeights);
  const earlyLateGameScore = calculateEarlyLateGameFactor(hero, yourTeam, enemyTeam, finalWeights);

  const foundation = baseScore + metaBonus;

  const situational = {
    team_balance: teamBalanceScore,
    damage_type_balance: damageTypeBalanceScore,
    enemy_analysis: enemyAnalysisScore,
    strong_against: strongAgainstBonus,
    cc_chain_synergy: ccChainSynergyScore,
    invade_resistance: invadeResistanceScore,
    counter_penalty: counterPenalty === 0 ? 0 : -counterPenalty,
    synergy_bonus: synergyBonus,
    early_late_game: earlyLateGameScore
  };

  const rawBreakdown: ScoreBreakdown = { base: baseScore, meta_bonus: metaBonus, ...situational };

  const rawSituational = Object.values(situational).reduce((sum, value) => sum + value, 0);
  const budget = SITUATIONAL_BUDGET * getTierScore('SS') * finalWeights.tier * FOUNDATION_SCALE;
  const squashed = budget > 0 ? budget * Math.tanh(rawSituational / SITUATIONAL_REFERENCE) : 0;
  const scale = rawSituational === 0 ? 1 : squashed / rawSituational;

  const breakdown: ScoreBreakdown = {
    base: baseScore,
    meta_bonus: metaBonus,
    team_balance: situational.team_balance * scale,
    damage_type_balance: situational.damage_type_balance * scale,
    enemy_analysis: situational.enemy_analysis * scale,
    strong_against: situational.strong_against * scale,
    cc_chain_synergy: situational.cc_chain_synergy * scale,
    invade_resistance: situational.invade_resistance * scale,
    counter_penalty: situational.counter_penalty * scale,
    synergy_bonus: situational.synergy_bonus * scale,
    early_late_game: situational.early_late_game * scale
  };

  const totalScore = foundation + squashed;

  const junglerType = classifyJunglerType(hero);
  const warnings = generateWarnings(hero, enemyTeam, finalWeights);
  const strengths = generateStrengths(hero, enemyTeam, rawBreakdown, userRank);

  const bootRecommendation = recommendBoots(hero, enemyTeam);

  return {
    hero,
    total_score: totalScore,
    breakdown,
    jungler_type: junglerType,
    warnings,
    strengths,
    bootRecommendation
  };
}

export function recommendJunglers(
  junglers: Hero[],
  yourTeam: Hero[],
  enemyTeam: Hero[],
  bannedHeroes: Hero[],
  userRank: UserRank = 'Mythic'
): RecommendationResult[] {
  if (enemyTeam.length === 0) return [];

  const bannedIds = new Set(bannedHeroes.map(h => h.id));
  const enemyIds = new Set(enemyTeam.map(h => h.id));
  const yourTeamIds = new Set(yourTeam.map(h => h.id));

  const unavailableIds = new Set([...bannedIds, ...enemyIds, ...yourTeamIds]);
  const availableJunglers = junglers.filter(j => !unavailableIds.has(j.id));

  const recommendations = availableJunglers.map(jungler =>
    calculateJunglerRecommendation(jungler, yourTeam, enemyTeam, userRank)
  );

  recommendations.sort((a, b) => b.total_score - a.total_score);

  const bestScore = recommendations[0]?.total_score ?? 0;

  return recommendations.slice(0, 8).map(recommendation => ({
    ...recommendation,
    recommendation_level: getRelativeLevel(recommendation.total_score, bestScore)
  }));
}
