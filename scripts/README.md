# Scripts

Hero data comes from two sources with a strict split of duties:

- **mlbb.io** — tier, `score`, win/pick/ban rates per rank, counter/synergy/weakAgainst relations
- **Liquipedia** — skills, from which `capabilities` are derived, plus base stats

## fetch-liquipedia-skills.js

Fetches every hero page from Liquipedia and saves the parsed skills to `src/data/liquipedia-heroes.json`.

```bash
node scripts/fetch-liquipedia-skills.js
```

Run this when heroes are added or reworked — not on a schedule. The output is committed so
`fetch-heroes.js` never has to hit Liquipedia.

Each hero gets `lane`, `primaryRole`, `specialities`, `baseStats` and a `skills` array with
`effects`, `cooldown`, `vamp`, `description` and named per-level `scaling`.

Set `LIQUIPEDIA_USER_AGENT` to override the default User-Agent. The client sends
`Accept-Encoding: gzip` (Liquipedia returns HTTP 406 without it) and waits 30s between batches
of 50 titles, per their API terms.

## fetch-pro-drafts.js

Fetches tournament pages from Liquipedia and saves parsed drafts to `src/data/pro-drafts.json`.

```bash
node scripts/fetch-pro-drafts.js
```

Add new events to `TOURNAMENTS` inside the script. Each game records both teams' picks, bans and
the winner. **The hero index within a team is lane order (Exp, Jungle, Mid, Gold, Roam), not pick
order** — verified across 729 observations — so `picks[1]` is that team's jungler, but the
chronological draft sequence is not recoverable from this source.

Unresolved hero names exit with code 2; add them to `ALIASES`.

The corpus drives two things: the meta jungle lanes below, and the recall benchmark in
`src/utils/__tests__/proDrafts.test.ts`.

## fetch-heroes.js

Fetches statistics and matchup data from mlbb.io, merges in capabilities computed from
`src/data/liquipedia-heroes.json`, applies meta jungle lanes from `src/data/pro-drafts.json`,
and saves `src/data/heroes.json`.

No hero database tracks meta lanes — both mlbb.io and Liquipedia list Akai as Roam despite 20
pro games as a jungler. So `lib/pro-meta.js` adds `Jungle` to any hero who appeared in the jungle
slot at least 3 times *and* in at least half of their picks. The share matters: Paquito jungled
once out of 32 picks and is correctly left out. Lanes are only ever added, never removed — pro
meta is narrower than solo queue. Applied additions are recorded in `heroes.json` under
`laneAdditions`.

```bash
node scripts/fetch-heroes.js                          # proxy mode, no auth
MLBB_API_SECRET=your_secret node scripts/fetch-heroes.js
node scripts/fetch-heroes.js --allow-partial          # used by CI
```

Exits with code 2 when data is degraded (dropped heroes, missing Liquipedia entries) unless
`--allow-partial` is passed.

## lib/

- `wikitext.js` — MediaWiki template parser (brace matching, param splitting, markup stripping)
- `liquipedia.js` — batched API client with gzip and rate limiting
- `capabilities.js` — turns Liquipedia skills into `HeroCapabilities`

`capabilities.js` derives:

| field | source |
| --- | --- |
| `ccScore` | hard CC in text weighs 2, `CC`/`Slow` effects weigh 1 |
| `mobilityScore` | `Teleport`/`Blink` weigh 2, `Mobility`/`Charge` and dash-like text weigh 1 |
| `selfSustain` | HP restoration on the caster, or lifesteal/spell vamp wording |
| `allySustain` | HP restoration or shielding aimed at allies |
| `hasImmunity` | `Invincible`/`CC Immune`/`Death Immunity`/`Remove CC` effects, or control-immunity and untargetable wording. Deliberately excludes "Slow Immunity" |
| `antiHeal` | wording that reduces enemy healing, shields or HP regen |
| `armorAgnostic` | 2 for percent-max-HP or true damage, 1 for defense shred, 0 otherwise |
| `hasShield`, `damageReduction`, `hasAOE` | effects plus supporting wording |
| `baseStats`, `statProfile` | Liquipedia infobox, normalised across the roster |

The skill `vamp` field is the share of spell vamp that skill applies — a global MLBB rule, not a
hero trait — so it is kept in the raw data and never read as lifesteal.

`src/utils/__tests__/fixtures/jungler-capabilities.json` pins the reviewed values for all 37
junglers. A failure there means a hero was reworked or a parsing rule regressed — inspect before
regenerating the fixture.

## generate-icons.sh

Regenerates the PWA icon set in `public/`.
