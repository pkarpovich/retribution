<script lang="ts">
  import heroData from './data/heroes.json'
  import type { Hero } from './types/hero'
  import { bans } from './lib/bans.svelte'
  import { getJunglers, recommendJunglers } from './utils/heroUtils'
  import { chosen, suggested, toSuggestions } from './utils/presentation'
  import BansScreen from './components/BansScreen.svelte'
  import EnemyRead from './components/EnemyRead.svelte'
  import MatchBanStrip from './components/MatchBanStrip.svelte'
  import RosterPanel from './components/RosterPanel.svelte'
  import SuggestionBlock from './components/SuggestionBlock.svelte'
  import TeamsStrip from './components/TeamsStrip.svelte'

  const heroes = heroData.heroes as unknown as Hero[]
  const junglers = getJunglers(heroes)

  const MAX_ALLIES = 4
  const MAX_ENEMIES = 5

  let allies = $state<Hero[]>([])
  let enemies = $state<Hero[]>([])
  let matchBans = $state<Hero[]>([])
  let myPick = $state<Hero | null>(null)
  let mode = $state<'ally' | 'enemy' | 'ban'>('enemy')
  let bansOpen = $state(false)
  let toast = $state<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  const drafted = $derived(
    new Set([...allies, ...enemies, ...matchBans, myPick].filter(Boolean).map(hero => hero!.id))
  )
  const myTeam = $derived(myPick ? [...allies, myPick] : allies)
  const picked = $derived(allies.length + enemies.length + (myPick ? 1 : 0))
  const hasDraft = $derived(allies.length + enemies.length > 0)

  const bannedList = $derived(heroes.filter(hero => bans.has(hero.id)))

  const suggestions = $derived(
    toSuggestions(
      recommendJunglers(junglers, myTeam, enemies, bannedList, 'Mythic', matchBans),
      enemies,
      myTeam
    )
  )

  const roster = $derived(heroes.filter(hero => !drafted.has(hero.id) && !bans.has(hero.id)))
  const hiddenByBans = $derived(bannedList.filter(hero => !drafted.has(hero.id)).length)

  function flash(message: string) {
    toast = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = null), 1600)
  }

  function pick(hero: Hero) {
    if (mode === 'ban') {
      matchBans = [...matchBans, hero]
      return
    }
    if (mode === 'ally') {
      if (allies.length >= MAX_ALLIES) return flash('Ally slots full')
      allies = [...allies, hero]
      return
    }
    if (enemies.length >= MAX_ENEMIES) return flash('Enemy slots full')
    enemies = [...enemies, hero]
  }

  function reset() {
    allies = []
    enemies = []
    matchBans = []
    myPick = null
    mode = 'enemy'
  }
</script>

<div class="app">
  <header class="bar">
    <h1 class="logo">Retribution</h1>
    <div class="bar-actions">
      <span class="tally">{picked}/10</span>
      {#if picked > 0}
        <button class="ghost" onclick={reset}>RESET</button>
      {/if}
      <button
        class="bans"
        onclick={() => (bansOpen = !bansOpen)}
        aria-label="Banned heroes{bans.size > 0 ? `, ${bans.size} banned` : ''}"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" /><path d="m6 6 12 12" />
        </svg>
        {#if bans.size > 0}<span class="badge">{bans.size}</span>{/if}
      </button>
    </div>
  </header>

  <div class="workspace">
    <section class="draft">
      <TeamsStrip
        {allies}
        {enemies}
        {myPick}
        onRemoveAlly={hero => (allies = allies.filter(ally => ally.id !== hero.id))}
        onRemoveEnemy={hero => (enemies = enemies.filter(enemy => enemy.id !== hero.id))}
        onClearPick={() => (myPick = null)}
      />

      <MatchBanStrip
        bans={matchBans}
        onRemove={hero => (matchBans = matchBans.filter(banned => banned.id !== hero.id))}
      />

      {#if enemies.length > 0}
        <EnemyRead
          {enemies}
          pool={junglers}
          responders={myPick ? chosen(myTeam) : suggested(suggestions)}
        />
      {/if}

      <SuggestionBlock
        {suggestions}
        {enemies}
        {myTeam}
        picksLeft={MAX_ALLIES - allies.length}
        {myPick}
        {hasDraft}
        onLock={hero => {
          myPick = hero
          flash('Jungle pick locked')
        }}
        onUnlock={() => {
          myPick = null
          flash('Pick unlocked')
        }}
        onBan={hero => {
          matchBans = [...matchBans, hero]
          flash(`${hero.hero_name} banned this match`)
        }}
      />
    </section>

    <RosterPanel
      heroes={roster}
      {mode}
      {hiddenByBans}
      onModeChange={next => (mode = next)}
      onPick={pick}
      onOpenBans={() => (bansOpen = true)}
    />

    {#if bansOpen}
      <BansScreen {heroes} onClose={() => (bansOpen = false)} />
    {/if}
  </div>

  {#if toast}
    {#key toast}
      <p class="toast" role="status">{toast}</p>
    {/key}
  {/if}
</div>

<style>
  .app {
    container: app / inline-size;
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    block-size: 100dvb;
    inline-size: min(100%, var(--app-inline-size));
    margin-inline: auto;
    overflow: hidden;
    background: var(--color-bg);
  }

  @media (width > 30rem) {
    .app {
      border-inline: 1px solid var(--color-border);
    }
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl);
    background: var(--color-panel);
    border-block-end: 1px solid var(--color-border);
  }

  .logo {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--font-size-xl);
    font-weight: 400;
    letter-spacing: var(--tracking-tight);
  }

  /* RESET and the ban list are both destructive enough that hitting one while
     aiming for the other is a real cost, so they keep their distance. */
  .bar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-xl);
  }

  .tally,
  .ghost,
  .badge {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    letter-spacing: var(--tracking-mono);
  }

  .tally {
    color: var(--color-ink-mute);
  }

  .ghost {
    padding: var(--space-2xs) var(--space-xs);
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 600;
    color: var(--color-ink-faint);
  }

  .bans {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: var(--space-2xs) var(--space-xs);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-ink-mute);

    &:has(.badge) {
      color: var(--color-neg);
    }
  }

  .badge {
    font-weight: 700;
  }

  /* The ban list covers the workspace and not the whole window: at the top of
     the window its back button sits under the OS window controls. */
  .workspace {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-block-size: 0;
    min-inline-size: 0;
    overflow: hidden;
  }

  .draft {
    container: draft / inline-size;
    display: grid;
    align-content: start;
    overflow-y: auto;
    min-block-size: 0;
    min-inline-size: 0;
  }

  /* Wide enough for two columns: the draft stops scrolling with the roster
     and each side keeps its own overflow, which is what an iPad has room for. */
  @container app (inline-size > 46rem) {
    .workspace {
      grid-template-rows: minmax(0, 1fr);
      grid-template-columns: minmax(0, 24rem) minmax(0, 1fr);
    }

    .draft {
      border-inline-end: 1px solid var(--color-border);
    }
  }

  .toast {
    position: absolute;
    inset-block-end: var(--space-2xl);
    inset-inline: 0;
    inline-size: fit-content;
    margin-inline: auto;
    z-index: 40;
    margin-block: 0;
    padding: var(--space-xs) var(--space-lg);
    border-radius: var(--radius-full);
    background: color-mix(in oklch, var(--color-ink) 92%, transparent);
    color: var(--color-panel);
    font-size: var(--font-size-sm);
    font-weight: 500;
    box-shadow: var(--shadow-toast);
    animation: toast-life 1600ms var(--ease-out) forwards;
  }
</style>
