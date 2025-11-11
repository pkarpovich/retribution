import { useState, useMemo } from 'react';
import type { Hero } from './types/hero';
import heroData from './data/heroes.json';
import { getJunglers, recommendJunglers } from './utils/heroUtils';
import EnemyPicker from './components/EnemyPicker/EnemyPicker';
import CompactEnemyTeam from './components/CompactEnemyTeam/CompactEnemyTeam';
import StickyRecommendations from './components/StickyRecommendations/StickyRecommendations';
import SearchBar from './components/SearchBar/SearchBar';
import './App.css';

type PickerMode = 'team' | 'enemy';

function App() {
  const [yourTeam, setYourTeam] = useState<Hero[]>([]);
  const [enemyTeam, setEnemyTeam] = useState<Hero[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode>('enemy');

  const allHeroes = heroData.heroes as Hero[];
  const junglers = useMemo(() => getJunglers(allHeroes), []);

  const filteredHeroes = useMemo(
    () => allHeroes.filter(hero =>
      hero.hero_name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [allHeroes, searchQuery]
  );

  const recommendations = useMemo(
    () => recommendJunglers(junglers, yourTeam, enemyTeam, [], 'Mythic'),
    [junglers, yourTeam, enemyTeam]
  );

  const handleSelectTeammate = (hero: Hero) => {
    setYourTeam(prev => {
      const isSelected = prev.some(h => h.id === hero.id);
      if (isSelected) {
        return prev.filter(h => h.id !== hero.id);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, hero];
    });
  };

  const handleSelectEnemy = (hero: Hero) => {
    setEnemyTeam(prev => {
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

  const currentPickerProps = pickerMode === 'team'
    ? { selectedEnemies: yourTeam, onSelectEnemy: handleSelectTeammate }
    : { selectedEnemies: enemyTeam, onSelectEnemy: handleSelectEnemy };

  return (
    <div className="app">
      <header className="header">
        <div className="headerTop">
          {yourTeam.length === 0 && enemyTeam.length === 0 ? (
            <h1 className="logo">Retribution</h1>
          ) : (
            <div className="teamsContainer">
              <CompactEnemyTeam
                enemies={yourTeam}
                onRemove={handleSelectTeammate}
                maxSlots={4}
                label="Your Team"
                emptyText="Select your team"
              />
              <CompactEnemyTeam
                enemies={enemyTeam}
                onRemove={handleSelectEnemy}
                maxSlots={5}
                label="Enemy Team"
                emptyText="Select enemies"
              />
            </div>
          )}
        </div>
        <StickyRecommendations
          recommendations={recommendations}
          selectedEnemies={enemyTeam}
        />
      </header>

      <main className="main">
        <div className="pickerModeSelector">
          <button
            className={`modeButton ${pickerMode === 'team' ? 'active' : ''}`}
            onClick={() => setPickerMode('team')}
          >
            Your Team ({yourTeam.length}/4)
          </button>
          <button
            className={`modeButton ${pickerMode === 'enemy' ? 'active' : ''}`}
            onClick={() => setPickerMode('enemy')}
          >
            Enemy Team ({enemyTeam.length}/5)
          </button>
        </div>

        <div className="searchSection">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        <div className="pickerSection">
          <EnemyPicker
            heroes={filteredHeroes}
            {...currentPickerProps}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
