# Shadow Words

A pass-and-play social deduction word game (inspired by *Undercover*) built with Next.js. Friends play on **one shared device**, and the app includes a full word-library manager. There is no database, backend, login or external API: everything runs in your browser and is saved to `localStorage`.

## Prerequisites

- Node.js 18.18 or newer (20+ recommended)
- npm

## Install and run

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build
npm run start      # http://localhost:3000
```

No environment variables, credentials or API keys are needed.

## How to play

1. **Game setup**: add 3 or more players, choose how many Undercover and Mr. White players there are (Civilians are calculated automatically), pick word groups and rules.
2. **Secret words**: the device is passed around. Each player taps *Reveal my word*, reads it, then taps *Hide word & pass device*.
3. **Clue round**: a random player starts; everyone gives one spoken clue.
4. **Discussion**: optional countdown timer.
5. **Voting**: each active player votes privately on the shared device. Individual votes stay hidden; only totals are shown after voting.
6. **Elimination**: the voted-out player's role is revealed. If it was Mr. White, he gets one guess at the Civilian word.
7. Repeat until a win condition is met. *Play again* keeps players, groups and scores.

### Roles and rules

| Role | Gets | Goal |
| --- | --- | --- |
| Civilian | The main word | Eliminate every Undercover and Mr. White |
| Undercover | A related but different word | Blend in and survive |
| Mr. White | No word | Survive, or guess the Civilian word after being voted out |

- **Civilians win** when all Undercover and Mr. White players are eliminated.
- **Infiltrators (Undercover + Mr. White) win** when they equal or outnumber the remaining Civilians (default), or when only two players remain (alternative rule, selectable in setup).
- **Mr. White wins immediately** with a correct guess (compared case-insensitively, ignoring extra spaces).
- **Ties**: either revote among tied players (after 2 tied revotes a random tied player is eliminated so the game can never stall) or eliminate one tied player at random.
- **Scoring** (optional): Civilians win +2 each, Undercover team win +3 each, Mr. White's correct guess +5.

## Word library

- Create, rename, describe, enable/disable, duplicate and delete groups. Duplicates get new group and pair IDs.
- Add, edit, delete (single or bulk) word pairs, with search and pagination.
- **Duplicate prevention**: within one group, a word may appear only once across *both* columns (case, spacing and Unicode differences are ignored). Civilian and Undercover words must differ. The error message names the conflicting word. The same word may exist in different groups.
- 10 starter groups (200+ pairs) are seeded **only** the first time, when nothing is saved. Existing data is never overwritten.

### No-repeat word selection

When a game starts, valid pairs from the selected **enabled** groups are merged; identical or reversed pairs (Coffee/Tea = Tea/Coffee) count once. A random unused pair is chosen and recorded. When every pair has been used, a new cycle begins. The history survives navigation and page refreshes and can be cleared on the setup screen. Each game keeps its own **snapshot** of the words, so editing or deleting library groups mid-game never changes an active game.

### Import and export

- **Export**: the whole library or a single group, as JSON or CSV. Files are generated in your browser.
- **Import**: CSV or JSON, with a preview, a list of invalid rows with reasons, and a choice to skip conflicting groups or import them under a new name. Nothing is saved until you confirm. In a group's page you can import pairs straight into that group.
- CSV format (a template can be downloaded from the import dialog):

```csv
groupName,civilianWord,undercoverWord,description,enabled
Breakfast,Pancake,Waffle,Morning foods,true
Breakfast,Coffee,Tea,,true
```

## Browser storage

Everything is stored in `localStorage` under these keys (versioned with a schema field):

| Key | Contents |
| --- | --- |
| `shadow-words:library` | Word groups and pairs |
| `shadow-words:prefs` | Settings and last game setup |
| `shadow-words:session` | The game in progress (resume after refresh) |
| `shadow-words:history` | Used-pair history |

Corrupted data is backed up to `<key>:corrupt-backup` instead of being discarded. If storage is unavailable or full, the app shows a banner and keeps working in memory.

**Limitations**

- Data lives in the current browser on the current device only. There is no sync.
- Clearing site data, using private mode, or switching browsers/devices makes it unavailable. Use **Export** to back up.
- `localStorage` is not secure. Anyone with access to the device can inspect saved roles and words; the game only hides secrets on screen during play.
- Browsers typically allow about 5 MB per site.

### Reset the local library

- In the app: **Library → Reset library to starter groups** (asks for confirmation).
- Or clear everything: open browser dev tools → Application → Local Storage → delete the `shadow-words:*` keys.

## Project structure

```
app/                 Next.js App Router pages (server components that render client views)
  page.tsx           Dashboard
  game/{setup,play,results}/page.tsx
  library/{page.tsx,new/page.tsx,[groupId]/page.tsx}
components/          UI: layout, dashboard, game, library, forms, ui (dialog, toast), providers
lib/
  words/             normalization, validation, group CRUD, CSV/JSON import & export
  game/              roles, selection (no-repeat), voting, win conditions, game engine
  storage/           localStorage helpers, library + session persistence
types/               Typed models (WordGroup, WordPair, Player, GameSession, ...)
data/starter-groups.ts   Starter library as local TypeScript data
```

Domain logic in `lib/` is pure TypeScript with no React or browser dependencies (except `lib/storage` and file download), so it is easy to reason about and reuse.

## Tech

Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3, Lucide icons. State is held in a React context provider backed by `localStorage`. UI primitives (dialog, toast, switch) are small in-house components built on native elements instead of the shadcn CLI, so no extra tooling is needed. No testing framework or database is included.
