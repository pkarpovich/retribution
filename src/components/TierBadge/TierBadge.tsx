import type { HeroTier } from '../../types/hero';
import styles from './TierBadge.module.css';

interface TierBadgeProps {
  tier: HeroTier;
}

export default function TierBadge({ tier }: TierBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tier.toLowerCase()]}`}>
      {tier}
    </span>
  );
}
