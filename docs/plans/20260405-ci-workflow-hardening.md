# CI Workflow Hardening

## Overview
Restore the real hero-data fetch and apply all improvements from the initial workflow review to `.gitea/workflows/update-heroes.yml`. The workflow runs on a self-hosted Gitea runner, clones the GitHub repo, regenerates `src/data/heroes.json`, and pushes back to GitHub. Auth via `http.extraheader` is proven working on branch `ci/fix-push-auth`.

After hardening, the workflow will:
- Run the real fetch (currently mocked) with proper timeout and caching
- Push to master with rebase-guard against race conditions
- Send Telegram notifications on success/failure
- Use corepack-managed pnpm (no global npm install)
- Drop leftover diagnostics

## Context (from discovery)
- Workflow file: `.gitea/workflows/update-heroes.yml`
- Fetch script: `scripts/fetch-heroes.js` (mlbb.io proxy, 2s sleep per hero, 130+ heroes)
- Data file: `src/data/heroes.json`
- Current branch: `ci/fix-push-auth`
- Current push target in workflow: `ci/test-auth` (temp for auth iteration)
- Working auth: `http.extraheader` with base64 basic auth, `pkarpovich:<GH_TOKEN>`
- Gitea secret name: `GH_TOKEN` (fine-grained PAT, Contents: Read and write)

## Development Approach
- Ralphex executes pure YAML edits — no runner interaction required
- Each task ends with YAML syntax validation via `node -e "require('yaml').parse(fs.readFileSync(...))"` or equivalent (the only automated check available for workflow files)
- Runtime verification (workflow_dispatch, log reading, merging) is the human's job post-completion
- Keep mock fetch and `ci/test-auth` push target until Tasks 1 and 2 replace them
- Update this plan file when scope changes

## Testing Strategy
- **Automated (ralphex scope)**: YAML parse validation after each edit
- **Manual (post-completion)**: human triggers workflow_dispatch, reads Gitea runner logs, verifies Telegram message, merges branch
- No unit tests apply for workflow YAML

## Progress Tracking
- Mark completed items with `[x]` immediately
- Add newly discovered tasks with ➕ prefix
- Document blockers with ⚠️ prefix

## What Goes Where
- **Implementation Steps** (`[ ]`): YAML edits ralphex can do autonomously
- **Post-Completion**: runtime verification, Telegram secrets setup, PR/merge — all human-only

## Implementation Steps

### Task 1: Restore real hero fetch
- [x] remove "Bump lastUpdated (mock fetch)" step from `.gitea/workflows/update-heroes.yml`
- [x] add step with `corepack enable && corepack prepare pnpm@10 --activate` (instead of `npm install -g pnpm@10`)
- [x] add step with `pnpm install --frozen-lockfile`
- [x] add step with `node scripts/fetch-heroes.js --allow-partial`
- [x] validate YAML parses: `node -e "const yaml=require('yaml');yaml.parse(require('fs').readFileSync('.gitea/workflows/update-heroes.yml','utf8'))"` (use `js-yaml` if `yaml` package not available — check via `node -e "require('js-yaml')"` first)

### Task 2: Restore push target to master and drop diagnostics
- [x] change `HEAD:ci/test-auth` to `HEAD:master` in push command
- [x] remove echo line printing token length/prefix
- [x] remove `if [ -z "$TOKEN" ]` guard (kept as defensive, but was only for debugging empty-secret case)
- [x] keep `TOKEN=$(printf '%s' "$GH_PAT" | tr -d '\r\n\t ')` whitespace stripping
- [x] validate YAML parses

### Task 3: Add rebase guard before push
- [x] insert `git -c http.extraheader="Authorization: Basic ${AUTH}" -c credential.helper= pull --rebase origin master` between commit and push
- [x] ensures non-fast-forward failure can't happen during long fetch runs
- [x] validate YAML parses

### Task 4: Add job-level timeout
- [x] add `timeout-minutes: 30` under `jobs.update:` (same level as `runs-on`)
- [x] validate YAML parses

### Task 5: Add Telegram notification step
- [x] add final step `Notify Telegram` using `appleboy/telegram-action@v1.0.1`
- [x] set `if: always()` so both success and failure fire
- [x] use secrets `TELEGRAM_CHAT_ID` and `TELEGRAM_BOT_TOKEN`
- [x] message: status emoji, commit SHA link, actor
- [x] validate YAML parses

### Task 6: Fix schedule to avoid month-boundary gaps
- [x] change cron from `'0 6 */3 * *'` to `'0 6 * * 1,4'` (Mon/Thu 06:00 UTC)
- [x] update README.md line mentioning "Data updates automatically every 3 days via GitHub Actions" to "Data updates twice a week (Mon/Thu) via Gitea Actions"
- [x] validate YAML parses

### Task 7: Add pnpm store caching
- [ ] add `actions/cache@v4` step before `pnpm install`
- [ ] cache path `~/.local/share/pnpm/store`, key `pnpm-${{ hashFiles('pnpm-lock.yaml') }}`
- [ ] validate YAML parses

## Technical Details

### Why these values
- `timeout-minutes: 30`: 130 heroes × 2s + worst-case retries ≈ 25 min
- `actions/cache@v4`: stable major, lockfile-keyed invalidation
- `cron: '0 6 * * 1,4'`: Mon+Thu 06:00 UTC — no 31→1 gap anomaly
- `appleboy/telegram-action@v1.0.1`: popular stable action

## Post-Completion

**Telegram secrets setup in Gitea (human-only, before first notification-enabled run):**
- Create bot via @BotFather, get `TELEGRAM_BOT_TOKEN`
- Get chat ID (personal DM or channel/group) as `TELEGRAM_CHAT_ID`
- Add both as Gitea Actions secrets on `pkarpovich/retribution`
- If bot is in a channel, make it admin

**Runtime verification (human-only):**
- Push `ci/fix-push-auth` after ralphex completes all tasks
- Temporarily re-point push target in workflow from `master` to `ci/test-auth` locally to run a dry-run
- Trigger `workflow_dispatch` in Gitea UI on `ci/fix-push-auth` branch
- Verify in logs: fetch runs, cache hit/miss reports, commit created, push succeeds, Telegram message arrives
- Inspect resulting `heroes.json` on `ci/test-auth` for sanity (capabilities populated, strongAgainst non-empty)
- Flip push target back to `master`
- ⚠️ Fallback: if Gitea's act_runner cannot resolve `appleboy/telegram-action`, replace that step with inline `curl` to `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

**Merge (human-only):**
- Open PR: `ci/fix-push-auth` → `master` on GitHub
- Merge after CI dry-run passes
- Delete `ci/fix-push-auth` and `ci/test-auth` branches
