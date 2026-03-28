export type HeroRole = 'Tank' | 'Fighter' | 'Assassin' | 'Mage' | 'Marksman' | 'Support';
export type HeroLane = 'Jungle' | 'Exp Lane' | 'Mid Lane' | 'Gold Lane' | 'Roam';
export type HeroTier = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
export type UserRank = 'Epic' | 'Legend' | 'Mythic' | 'Mythical Honor' | 'Mythical Glory';
export type JunglerType = 'DAMAGE' | 'UTILITY' | 'HYBRID';
export type RecommendationLevel = 'BEST_PICK' | 'STRONG_PICK' | 'GOOD_PICK' | 'SAFE_PICK' | 'RISKY_PICK';

export interface HeroStatistic {
  hero_id: number;
  pick_rate: number;
  win_rate: number;
  ban_rate: number;
  rank_name: string;
  rank_id: number;
  timeframe_name: string;
  timeframe_id: number;
  created_at: string;
}

export interface HeroRelation {
  id: number;
  hero_name: string;
  img_src: string;
  role: HeroRole[];
  lane: HeroLane[];
  speciality: string[];
  weighted_score: number;
  tier: HeroTier;
  type?: string;
}

export interface SkillSummary {
  name: string;
  tags: string[];
  cooldown: number | null;
}

export interface HeroCapabilities {
  mobilityScore: number;
  ccScore: number;
  hasSustain: boolean;
  hasAOE: boolean;
  hasImmunity: boolean;
  maxBurstDamage: number;
  avgCooldown: number | null;
  skillsSummary: SkillSummary[];
}

export interface Hero {
  id: number;
  hero_name: string;
  channel_id: number;
  img_src: string;
  role: HeroRole[];
  lane: HeroLane[];
  speciality: string[];
  tier: HeroTier;
  previous_tier: HeroTier;
  score: number;
  statistics: HeroStatistic[];
  counters?: HeroRelation[];
  weakAgainst?: HeroRelation[];
  synergies?: HeroRelation[];
  strongAgainst?: HeroRelation[];
  capabilities?: HeroCapabilities;
}

export interface HeroData {
  lastUpdated: string;
  totalHeroes: number;
  heroes: Hero[];
}

export interface RecommendationWeights {
  tier: number;
  stats: number;
  team_balance: number;
  enemy_comp: number;
  counter_penalty: number;
  weak_penalty: number;
  strong_against: number;
  synergy_bonus: number;
  meta: number;
  cc_chain: number;
  invade_resistance: number;
}

export interface ScoreBreakdown {
  base: number;
  team_balance: number;
  damage_type_balance: number;
  enemy_analysis: number;
  strong_against: number;
  cc_chain_synergy: number;
  counter_penalty: number;
  synergy_bonus: number;
  meta_bonus: number;
  early_late_game: number;
  invade_resistance: number;
}

export interface RecommendationWarning {
  type: 'STRONG_COUNTER' | 'WEAK_AGAINST' | 'NO_SYNERGY' | 'INVADE_VULNERABLE' | 'HIGH_CC_THREAT';
  hero?: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

export interface RecommendationResult {
  hero: Hero;
  total_score: number;
  breakdown: ScoreBreakdown;
  jungler_type: JunglerType;
  recommendation_level: RecommendationLevel;
  warnings: RecommendationWarning[];
  strengths: string[];
}
