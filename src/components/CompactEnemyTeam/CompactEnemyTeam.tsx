import type { Hero } from '../../types/hero';
import styles from './CompactEnemyTeam.module.css';

interface CompactEnemyTeamProps {
  enemies: Hero[];
  onRemove: (hero: Hero) => void;
}

export default function CompactEnemyTeam({ enemies, onRemove }: CompactEnemyTeamProps) {
  if (enemies.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyText}>Select enemy heroes</span>
        <span className={styles.emptyCount}>0/5</span>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.avatars}>
        {enemies.map(enemy => (
          <div key={enemy.id} className={styles.avatarWrapper}>
            <img src={enemy.img_src} alt={enemy.hero_name} className={styles.avatar} />
            <button
              className={styles.removeButton}
              onClick={() => onRemove(enemy)}
              type="button"
              aria-label={`Remove ${enemy.hero_name}`}
            >
              ×
            </button>
          </div>
        ))}
        {[...Array(5 - enemies.length)].map((_, i) => (
          <div key={`empty-${i}`} className={styles.emptySlot} />
        ))}
      </div>
      <span className={styles.count}>{enemies.length}/5</span>
    </div>
  );
}
