import type {
  Hero,
  HeroTier,
  HeroRole,
  UserRank,
  JunglerType,
  RecommendationLevel,
  RecommendationWeights,
  RecommendationResult,
  ScoreBreakdown,
  RecommendationWarning
} from '../types/hero';

export function getJunglers(heroes: Hero[]): Hero[] {
  return heroes.filter(hero => hero.lane?.includes('Jungle'));
}

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

export function getDefaultWeights(userRank: UserRank): RecommendationWeights {
  const weightsByRank: Record<UserRank, RecommendationWeights> = {
    'Epic': {
      tier: 0.5,
      stats: 0.3,
      team_balance: 0.8,
      enemy_comp: 0.6,
      counter_penalty: 5,
      weak_penalty: 7,
      synergy_bonus: 3,
      meta: 0.4
    },
    'Legend': {
      tier: 0.4,
      stats: 0.4,
      team_balance: 1.0,
      enemy_comp: 0.8,
      counter_penalty: 8,
      weak_penalty: 10,
      synergy_bonus: 5,
      meta: 0.6
    },
    'Mythic': {
      tier: 0.3,
      stats: 0.5,
      team_balance: 1.2,
      enemy_comp: 1.0,
      counter_penalty: 10,
      weak_penalty: 15,
      synergy_bonus: 5,
      meta: 0.8
    },
    'Mythical Honor': {
      tier: 0.3,
      stats: 0.6,
      team_balance: 1.5,
      enemy_comp: 1.2,
      counter_penalty: 12,
      weak_penalty: 18,
      synergy_bonus: 6,
      meta: 1.0
    },
    'Mythical Glory': {
      tier: 0.2,
      stats: 0.7,
      team_balance: 1.8,
      enemy_comp: 1.5,
      counter_penalty: 15,
      weak_penalty: 20,
      synergy_bonus: 8,
      meta: 1.2
    }
  };

  return weightsByRank[userRank];
}

function calculateBaseScore(
  hero: Hero,
  userRank: UserRank,
  weights: RecommendationWeights
): number {
  const tierScore = getTierScore(hero.tier);
  const stats = getLatestStats(hero, userRank);

  let statBonus = 0;
  if (stats) {
    const winRateModifier = (stats.win_rate - 50) * 2;
    const pickRateModifier = stats.pick_rate * 2;
    statBonus = winRateModifier + pickRateModifier;
  }

  return (tierScore * weights.tier) + (statBonus * weights.stats);
}

function calculateTeamBalance(
  hero: Hero,
  yourTeam: Hero[],
  weights: RecommendationWeights
): number {
  const heroType = classifyJunglerType(hero);

  const teamStats = {
    damageDealers: 0,
    tanks: 0,
    supports: 0
  };

  for (const teammate of yourTeam) {
    if (teammate.role.includes('Assassin') || teammate.role.includes('Marksman')) {
      teamStats.damageDealers += 1;
    }
    if (teammate.role.includes('Tank')) {
      teamStats.tanks += 1;
    }
    if (teammate.role.includes('Support')) {
      teamStats.supports += 1;
    }
  }

  let score = 0;

  if (teamStats.damageDealers < 2 && heroType === 'DAMAGE') {
    score += 40 * weights.team_balance;
  } else if (teamStats.damageDealers >= 2 && heroType === 'UTILITY') {
    score += 40 * weights.team_balance;
  }

  if (teamStats.tanks === 0 && heroType === 'UTILITY') {
    score += 30 * weights.team_balance;
  }

  if (teamStats.tanks >= 2 && heroType === 'UTILITY') {
    score -= 20 * weights.team_balance;
  }

  return score;
}

function calculateEnemyAnalysis(
  hero: Hero,
  enemyTeam: Hero[],
  weights: RecommendationWeights
): number {
  const heroType = classifyJunglerType(hero);

  const enemyStats = {
    tanks: 0,
    squishies: 0
  };

  for (const enemy of enemyTeam) {
    if (enemy.role.includes('Tank')) {
      enemyStats.tanks += 1;
    } else if (
      enemy.role.includes('Mage') ||
      enemy.role.includes('Marksman') ||
      enemy.role.includes('Assassin')
    ) {
      enemyStats.squishies += 1;
    }
  }

  let score = 0;

  if (enemyStats.tanks >= 2 && heroType === 'DAMAGE') {
    score += 50 * weights.enemy_comp;
  } else if (enemyStats.squishies >= 3 && heroType === 'UTILITY') {
    score += 50 * weights.enemy_comp;
  }

  if (hero.role.includes('Assassin') && enemyStats.squishies >= 2) {
    const bonus = enemyStats.squishies * 10 * weights.enemy_comp;
    score += bonus;
  }

  return score;
}

function calculateCounterPenalty(
  hero: Hero,
  enemyTeam: Hero[],
  weights: RecommendationWeights
): number {
  const enemyIds = new Set(enemyTeam.map(e => e.id));
  let totalPenalty = 0;

  if (hero.counters) {
    for (const counter of hero.counters) {
      if (enemyIds.has(counter.id)) {
        totalPenalty += counter.weighted_score * weights.counter_penalty;
      }
    }
  }

  if (hero.weakAgainst) {
    for (const weak of hero.weakAgainst) {
      if (enemyIds.has(weak.id)) {
        totalPenalty += weak.weighted_score * weights.weak_penalty * 1.5;
      }
    }
  }

  return totalPenalty;
}

function calculateSynergyBonus(
  hero: Hero,
  yourTeam: Hero[],
  weights: RecommendationWeights
): number {
  const teamIds = new Set(yourTeam.map(t => t.id));
  let totalBonus = 0;

  if (hero.synergies) {
    for (const synergy of hero.synergies) {
      if (teamIds.has(synergy.id)) {
        totalBonus += synergy.weighted_score * weights.synergy_bonus;
      }
    }
  }

  return totalBonus;
}

function calculateMetaBonus(
  hero: Hero,
  userRank: UserRank,
  weights: RecommendationWeights
): number {
  const stats = getLatestStats(hero, userRank);
  if (!stats) return 0;

  let bonus = 0;

  if (stats.ban_rate > 50) {
    bonus += 20 * weights.meta;
  } else if (stats.ban_rate > 30) {
    bonus += 10 * weights.meta;
  }

  if (stats.pick_rate >= 1.0 && stats.pick_rate <= 3.0) {
    bonus += 10 * weights.meta;
  }

  return bonus;
}

function getRecommendationLevel(totalScore: number): RecommendationLevel {
  if (totalScore >= 180) return 'BEST_PICK';
  if (totalScore >= 140) return 'STRONG_PICK';
  if (totalScore >= 100) return 'GOOD_PICK';
  if (totalScore >= 60) return 'SAFE_PICK';
  return 'RISKY_PICK';
}

function generateWarnings(
  hero: Hero,
  enemyTeam: Hero[],
  weights: RecommendationWeights
): RecommendationWarning[] {
  const warnings: RecommendationWarning[] = [];
  const enemyIds = new Set(enemyTeam.map(e => e.id));

  if (hero.weakAgainst) {
    for (const weak of hero.weakAgainst) {
      if (enemyIds.has(weak.id)) {
        const severity = weak.weighted_score > 5 ? 'HIGH' :
                        weak.weighted_score > 2 ? 'MEDIUM' : 'LOW';
        warnings.push({
          type: 'WEAK_AGAINST',
          hero: weak.hero_name,
          severity,
          message: `${hero.hero_name} is weak against ${weak.hero_name}`
        });
      }
    }
  }

  if (hero.counters) {
    for (const counter of hero.counters) {
      if (enemyIds.has(counter.id) && counter.weighted_score > 5) {
        warnings.push({
          type: 'STRONG_COUNTER',
          hero: counter.hero_name,
          severity: 'MEDIUM',
          message: `${counter.hero_name} can counter ${hero.hero_name}`
        });
      }
    }
  }

  return warnings;
}

function generateStrengths(
  hero: Hero,
  yourTeam: Hero[],
  enemyTeam: Hero[],
  breakdown: ScoreBreakdown
): string[] {
  const strengths: string[] = [];
  const heroType = classifyJunglerType(hero);

  if (breakdown.team_balance > 30) {
    if (heroType === 'DAMAGE') {
      strengths.push('Team needs damage dealer');
    } else {
      strengths.push('Team needs utility/tank');
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

  if (breakdown.synergy_bonus > 15) {
    strengths.push('Strong synergy with team');
  }

  if (breakdown.meta_bonus > 15) {
    strengths.push('High meta relevance');
  }

  const stats = getLatestStats(hero);
  if (stats && stats.win_rate > 52) {
    strengths.push(`${stats.win_rate.toFixed(1)}% win rate`);
  }

  return strengths;
}

export function calculateJunglerRecommendation(
  hero: Hero,
  yourTeam: Hero[],
  enemyTeam: Hero[],
  bannedHeroes: Hero[],
  userRank: UserRank = 'Mythic',
  weights?: RecommendationWeights
): RecommendationResult {
  const finalWeights = weights || getDefaultWeights(userRank);

  const baseScore = calculateBaseScore(hero, userRank, finalWeights);
  const teamBalanceScore = calculateTeamBalance(hero, yourTeam, finalWeights);
  const enemyAnalysisScore = calculateEnemyAnalysis(hero, enemyTeam, finalWeights);
  const counterPenalty = calculateCounterPenalty(hero, enemyTeam, finalWeights);
  const synergyBonus = calculateSynergyBonus(hero, yourTeam, finalWeights);
  const metaBonus = calculateMetaBonus(hero, userRank, finalWeights);

  const breakdown: ScoreBreakdown = {
    base: baseScore,
    team_balance: teamBalanceScore,
    enemy_analysis: enemyAnalysisScore,
    counter_penalty: -counterPenalty,
    synergy_bonus: synergyBonus,
    meta_bonus: metaBonus
  };

  const totalScore =
    baseScore +
    teamBalanceScore +
    enemyAnalysisScore -
    counterPenalty +
    synergyBonus +
    metaBonus;

  const junglerType = classifyJunglerType(hero);
  const recommendationLevel = getRecommendationLevel(totalScore);
  const warnings = generateWarnings(hero, enemyTeam, finalWeights);
  const strengths = generateStrengths(hero, yourTeam, enemyTeam, breakdown);

  return {
    hero,
    total_score: totalScore,
    breakdown,
    jungler_type: junglerType,
    recommendation_level: recommendationLevel,
    warnings,
    strengths
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
    calculateJunglerRecommendation(jungler, yourTeam, enemyTeam, bannedHeroes, userRank)
  );

  recommendations.sort((a, b) => b.total_score - a.total_score);

  return recommendations.slice(0, 5);
}

export function filterByRole(heroes: Hero[], role: HeroRole | 'All'): Hero[] {
  if (role === 'All') return heroes;
  return heroes.filter(hero => hero.role.includes(role));
}
