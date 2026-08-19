<script lang="ts">
  import heroData from './data/heroes.json'
  import type { Hero } from './types/hero'
  import { bans, signatures } from './lib/pool.svelte'
  import type { MatchRecord } from './types/match'
  import type { DraftMode } from './lib/draftStorage'
  import { draftFromRecord, loadDraft, saveDraft } from './lib/draftStorage'
  import { matches, newMatchId } from './lib/matches.svelte'
  import {
    MAX_ALLIES,
    MAX_ENEMIES,
    calculateJunglerRecommendation,
    getJunglers,
    recommendJunglers,
  } from './utils/heroUtils'
  import { chosen, pickReadout, suggested, teamNeeds, toSuggestions } from './utils/presentation'
  import PoolScreen from './components/PoolScreen.svelte'
  import EnemyRead from './components/EnemyRead.svelte'
  import MatchBanner from './components/MatchBanner.svelte'
  import MatchBanStrip from './components/MatchBanStrip.svelte'
  import StatsScreen from './components/StatsScreen.svelte'
  import RosterPanel from './components/RosterPanel.svelte'
  import SuggestionBlock from './components/SuggestionBlock.svelte'
  import TeamsStrip from './components/TeamsStrip.svelte'

  const heroes = heroData.heroes as unknown as Hero[]
  const junglers = getJunglers(heroes)

  // iPadOS drops the app while MLBB is in the foreground, and a draft rebuilt
  // by hand under the pick timer is the worst moment to lose one.
  const restored = loadDraft(heroes, Date.now())

  let allies = $state<Hero[]>(restored.allies)
  let enemies = $state<Hero[]>(restored.enemies)
  let matchBans = $state<Hero[]>(restored.matchBans)
  let myPick = $state<Hero | null>(restored.myPick)
  let mode = $state<DraftMode>(restored.mode)

  $effect(() => {
    saveDraft({ allies, enemies, matchBans, myPick, mode }, Date.now())
  })
  let bansOpen = $state(false)
  let statsOpen = $state(false)
  let toast = $state<string | null>(null)
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  const drafted = $derived(
    new Set([...allies, ...enemies, ...matchBans, myPick].filter(Boolean).map(hero => hero!.id))
  )
  const myTeam = $derived(myPick ? [...allies, myPick] : allies)
  const picked = $derived(allies.length + enemies.length + (myPick ? 1 : 0))
  const hasDraft = $derived(allies.length + enemies.length > 0)

  const bannedList = $derived(heroes.filter(hero => bans.has(hero.id)))

  // The icon used to be a ban symbol carrying the sum of both lists, which read
  // as "three bans" when it was two mains and one ban. Neutral mark, two counts,
  // each in the colour its pill uses on the pool screen.
  const poolLabel = $derived(
    bans.size + signatures.size === 0
      ? 'Your pool'
      : `Your pool, ${signatures.size} main${signatures.size === 1 ? '' : 's'}`
        + ` and ${bans.size} banned`
  )

  const suggestions = $derived(
    toSuggestions(
      recommendJunglers(junglers, myTeam, enemies, bannedList, 'Mythic', matchBans, signatures.ids),
      enemies,
      myTeam
    )
  )

  const roster = $derived(heroes.filter(hero => !drafted.has(hero.id)))
  const bannedIds = $derived(new Set(bans.ids))

  const pickRead = $derived(
    myPick
      ? pickReadout(myPick, { myTeam, enemies, matchBans, roster: heroes }, matches.pending)
      : null
  )

  function flash(message: string) {
    toast = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast = null), 1600)
  }

  function choosePick() {
    mode = 'pick'
  }

  function pick(hero: Hero) {
    if (mode === 'pick') {
      take(hero)
      mode = 'enemy'
      return
    }
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

  // Built from the draft as it stands before the lock: once myPick is set the
  // hero leaves the candidate list and its evaluation is gone.
  function take(hero: Hero) {
    const shown = hasDraft ? suggestions : []
    const index = shown.findIndex(suggestion => suggestion.hero.id === hero.id)
    const named = (list: Hero[]) => list.map(one => ({ id: one.id, name: one.hero_name }))

    const result = shown[index]?.result
      ?? calculateJunglerRecommendation(hero, allies, enemies, 'Mythic', {
        matchBans,
        signatures: signatures.ids,
      })

    matches.log({
      id: newMatchId(),
      at: new Date().toISOString(),
      dataVersion: heroData.lastUpdated,
      outcome: 'pending',
      note: '',
      enemies: named(enemies),
      allies: named(allies),
      matchBans: named(matchBans),
      pick: { id: hero.id, name: hero.hero_name, tier: hero.tier },
      rank: shown.length === 0 ? null : index >= 0 ? index + 1 : shown.length + 1,
      shown: shown.length,
      followedAdvice: index === 0,
      top: shown[0] ? { id: shown[0].hero.id, name: shown[0].hero.hero_name } : null,
      totalScore: result.total_score,
      breakdown: result.breakdown,
      warnings: result.warnings,
      strengths: result.strengths,
      build: result.bootRecommendation,
      needs: teamNeeds([...allies, hero], enemies)
        .map(need => ({ key: need.key, name: need.name, evidence: need.evidence })),
    })

    myPick = hero
    flash('Jungle pick locked')
  }

  // Puts a logged game back on the board. The pick is left off so the hero is
  // among the candidates again and its standing today can be read off the list.
  function reopen(record: MatchRecord) {
    const board = draftFromRecord(record, heroes)
    allies = board.allies
    enemies = board.enemies
    matchBans = board.matchBans
    myPick = null
    mode = board.mode
    statsOpen = false
    flash(`Reopened the draft you took ${record.pick.name} into`)
  }

  // The result arrives long after the draft is cleared, so an unsettled game
  // deliberately outlives a reset.
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
        class="icon"
        onclick={() => (statsOpen = !statsOpen)}
        aria-label="Your games{matches.pending ? ', one waiting on a result' : ''}"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
        {#if matches.pending}<span class="dot" aria-hidden="true"></span>{/if}
      </button>

      <button class="icon pool" onclick={() => (bansOpen = !bansOpen)} aria-label={poolLabel}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
          <path d="M6 3h12v18l-6-4.5L6 21z" />
        </svg>
        {#if signatures.size > 0}<span class="badge main">{signatures.size}</span>{/if}
        {#if bans.size > 0}<span class="badge banned">{bans.size}</span>{/if}
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
        onChoosePick={choosePick}
      />

      <MatchBanStrip
        bans={matchBans}
        onRemove={hero => (matchBans = matchBans.filter(banned => banned.id !== hero.id))}
      />

      {#if matches.pending}
        <MatchBanner record={matches.pending} onOpenStats={() => (statsOpen = true)} />
      {/if}

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
        {pickRead}
        onLock={take}
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
      banned={bannedIds}
      onModeChange={next => (mode = next)}
      onPick={pick}
    />

    {#if bansOpen}
      <PoolScreen {heroes} onClose={() => (bansOpen = false)} />
    {/if}

    {#if statsOpen}
      <StatsScreen onClose={() => (statsOpen = false)} onReopen={reopen} />
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

  .icon {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    padding: var(--space-2xs) var(--space-xs);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-ink-mute);
  }

  .badge.main {
    color: var(--color-accent);
  }

  .badge.banned {
    color: var(--color-neg);
  }

  .dot {
    inline-size: 5px;
    block-size: 5px;
    border-radius: var(--radius-full);
    background: var(--color-accent);
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
