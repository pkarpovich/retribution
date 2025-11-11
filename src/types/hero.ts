export type HeroRole = 'Tank' | 'Fighter' | 'Assassin' | 'Mage' | 'Marksman' | 'Support';
export type HeroLane = 'Jungle' | 'Exp Lane' | 'Mid Lane' | 'Gold Lane' | 'Roam';
export type HeroTier = 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';

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
}

export interface HeroData {
  lastUpdated: string;
  totalHeroes: number;
  heroes: Hero[];
}
