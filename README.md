# MorListening

A local-first Spotify Extended Streaming History analyzer built with React 19, TypeScript, and Vite. Drop in your Spotify data export ZIP and explore your lifetime listening as rankings, calendars, heatmaps, timelines, and platform breakdowns — all parsed and rendered in your browser. Nothing is uploaded to a server.

**🔗 Live app:** **[https://morlistening.netlify.app](https://morlistening.netlify.app)**

**📦 Repository:** [github.com/MayoWolf/MorListening](https://github.com/MayoWolf/MorListening)

---

## Table of Contents

- [Highlights](#highlights)
- [Tech Stack](#tech-stack)
- [Dashboard Views](#dashboard-views)
- [File Architecture](#file-architecture)
- [Data Flow](#data-flow)
- [Type Model](#type-model)
- [Statistics Engine](#statistics-engine)
- [Privacy Posture](#privacy-posture)
- [Getting Started](#getting-started)
- [Importing Your Data](#importing-your-data)
- [Deployment](#deployment)
- [License](#license)

---

## Highlights

- **Local-first parsing** — your archive is read in the browser. Raw IPs and user-agent fields are ignored.
- **ZIP-aware import** — drop the unmodified `my_spotify_data.zip` (or the inner `Streaming_History_Audio_*.json` files); the parser locates them automatically via JSZip.
- **Lifetime + ranged analytics** — toggle between **Lifetime**, **This year**, **6 months**, **4 weeks**, **7 days**, and **Today**.
- **Six dashboard views**: Overview, Timeline, Tracks, Artists, Calendar (heatmap), and Insights.
- **Honest stats** — streams under 30s, Spotify-flagged skips, podcasts, audiobooks, and tracks without a `spotify_track_uri` are flagged as `hiddenFromStats` so rankings reflect real listening.
- **Time-zone aware** — daily buckets are computed in the user's local IANA time zone via `date-fns-tz` (`formatInTimeZone`).
- **Stable deduping** — each play is keyed by a SHA-256 of timestamp + track URI + duration + reasons + names, so re-importing the same archive is idempotent.
- **Smart platform normalization** — raw `platform` strings (e.g. `OS X 10.15.7`, `iOS 17.4 (iPhone15,2)`, `Partner sonos_…`) are bucketed into clean labels like `macOS`, `iOS`, `Sonos`.
- **Searchable timesheet** — full-text filter across track / artist / album in the Timeline view.

---

## Tech Stack

| Layer        | Choice                                                |
| ------------ | ----------------------------------------------------- |
| Framework    | React 19 + TypeScript (strict mode)                   |
| Build tool   | Vite 6 with `@vitejs/plugin-react`                    |
| Charts       | Recharts 2 (responsive bar charts + custom tooltips)  |
| Icons        | lucide-react                                          |
| ZIP parsing  | JSZip                                                 |
| Date / TZ    | date-fns 4 + date-fns-tz 3                            |
| Hashing      | Web Crypto (`crypto.subtle.digest('SHA-256', …)`)     |
| Hosting      | Netlify (SPA redirect to `/index.html`)               |

No backend, no database, no analytics SDK, no auth. Just a static SPA.

---

## Dashboard Views

| View       | What it shows                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `Overview` | Daily-listening bar chart, hour-of-day grid, weekday rhythm, platform mix, top tracks/artists/albums, best days. |
| `Timeline` | Day-grouped timesheet of every play (newest first), with search, mini top-tracks/artists per day, and muted styling for hidden streams. |
| `Tracks`   | Deep ranking of the top 40 tracks by listening time.                                                |
| `Artists`  | Deep ranking of the top 40 artists by listening time, with unique-track counts.                     |
| `Calendar` | GitHub-style heatmap, one square per local day, grouped by year. Click a square to see that day's totals + top 5 tracks. |
| `Insights` | Anchor artist, replay magnet, heaviest day, album world, strongest weekday, main platform.          |

A floating header keeps the active range and view in sync; switching views reuses the same memoized aggregates.

---

## File Architecture

```
MorListening/
├── index.html                       # Vite entry, mounts #root
├── netlify.toml                     # build = "npm run build", publish = "dist", SPA redirect
├── package.json                     # scripts: dev / build / preview
├── tsconfig.json                    # strict TS, ES2020, react-jsx
├── tsconfig.node.json
├── vite.config.ts                   # @vitejs/plugin-react
├── src/
│   ├── main.tsx                     # ReactDOM.createRoot → <App /> in StrictMode
│   ├── App.tsx                      # All views, range/view state, layout, panels
│   ├── styles.css                   # Visual design system (panels, grids, heatmap)
│   ├── types.ts                     # SpotifyExtendedStream, NormalizedStream, ImportSummary,
│   │                                #   TopTrack, TopArtist, DailyTotal
│   ├── lib/
│   │   ├── parseSpotifyHistory.ts   # ZIP/JSON ingest, normalize, dedupe, summary
│   │   ├── stats.ts                 # filterByRange, topTracks/Artists/Albums,
│   │   │                            #   dailyTotals, hourlyTotals, weekdayTotals,
│   │   │                            #   platformTotals, bestDays, calendarDays,
│   │   │                            #   longestListeningStreak, skipRate, groupStreamsByDate
│   │   └── date.ts                  # formatDuration, formatExactDuration, formatDay,
│   │                                #   formatTime, formatShortDate, formatShortDateWithYear
│   └── components/
│       ├── ImportDropzone.tsx       # Drag-and-drop + file picker (.zip / .json)
│       ├── RangePicker.tsx          # Lifetime / Year / 6m / 4w / 7d / Today
│       ├── Charts.tsx               # DailyChart, CategoryBarChart, RankingCharts (Recharts)
│       ├── Timeline.tsx             # Day-grouped timesheet with search
│       └── StatCard.tsx             # Generic label/value/detail tile
└── dist/                            # Vite build output (deployed by Netlify)
```

---

## Data Flow

```
   ┌─────────────────┐    drop / pick     ┌──────────────────────────┐
   │ ImportDropzone  │ ─────────────────▶ │ App.handleImport(files)  │
   └─────────────────┘                    └────────────┬─────────────┘
                                                       │
                                                       ▼
                              ┌─────────────────────────────────────────┐
                              │ parseSpotifyHistoryFiles                │
                              │   • JSZip.loadAsync(zip)                │
                              │   • match /Streaming_History_Audio.*\.json/i
                              │   • JSON.parse + isSpotifyStreamRow     │
                              │   • normalizeStream → NormalizedStream  │
                              │     (sha256 id, localDate via TZ,       │
                              │      hiddenFromStats flag)              │
                              │   • dedupe via Map<id, stream>          │
                              │   • return { streams, summary }         │
                              └────────────┬────────────────────────────┘
                                           │
                                           ▼
              ┌──────────────────────────────────────────────────────────┐
              │ App state                                                │
              │   streams ← Map merge, sorted by playedAt                │
              │   range   ← RangePicker (all/today/7d/4w/6m/year)        │
              │   view    ← viewTabs                                     │
              └────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
              ┌──────────────────────────────────────────────────────────┐
              │ stats.ts (memoized via useMemo)                          │
              │   filterByRange → rangedStreams                          │
              │   topTracks / topArtists / topAlbums                     │
              │   dailyTotals / hourlyTotals / weekdayTotals             │
              │   platformTotals (with raw-platform breakdowns)          │
              │   bestDays / calendarDays                                │
              │   longestListeningStreak / skipRate                      │
              │   groupStreamsByDate (for Timeline)                      │
              └────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────────────────────┐
                │ Views: Overview / Timeline / Tracks  │
                │        / Artists / Calendar / Insights│
                └──────────────────────────────────────┘
```

---

## Type Model

Defined in `src/types.ts`:

- **`SpotifyExtendedStream`** — the raw row shape from Spotify's Extended Streaming History export. Includes `ts`, `ms_played`, `master_metadata_*`, `spotify_track_uri`, `episode_*`, `audiobook_*`, `reason_start`, `reason_end`, `shuffle`, `skipped`, `offline`, `incognito_mode`, plus IP / user-agent fields that are intentionally **never read** by the app.
- **`NormalizedStream`** — the in-memory shape:
  ```ts
  {
    id: string;              // SHA-256(playedAt:trackUri:msPlayed:reasons:names)
    playedAt: string;        // ISO timestamp from Spotify
    localDate: string;       // YYYY-MM-DD in the user's IANA time zone
    trackUri / trackName / artistName / albumName: string | null;
    msPlayed: number;
    platform / country / reasonStart / reasonEnd: string | null;
    shuffle / skipped / offline / incognitoMode: boolean | null;
    hiddenFromStats: boolean;
    source: "import" | "sync";
  }
  ```
- **`ImportSummary`** — `{ filesRead, rawRows, importedRows, duplicateRows, hiddenRows, firstPlayedAt, lastPlayedAt }`.
- **`TopTrack` / `TopArtist` / `DailyTotal`** — aggregate shapes consumed by every view.

`src/lib/stats.ts` adds `RangeKey`, `TopAlbum`, `CategoryTotal`, and `CategoryBreakdown` for the platform-mix and weekday-rhythm panels.

---

## Statistics Engine

All aggregation lives in `src/lib/stats.ts` and is pure-functional over `NormalizedStream[]`:

| Function                       | Output                                                                   |
| ------------------------------ | ------------------------------------------------------------------------ |
| `statStreams(streams)`         | Drops anything where `hiddenFromStats === true`.                         |
| `filterByRange(streams, key)`  | Slices to Lifetime / This year / 6m / 4w / 7d / Today.                   |
| `topTracks` / `topArtists` / `topAlbums` | Grouped + sorted by `msPlayed`. Artists also track unique tracks. |
| `dailyTotals(streams)`         | One row per `localDate`, sorted ascending.                               |
| `hourlyTotals(streams)`        | 24 rows of `msPlayed` keyed by local hour, labeled `12 AM` … `11 PM`.    |
| `weekdayTotals(streams)`       | Sun–Sat with `msPlayed` averaged across days the range actually covers (so a heavy Saturday in a 6-month range isn't double-counted). |
| `platformTotals(streams)`      | Bucketed labels (Android, iOS, macOS, Windows, Web, PlayStation, Xbox, Sonos, Chromecast, Other) plus a `details[]` breakdown of the raw `platform` strings inside each bucket. |
| `bestDays(streams, limit=6)`   | Heaviest listening days by total ms.                                     |
| `calendarDays(streams)`        | Same as `dailyTotals`; consumed by the heatmap.                          |
| `longestListeningStreak(days)` | Longest run of consecutive listening days.                               |
| `skipRate(streams)`            | Fraction of rows where Spotify set `skipped: true`.                      |
| `groupStreamsByDate(streams)`  | `[{ date, streams, msPlayed }]`, newest first — drives the Timeline.     |

The hash key in `parseSpotifyHistory.ts` is built from
`playedAt : trackUri : ms_played : reason_start : reason_end : trackName : artistName`,
which makes re-imports deterministic without losing legitimate replays of the same track at different timestamps.

---

## Privacy Posture

- All parsing happens in the browser — **no network calls are made with archive contents**.
- Raw IP (`ip_addr_decrypted`) and user-agent (`user_agent_decrypted`) fields from the Spotify export are never read, stored, or displayed.
- Podcasts (`episode_*`) and audiobooks (`audiobook_*`) are excluded from rankings. They still appear in the raw timeline so the timesheet stays honest.
- Plays under 30 seconds and Spotify-flagged skips are excluded from rankings.
- State lives only in React memory — refreshing the page clears the import. There is no `localStorage`, cookie, or service-worker cache of your data.

---

## Getting Started

Prerequisites: **Node.js 18+** and **npm**.

```bash
# install
npm install

# dev server (http://127.0.0.1:5173)
npm run dev

# typecheck + production build into dist/
npm run build

# preview the production build locally
npm run preview
```

The `build` script runs `tsc` (strict typecheck, no emit) before `vite build`, so type errors fail the build.

---

## Importing Your Data

1. Request your data from Spotify: **Account → Privacy settings → Download your data → Extended streaming history**. Spotify emails the ZIP within a few days.
2. Open [morlistening.netlify.app](https://morlistening.netlify.app) (or your local dev server).
3. Drag `my_spotify_data.zip` onto the dropzone, or click **Choose files**. You can also import individual `Streaming_History_Audio_*.json` files.
4. Use the range picker in the header to switch between Lifetime / This year / 6 months / 4 weeks / 7 days / Today.
5. Switch between Overview / Timeline / Tracks / Artists / Calendar / Insights with the view tabs.

Importing the same archive twice is a no-op — the SHA-256 dedupe handles it.

---

## Deployment

The repo is configured for Netlify via `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Pushing to `main` on [github.com/MayoWolf/MorListening](https://github.com/MayoWolf/MorListening) triggers a Netlify build that publishes to **[morlistening.netlify.app](https://morlistening.netlify.app)**. The SPA redirect ensures direct hits on `/anything` still return `index.html` so the React app can take over routing.

---

## License

Personal project — no license declared. Reach out if you want to reuse any of the parsing or stats logic.
