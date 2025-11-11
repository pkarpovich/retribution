import type { Hero } from '../../types/hero';
import { getLatestStats } from '../../utils/heroUtils';
import TierBadge from '../TierBadge/TierBadge';
import styles from './JunglerRecommendations.module.css';

interface JunglerRecommendationsProps {
  recommendations: Hero[];
}

export default function JunglerRecommendations({ recommendations }: JunglerRecommendationsProps) {
  if (recommendations.length === 0) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Recommended Junglers</h2>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🎯</div>
          <p className={styles.emptyText}>Select enemy heroes to get recommendations</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Recommended Junglers</h2>
      <div className={styles.recommendations}>
        {recommendations.map((hero, index) => {
          const stats = getLatestStats(hero);
          return (
            <div key={hero.id} className={styles.card}>
              <div className={styles.rank}>#{index + 1}</div>
              <img src={hero.img_src} alt={hero.hero_name} className={styles.heroImage} />
              <div className={styles.info}>
                <div className={styles.nameRow}>
                  <h3 className={styles.heroName}>{hero.hero_name}</h3>
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
                <div className={styles.specialties}>
                  {hero.speciality.map(spec => (
                    <span key={spec} className={styles.specialty}>{spec}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
