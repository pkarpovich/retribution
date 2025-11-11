import type { RecommendationResult, RecommendationLevel } from '../../types/hero';
import { getLatestStats } from '../../utils/heroUtils';
import TierBadge from '../TierBadge/TierBadge';
import styles from './CompactRecommendationCard.module.css';

interface CompactRecommendationCardProps {
  result: RecommendationResult;
  rank: number;
  expanded?: boolean;
}

const RECOMMENDATION_BADGES: Record<RecommendationLevel, { label: string; color: string; icon: string }> = {
  'BEST_PICK': { label: 'BEST PICK', color: '#FFD700', icon: '⚡' },
  'STRONG_PICK': { label: 'Strong Pick', color: '#4caf50', icon: '🟢' },
  'GOOD_PICK': { label: 'Good Pick', color: '#FFEB3B', icon: '🟡' },
  'SAFE_PICK': { label: 'Safe Pick', color: '#2196F3', icon: '🔵' },
  'RISKY_PICK': { label: 'Risky Pick', color: '#f44336', icon: '🔴' }
};

export default function CompactRecommendationCard({ result, rank, expanded = false }: CompactRecommendationCardProps) {
  const { hero, breakdown, recommendation_level, jungler_type, warnings, strengths, total_score } = result;
  const stats = getLatestStats(hero);
  const badge = RECOMMENDATION_BADGES[recommendation_level];

  return (
    <div className={`${styles.card} ${expanded ? styles.expanded : ''}`}>
      <img src={hero.img_src} alt={hero.hero_name} className={styles.heroImage} />
      <div className={styles.rankBadge}>#{rank}</div>
      <div
        className={styles.recommendationBadge}
        style={{ backgroundColor: badge.color }}
      >
        {badge.icon}
      </div>

      <div className={styles.info}>
        <div className={styles.nameRow}>
          <h4 className={styles.heroName}>{hero.hero_name}</h4>
          <TierBadge tier={hero.tier} />
        </div>

        <div className={styles.recommendationLevel} style={{ color: badge.color }}>
          {badge.label}
        </div>

        <div className={styles.junglerType}>
          <span className={styles.typeLabel}>Type:</span>
          <span className={styles.typeValue}>{jungler_type}</span>
        </div>

        <div className={styles.scoreSection}>
          <div className={styles.totalScore}>
            <span className={styles.scoreLabel}>Score:</span>
            <span className={styles.scoreValue}>{total_score.toFixed(1)}</span>
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
                  <span>Enemy Analysis</span>
                  <span className={breakdown.enemy_analysis >= 0 ? styles.positive : styles.negative}>
                    {breakdown.enemy_analysis >= 0 ? '+' : ''}{breakdown.enemy_analysis.toFixed(1)}
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
          </>
        )}
      </div>
    </div>
  );
}
