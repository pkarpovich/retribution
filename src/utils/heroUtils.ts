import type { Hero, HeroTier, HeroRole } from '../types/hero';

export function getJunglers(heroes: Hero[]): Hero[] {
  return heroes.filter(hero => hero.lane?.includes('Jungle'));
}

export function getTierScore(tier: HeroTier): number {
  const scores: Record<HeroTier, number> = {
    'SS': 5,
    'S': 4,
    'A': 3,
    'B': 2,
    'C': 1,
    'D': 0
  };
  return scores[tier] || 0;
}

export function getLatestStats(hero: Hero) {
  const allRankStats = hero.statistics.filter(s => s.rank_name === 'ALL');
  const latest = allRankStats.find(s => s.timeframe_name === 'Past 7 days');
  return latest || allRankStats[0] || hero.statistics[0];
}

export function filterByRole(heroes: Hero[], role: HeroRole | 'All'): Hero[] {
  if (role === 'All') return heroes;
  return heroes.filter(hero => hero.role.includes(role));
}

export function getCounterScore(jungler: Hero, enemies: Hero[]): number {
  if (enemies.length === 0) return 0;

  let score = 0;

  const junglerRoles = new Set(jungler.role);
  const junglerSpecialties = new Set(jungler.speciality);

  for (const enemy of enemies) {
    if (enemy.role.includes('Marksman') || enemy.role.includes('Mage')) {
      if (junglerRoles.has('Assassin') || junglerSpecialties.has('Burst')) {
        score += 2;
      }
    }

    if (enemy.role.includes('Tank') || enemy.role.includes('Fighter')) {
      if (junglerSpecialties.has('Damage') || junglerSpecialties.has('Finisher')) {
        score += 1;
      }
    }

    if (enemy.role.includes('Assassin')) {
      if (junglerRoles.has('Tank') || junglerRoles.has('Fighter')) {
        score += 1.5;
      }
    }
  }

  return score;
}

export function recommendJunglers(junglers: Hero[], enemies: Hero[]): Hero[] {
  if (enemies.length === 0) return [];

  const scored = junglers.map(jungler => {
    const stats = getLatestStats(jungler);
    const tierScore = getTierScore(jungler.tier);
    const counterScore = getCounterScore(jungler, enemies);
    const winRateBonus = (stats.win_rate - 50) / 10;

    const totalScore = tierScore + counterScore + winRateBonus;

    return { jungler, totalScore };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  return scored.slice(0, 5).map(s => s.jungler);
}
