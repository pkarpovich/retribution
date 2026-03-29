import type { Hero } from '../../types/hero';
import styles from './CompactEnemyTeam.module.css';

interface CompactEnemyTeamProps {
  enemies: Hero[];
  onRemove: (hero: Hero) => void;
  maxSlots?: number;
  label?: string;
  emptyText?: string;
}

export default function CompactEnemyTeam({
  enemies,
  onRemove,
  maxSlots = 5,
  label,
}: CompactEnemyTeamProps) {
  if (enemies.length === 0) {
    return (
      <div className={styles.empty}>
        {label && <span className={styles.label}>{label}</span>}
        <div className={styles.rightSection}>
          <div className={styles.avatars}>
            {[...Array(maxSlots)].map((_, i) => (
              <div key={`empty-${i}`} className={styles.emptySlot} />
            ))}
          </div>
          <span className={styles.emptyCount}>0/{maxSlots}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.rightSection}>
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
          {[...Array(maxSlots - enemies.length)].map((_, i) => (
            <div key={`empty-${i}`} className={styles.emptySlot} />
          ))}
        </div>
        <span className={styles.count}>{enemies.length}/{maxSlots}</span>
      </div>
    </div>
  );
}
