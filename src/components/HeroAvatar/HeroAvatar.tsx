import type { Hero } from '../../types/hero';
import styles from './HeroAvatar.module.css';

interface HeroAvatarProps {
  hero: Hero;
  selected?: boolean;
  locked?: boolean;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export default function HeroAvatar({ hero, selected, locked, onClick, size = 'medium' }: HeroAvatarProps) {
  return (
    <button
      className={`${styles.avatar} ${styles[size]} ${selected ? styles.selected : ''} ${locked ? styles.locked : ''}`}
      onClick={locked ? undefined : onClick}
      type="button"
      disabled={locked}
    >
      <img src={hero.img_src} alt={hero.hero_name} className={styles.image} />
      <span className={styles.name}>{hero.hero_name}</span>
    </button>
  );
}
