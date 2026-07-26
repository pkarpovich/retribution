import type { BootRecommendation, HeroTier, RecommendationWarning, ScoreBreakdown } from './hero';

export type MatchOutcome = 'pending' | 'won' | 'lost';

export interface MatchHero {
  id: number;
  name: string;
}

// A record is self-contained on purpose. heroes.json is refreshed twice a week,
// so a game that only named heroes would stop being readable as soon as the
// tiers and win rates behind it moved. Everything the engine saw and said is
// written down at the moment of the pick.
export interface MatchRecord {
  id: string;
  at: string;
  dataVersion: string;
  outcome: MatchOutcome;
  note: string;

  enemies: MatchHero[];
  allies: MatchHero[];
  matchBans: MatchHero[];
  pick: MatchHero & { tier: HeroTier };

  // Where the pick stood among the suggestions on screen. This is the field the
  // whole log exists for: it is the only place the player disagrees with the
  // engine on the record.
  rank: number | null;
  shown: number;
  followedAdvice: boolean;
  top: MatchHero | null;

  totalScore: number;
  breakdown: ScoreBreakdown;
  warnings: RecommendationWarning[];
  strengths: string[];
  build: BootRecommendation;
  needs: { key: string; name: string; evidence: string }[];
}

export const MATCH_SCHEMA = 1;
