import type { Hero } from '../../types/hero';
import { getLatestStats } from '../../utils/heroUtils';
import TierBadge from '../TierBadge/TierBadge';
import styles from './CompactRecommendationCard.module.css';

interface CompactRecommendationCardProps {
  hero: Hero;
  rank: number;
  onClick: () => void;
}

export default function CompactRecommendationCard({ hero, rank, onClick }: CompactRecommendationCardProps) {
  const stats = getLatestStats(hero);

  return (
    <button className={styles.card} onClick={onClick} type="button">
      <div className={styles.rankBadge}>#{rank}</div>
      <img src={hero.img_src} alt={hero.hero_name} className={styles.heroImage} />
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <h4 className={styles.heroName}>{hero.hero_name}</h4>
          <TierBadge tier={hero.tier} />
        </div>
        <div className={styles.stats}>
          <span className={styles.stat}>WR {stats.win_rate.toFixed(0)}%</span>
          <span className={styles.stat}>PR {stats.pick_rate.toFixed(1)}%</span>
        </div>
      </div>
    </button>
  );
}
