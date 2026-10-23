# Shadow Words

A social deduction word game (inspired by *Undercover*) built with Next.js. Two ways to play:

- **Play on phones (new):** one person hosts a room, everyone else joins from **their own phone** on the same Wi-Fi. Each phone shows only that player's secret word and takes that player's private vote. Game state lives in a local **MariaDB** database.
- **Pass-and-play:** friends share **one device**, exactly as before (works without the database, everything in `localStorage`).

The app also includes a full word-library manager. The word library is mirrored to MariaDB so any host picks words from the same library.

## Prerequisites

- Node.js 18.18 or newer (20+ recommended) and npm
- **MariaDB 10.5+** running on the computer that hosts the game (only needed for phone play and library sync; pass-and-play works without it)
- A Wi-Fi network that all phones share (and that lets devices talk to each other: some guest/hotel networks block this)

## Database setup (one time)

Pick one:

**A. MariaDB installed on your computer**

```bash
# Debian/Ubuntu: sudo apt install mariadb-server     macOS: brew install mariadb && brew services start mariadb
sudo mariadb < db/init.sql     # creates database `shadow_words` and user `shadow` (edit the password in the file first!)
```

**B. Docker** (untested helper file, standard MariaDB image)

```bash
docker compose up -d           # uses docker-compose.yml, matches .env.example
```

**C. An existing MariaDB server**: create a database and a user with full rights on it, then put the details in `.env.local`.

Then configure the connection:

```bash
cp .env.example .env.local     # edit DB_PASSWORD etc. if you changed them
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `DB_HOST` | `127.0.0.1` | MariaDB host |
| `DB_PORT` | `3306` | MariaDB port |
| `DB_USER` | `shadow` | Database user |
| `DB_PASSWORD` | *(empty)* | Database password |
| `DB_NAME` | `shadow_words` | Database name |

The tables are created automatically the first time the app talks to the database (see `db/schema.sql` for reference).

## Install and run

```bash
npm install
npm run dev        # http://localhost:3000  (listens on all network interfaces)
```

Production build (recommended for game night, it's faster on phones):

```bash
npm run build
npm run start      # http://localhost:3000  (listens on all network interfaces)
```

Both scripts bind to `0.0.0.0` so phones can reach them. If your computer has a firewall, allow incoming connections to port 3000 (Windows: allow Node.js on *Private* networks; macOS: allow incoming connections for Node when prompted; Linux `ufw`: `sudo ufw allow 3000/tcp`).

## Playing on phones

1. On the host computer or phone open the app and go to **Online → Host a game**, enter your name and press **Create room**. The page shows a 4-letter code, a **QR code** and a link such as `http://192.168.1.20:3000/online/room/KQXD`.
2. Everyone else scans the QR code (or opens the link, or goes to **Online → Join a game** and types the code) and enters a name.
3. The host picks Undercover / Mr. White counts, word groups and rules in the lobby and presses **Start game**. The host plays too.
4. On each phone: reveal your own word, tap *I'm ready*, and when everyone is ready the clue round begins. Clues are spoken aloud. The host moves the group through discussion and voting; each player votes on their own phone and voting ends automatically when everybody has voted.
5. The elimination reveals the role to everyone. Mr. White guesses on his own phone. The results screen shows everything; the host can *Play again* (scores are kept) or go *Back to lobby*.

Tips:

- Tap **My word** (top right) at any time to peek at your own word; it hides itself after 5 seconds.
- Lost your connection or closed the page? Reopen the link; the browser remembers your seat. On a new browser, join with the **same name** (works once the old seat has been offline for 20 seconds).
- If the host's phone disappears, any player can tap **Take over as host**.
- If a player is away during voting, the host can press **End voting now**; during the reveal the host can press **Start without waiting**.
- Testing alone? Use one private/incognito window per extra player (each browser profile stores one identity per room).

### How privacy works

The full game (roles, words, votes) is stored on the server in MariaDB. Phones never receive it: every poll returns a **personal view** built for that player only. It contains your own word, who has voted (not for whom), and other players' roles only after they are eliminated (everything at the end). Nobody, including the host, can read other players' words from their own phone's network traffic. Anyone with access to the database or the server could, of course.

## How to play (rules)

1. **Game setup**: add 3 or more players, choose how many Undercover and Mr. White players there are (Civilians are calculated automatically), pick word groups and rules.
2. **Secret words**: each player sees their own word privately (pass-and-play: the device is passed around; phones: each on their own screen).
3. **Clue round**: a random player starts; everyone gives one spoken clue.
4. **Discussion**: optional countdown timer (on phones all players see the same countdown).
5. **Voting**: each active player votes privately. Individual votes stay hidden; only totals are shown after voting.
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

## Where data is stored

| What | Where |
| --- | --- |
| Word library | MariaDB (`sw_kv`, key `library`) **and** the browser's `localStorage` as an offline copy |
| Online rooms, players, running games | MariaDB (`sw_rooms`, `sw_room_players`) |
| Used-pair history for online games | MariaDB (`sw_kv`, key `used_pairs`), shared by all rooms |
| Pass-and-play game in progress, settings, local used-pair history | Browser `localStorage` |

Library sync: when the app opens it loads the library from MariaDB. If the database has none yet, your browser's library is uploaded (first run). After that, every edit is saved to the database a moment after you make it. If two devices edit the library at the same time, the last save wins. If MariaDB is unreachable the app keeps working with the local copy and the **Online** page explains what is wrong.

Rooms that haven't been used for 24 hours are deleted automatically (checked whenever a room is created).

`localStorage` keys (versioned with a schema field; corrupted data is backed up to `<key>:corrupt-backup`):

| Key | Contents |
| --- | --- |
| `shadow-words:library` | Local copy of word groups and pairs |
| `shadow-words:prefs` | Settings and last pass-and-play setup |
| `shadow-words:session` | The pass-and-play game in progress |
| `shadow-words:history` | Used-pair history (pass-and-play) |
| `shadow-words:online:<CODE>` | Your seat (player id + secret token) in an online room |

**Limitations**

- Phone play needs everyone on the same network as the host computer, over plain HTTP. There are no accounts: anyone who can open the link and knows the room code can join a lobby. Use it among friends, not on the open internet.
- Pass-and-play data lives in the current browser only; use **Export** to back up your library.
- `localStorage` is not secure; in pass-and-play the game only hides secrets on screen.
- Phones poll the server about every 1.5 seconds, so changes appear within a moment rather than instantly.
- A room holds up to 20 players. Nobody can join a game that has already started (except to reclaim their own seat).

### Reset

- Word library: **Library → Reset library to starter groups**.
- Everything in the database: `mariadb -e "DROP DATABASE shadow_words"` then re-run `db/init.sql`.
- Local browser data: dev tools → Application → Local Storage → delete the `shadow-words:*` keys.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| Online page says *Cannot reach MariaDB* | Start MariaDB; check `DB_HOST` / `DB_PORT` in `.env.local`; restart the app after editing it |
| *MariaDB rejected the login* | `DB_USER` / `DB_PASSWORD` don't match what `db/init.sql` created |
| *Database does not exist* / *no access* | Run `db/init.sql` as the MariaDB admin |
| Phones can't open the link | Same Wi-Fi? Firewall allows port 3000? Router "client isolation" off? Use the LAN address shown on the Online page, not `localhost` |
| Join link shows `localhost` | Open the app on the host via its LAN address (shown on the Online page) |

## Project structure

```
app/                 Next.js App Router pages (server components that render client views)
  page.tsx           Dashboard
  game/{setup,play,results}/page.tsx      Pass-and-play
  online/page.tsx, online/room/[code]/    Phone play: hub and room
  library/{page.tsx,new/page.tsx,[groupId]/page.tsx}
  api/                                    health, library, rooms (create, join, state, action)
components/          UI: layout, dashboard, game, online, library, forms, ui (dialog, toast), providers
lib/
  words/             normalization, validation, group CRUD, CSV/JSON import & export
  game/              roles, selection (no-repeat), voting, win conditions, game engine
  storage/           localStorage helpers, library + session persistence
  online/            client API + credentials, shared lobby-config helpers
  server/            MariaDB pool + schema (db.ts), rooms/game actions + per-player views (rooms.ts)
types/               Typed models (WordGroup, WordPair, Player, GameSession, RoomView, ...)
db/                  init.sql (create database + user), schema.sql (reference)
data/starter-groups.ts   Starter library as local TypeScript data
```

Domain logic in `lib/game` and `lib/words` is pure TypeScript with no React or browser dependencies, so the **same engine** runs in the browser (pass-and-play) and on the server (phone play). Room mutations run inside a MariaDB transaction that locks the room row, so simultaneous taps from several phones can't corrupt a game.

## Tech

Next.js 15 (App Router, route handlers), React 19, TypeScript, Tailwind CSS 3, Lucide icons, the official `mariadb` Node connector, `qrcode` for the join QR. Pass-and-play state is held in a React context provider backed by `localStorage`; online state lives in MariaDB and is synced to phones by short polling. UI primitives (dialog, toast, switch) are small in-house components. No testing framework is included.
