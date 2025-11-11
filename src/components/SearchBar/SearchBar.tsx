import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder = "Search hero by name..." }: SearchBarProps) {
  return (
    <div className={styles.container}>
      <input
        type="text"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className={styles.clearButton}
          onClick={() => onChange('')}
          type="button"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
