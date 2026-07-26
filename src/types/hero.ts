export type HeroRole = 'Tank' | 'Fighter' | 'Assassin' | 'Mage' | 'Marksman' | 'Support';
export type HeroLane = 'Jungle' | 'Exp Lane' | 'Mid Lane' | 'Gold Lane' | 'Roam';
export type HeroTier = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
export type UserRank = 'Epic' | 'Legend' | 'Mythic' | 'Mythical Honor' | 'Mythical Glory+';
export type JunglerType = 'DAMAGE' | 'UTILITY' | 'HYBRID';
export type BootType = 'Tough Boots' | 'Warrior Boots' | 'Arcane Boots' | 'Swift Boots' | 'Magic Shoes';
export type RetributionBlessing = 'Ice' | 'Flame' | 'Bloody';

export interface BootRecommendation {
  boots: BootType;
  bootsReason: string;
  blessing: RetributionBlessing;
  blessingReason: string;
}
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

export type CapabilitySource = 'liquipedia';

export interface HeroBaseStats {
  hp?: number;
  hpReg?: number;
  mana?: number;
  manaReg?: number;
  phyAtk?: number;
  phyDef?: number;
  magDef?: number;
  moveSpeed?: number;
  atkSpeed?: number;
}

export interface HeroStatProfile {
  durability: number;
  regen: number;
  attack: number;
  speed: number;
}

export interface HeroCapabilities {
  mobilityScore: number;
  ccScore: number;
  hasSustain: boolean;
  selfSustain: boolean;
  allySustain: boolean;
  antiHeal: boolean;
  hasAOE: boolean;
  hasImmunity: boolean;
  hasShield: boolean;
  armorAgnostic: number;
  damageReduction: boolean;
  maxBurstDamage: number;
  avgCooldown: number | null;
  baseStats: HeroBaseStats | null;
  statProfile?: HeroStatProfile;
  source: CapabilitySource;
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
  capabilities?: HeroCapabilities | null;
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
  type: 'WEAK_AGAINST' | 'INVADE_VULNERABLE' | 'HIGH_CC_THREAT';
  hero?: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

export interface JunglerEvaluation {
  hero: Hero;
  total_score: number;
  breakdown: ScoreBreakdown;
  jungler_type: JunglerType;
  warnings: RecommendationWarning[];
  strengths: string[];
  bootRecommendation: BootRecommendation;
}

export interface RecommendationResult extends JunglerEvaluation {
  recommendation_level: RecommendationLevel;
}
