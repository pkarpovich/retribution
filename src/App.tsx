import { useState, useMemo } from 'react';
import type { Hero } from './types/hero';
import heroData from './data/heroes.json';
import { getJunglers, recommendJunglers } from './utils/heroUtils';
import EnemyPicker from './components/EnemyPicker/EnemyPicker';
import CompactEnemyTeam from './components/CompactEnemyTeam/CompactEnemyTeam';
import StickyRecommendations from './components/StickyRecommendations/StickyRecommendations';
import SearchBar from './components/SearchBar/SearchBar';
import './App.css';

function App() {
  const [selectedEnemies, setSelectedEnemies] = useState<Hero[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const allHeroes = heroData.heroes as Hero[];
  const junglers = useMemo(() => getJunglers(allHeroes), []);

  const filteredHeroes = useMemo(
    () => allHeroes.filter(hero =>
      hero.hero_name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [allHeroes, searchQuery]
  );

  const recommendations = useMemo(
    () => recommendJunglers(junglers, selectedEnemies),
    [junglers, selectedEnemies]
  );

  const handleSelectEnemy = (hero: Hero) => {
    setSelectedEnemies(prev => {
      const isSelected = prev.some(h => h.id === hero.id);
      if (isSelected) {
        return prev.filter(h => h.id !== hero.id);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, hero];
    });
  };

  return (
    <div className="app">
      <header className="header">
        <div className="headerTop">
          <h1 className="logo">Retribution</h1>
          <CompactEnemyTeam
            enemies={selectedEnemies}
            onRemove={handleSelectEnemy}
          />
        </div>
        <StickyRecommendations
          recommendations={recommendations}
          selectedEnemies={selectedEnemies}
        />
      </header>

      <main className="main">
        <div className="searchSection">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        <div className="heroSection">
          <EnemyPicker
            heroes={filteredHeroes}
            selectedEnemies={selectedEnemies}
            onSelectEnemy={handleSelectEnemy}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
