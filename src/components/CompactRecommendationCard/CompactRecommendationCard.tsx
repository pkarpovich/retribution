import type { Hero } from '../../types/hero';
import { getLatestStats } from '../../utils/heroUtils';
import TierBadge from '../TierBadge/TierBadge';
import styles from './CompactRecommendationCard.module.css';

interface CompactRecommendationCardProps {
  hero: Hero;
  rank: number;
  expanded?: boolean;
}

export default function CompactRecommendationCard({ hero, rank, expanded = false }: CompactRecommendationCardProps) {
  const stats = getLatestStats(hero);

  return (
    <div className={`${styles.card} ${expanded ? styles.expanded : ''}`}>
      <img src={hero.img_src} alt={hero.hero_name} className={styles.heroImage} />
      <div className={styles.rankBadge}>#{rank}</div>
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <h4 className={styles.heroName}>{hero.hero_name}</h4>
          <TierBadge tier={hero.tier} />
        </div>
        <div className={styles.roles}>
          {hero.role.map(role => (
            <span key={role} className={styles.role}>{role}</span>
          ))}
        </div>
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
        {expanded && (
          <div className={styles.specialties}>
            {hero.speciality.map(spec => (
              <span key={spec} className={styles.specialty}>{spec}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
