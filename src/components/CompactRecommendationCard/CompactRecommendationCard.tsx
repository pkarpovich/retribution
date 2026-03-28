import type { RecommendationResult, RecommendationLevel } from '../../types/hero';
import { getLatestStats } from '../../utils/heroUtils';
import TierBadge from '../TierBadge/TierBadge';
import styles from './CompactRecommendationCard.module.css';

interface CompactRecommendationCardProps {
  result: RecommendationResult;
  rank: number;
  expanded?: boolean;
}

const RECOMMENDATION_BADGES: Record<RecommendationLevel, {
  label: string;
  gradient: string;
  glow: string;
  border: string;
  textColor: string;
}> = {
  'BEST_PICK': {
    label: 'BEST PICK',
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
    glow: 'rgba(255, 215, 0, 0.5)',
    border: '#FFD700',
    textColor: '#000'
  },
  'STRONG_PICK': {
    label: 'STRONG PICK',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    glow: 'rgba(16, 185, 129, 0.5)',
    border: '#10B981',
    textColor: '#fff'
  },
  'GOOD_PICK': {
    label: 'GOOD PICK',
    gradient: 'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)',
    glow: 'rgba(132, 204, 22, 0.5)',
    border: '#84CC16',
    textColor: '#000'
  },
  'SAFE_PICK': {
    label: 'SAFE PICK',
    gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
    glow: 'rgba(249, 115, 22, 0.5)',
    border: '#F97316',
    textColor: '#000'
  },
  'RISKY_PICK': {
    label: 'RISKY PICK',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    glow: 'rgba(239, 68, 68, 0.5)',
    border: '#EF4444',
    textColor: '#fff'
  }
};

const JUNGLER_TYPE_COLORS: Record<string, string> = {
  'DAMAGE': '#f44336',
  'UTILITY': '#2196F3',
  'HYBRID': '#9C27B0'
};

export default function CompactRecommendationCard({ result, rank, expanded = false }: CompactRecommendationCardProps) {
  const { hero, breakdown, recommendation_level, jungler_type, warnings, strengths, total_score } = result;
  const stats = getLatestStats(hero);
  const badge = RECOMMENDATION_BADGES[recommendation_level];

  const maxScore = 400;
  const scorePercentage = Math.max(0, Math.min((total_score / maxScore) * 100, 100));
  const filledDots = Math.round((scorePercentage / 100) * 5);

  return (
    <div className={`${styles.card} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.avatarContainer}>
        <img
          src={hero.img_src}
          alt={hero.hero_name}
          className={styles.heroImage}
          style={{ borderColor: badge.border, boxShadow: `0 0 12px ${badge.glow}` }}
        />
        <div
          className={styles.rankBadge}
          style={{ background: badge.gradient, color: badge.textColor }}
        >
          #{rank}
        </div>
      </div>

      <div className={styles.info}>
        <div className={styles.topRow}>
          <h4 className={styles.heroName}>{hero.hero_name}</h4>
          <TierBadge tier={hero.tier} />
          <div
            className={styles.pickLevelBadge}
            style={{ background: badge.gradient, color: badge.textColor }}
          >
            {badge.label}
          </div>
        </div>

        <div className={styles.metaRow}>
          <span
            className={styles.typeLabel}
            style={{ color: JUNGLER_TYPE_COLORS[jungler_type] }}
          >
            {jungler_type}
          </span>
          <div className={styles.scoreIndicator}>
            <div className={styles.scoreDots}>
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`${styles.scoreDot} ${i < filledDots ? styles.active : ''}`}
                  style={{ background: i < filledDots ? badge.border : undefined }}
                />
              ))}
            </div>
            <span className={styles.scoreValue}>{total_score.toFixed(0)}</span>
          </div>
        </div>

        {expanded && (
          <>
            <div className={styles.breakdown}>
              <h5 className={styles.breakdownTitle}>Score Breakdown</h5>
              <div className={styles.breakdownItems}>
                <div className={styles.breakdownItem}>
                  <span>Base</span>
                  <span className={breakdown.base >= 0 ? styles.positive : styles.negative}>
                    {breakdown.base >= 0 ? '+' : ''}{breakdown.base.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>Team Balance</span>
                  <span className={breakdown.team_balance >= 0 ? styles.positive : styles.negative}>
                    {breakdown.team_balance >= 0 ? '+' : ''}{breakdown.team_balance.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>Damage Type Balance</span>
                  <span className={breakdown.damage_type_balance >= 0 ? styles.positive : styles.negative}>
                    {breakdown.damage_type_balance >= 0 ? '+' : ''}{breakdown.damage_type_balance.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>Enemy Analysis</span>
                  <span className={breakdown.enemy_analysis >= 0 ? styles.positive : styles.negative}>
                    {breakdown.enemy_analysis >= 0 ? '+' : ''}{breakdown.enemy_analysis.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>Strong Against</span>
                  <span className={breakdown.strong_against >= 0 ? styles.positive : styles.negative}>
                    {breakdown.strong_against >= 0 ? '+' : ''}{breakdown.strong_against.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>CC Chain Synergy</span>
                  <span className={breakdown.cc_chain_synergy >= 0 ? styles.positive : styles.negative}>
                    {breakdown.cc_chain_synergy >= 0 ? '+' : ''}{breakdown.cc_chain_synergy.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>Invade Resistance</span>
                  <span className={breakdown.invade_resistance >= 0 ? styles.positive : styles.negative}>
                    {breakdown.invade_resistance >= 0 ? '+' : ''}{breakdown.invade_resistance.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>Counter Penalty</span>
                  <span className={breakdown.counter_penalty >= 0 ? styles.positive : styles.negative}>
                    {breakdown.counter_penalty >= 0 ? '+' : ''}{breakdown.counter_penalty.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>Synergy</span>
                  <span className={breakdown.synergy_bonus >= 0 ? styles.positive : styles.negative}>
                    {breakdown.synergy_bonus >= 0 ? '+' : ''}{breakdown.synergy_bonus.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>Meta</span>
                  <span className={breakdown.meta_bonus >= 0 ? styles.positive : styles.negative}>
                    {breakdown.meta_bonus >= 0 ? '+' : ''}{breakdown.meta_bonus.toFixed(1)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span>Early/Late Game</span>
                  <span className={breakdown.early_late_game >= 0 ? styles.positive : styles.negative}>
                    {breakdown.early_late_game >= 0 ? '+' : ''}{breakdown.early_late_game.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {strengths.length > 0 && (
              <div className={styles.strengths}>
                <h5 className={styles.strengthsTitle}>Strengths</h5>
                <ul className={styles.strengthsList}>
                  {strengths.map((strength, idx) => (
                    <li key={idx} className={styles.strengthItem}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className={styles.warnings}>
                <h5 className={styles.warningsTitle}>Warnings</h5>
                <ul className={styles.warningsList}>
                  {warnings.map((warning, idx) => (
                    <li key={idx} className={`${styles.warningItem} ${styles[warning.severity.toLowerCase()]}`}>
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {stats && (
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Win Rate</span>
                  <span className={styles.statValue}>{stats.win_rate.toFixed(1)}%</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Pick Rate</span>
                  <span className={styles.statValue}>{stats.pick_rate.toFixed(1)}%</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Ban Rate</span>
                  <span className={styles.statValue}>{stats.ban_rate.toFixed(1)}%</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
