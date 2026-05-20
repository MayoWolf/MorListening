import {
  Activity,
  AlertCircle,
  Album,
  AudioLines,
  BarChart3,
  CalendarDays,
  Disc3,
  Flame,
  Gauge,
  Info,
  Library,
  ListMusic,
  Music2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import { CategoryBarChart, DailyChart, RankingCharts } from "./components/Charts";
import { ImportDropzone } from "./components/ImportDropzone";
import { RangePicker } from "./components/RangePicker";
import { Timeline } from "./components/Timeline";
import { formatDay, formatDuration, formatShortDate, formatShortDateWithYear } from "./lib/date";
import { parseSpotifyHistoryFiles } from "./lib/parseSpotifyHistory";
import {
  bestDays,
  calendarDays,
  dailyTotals,
  filterByRange,
  hourlyTotals,
  longestListeningStreak,
  platformTotals,
  skipRate,
  statStreams,
  topAlbums,
  topArtists,
  topTracks,
  weekdayTotals,
  type CategoryTotal,
  type RangeKey,
  type TopAlbum,
} from "./lib/stats";
import type { DailyTotal, ImportSummary, NormalizedStream, TopArtist, TopTrack } from "./types";

const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const views = ["Overview", "Timeline", "Tracks", "Artists", "Calendar", "Insights"] as const;
type ViewKey = (typeof views)[number];

export function App() {
  const [streams, setStreams] = useState<NormalizedStream[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [range, setRange] = useState<RangeKey>("all");
  const [view, setView] = useState<ViewKey>("Overview");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rangedStreams = useMemo(() => filterByRange(streams, range), [streams, range]);
  const countedStreams = useMemo(() => statStreams(rangedStreams), [rangedStreams]);
  const trackRows = useMemo(() => topTracks(rangedStreams), [rangedStreams]);
  const artistRows = useMemo(() => topArtists(rangedStreams), [rangedStreams]);
  const albumRows = useMemo(() => topAlbums(rangedStreams), [rangedStreams]);
  const dailyRows = useMemo(() => dailyTotals(rangedStreams), [rangedStreams]);
  const calendarRows = useMemo(() => calendarDays(rangedStreams), [rangedStreams]);
  const bestDayRows = useMemo(() => bestDays(rangedStreams), [rangedStreams]);
  const hourRows = useMemo(() => hourlyTotals(rangedStreams), [rangedStreams]);
  const weekdayRows = useMemo(() => weekdayTotals(rangedStreams), [rangedStreams]);
  const platformRows = useMemo(() => platformTotals(rangedStreams), [rangedStreams]);

  const totals = useMemo(() => {
    const totalMs = countedStreams.reduce((sum, stream) => sum + stream.msPlayed, 0);
    const peakHour = [...hourRows].sort((a, b) => b.msPlayed - a.msPlayed)[0];
    const skipPercent = Math.round(skipRate(rangedStreams) * 100);
    const streak = longestListeningStreak(dailyRows);

    return {
      totalMs,
      skipPercent,
      streak,
      uniqueTracks: new Set(countedStreams.map((stream) => stream.trackUri).filter(Boolean)).size,
      uniqueArtists: new Set(countedStreams.map((stream) => stream.artistName).filter(Boolean)).size,
      uniqueAlbums: new Set(
        countedStreams
          .filter((stream) => stream.albumName)
          .map((stream) => `${stream.albumName}:${stream.artistName ?? ""}`)
      ).size,
      peakHour,
    };
  }, [countedStreams, dailyRows, hourRows, rangedStreams]);

  async function handleImport(files: File[]) {
    setError(null);
    setIsImporting(true);
    try {
      const result = await parseSpotifyHistoryFiles(files, userTimeZone);
      setStreams((existing) => {
        const merged = new Map(existing.map((stream) => [stream.id, stream]));
        for (const stream of result.streams) merged.set(stream.id, stream);
        return [...merged.values()].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
      });
      setSummary(result.summary);
      setView("Overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import those files.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main>
      <header className="appHeader">
        <div>
          <span className="eyebrow">
            <Disc3 size={16} aria-hidden="true" />
            MorListening
          </span>
          <h1>Your Spotify archive, turned into a living listening graph.</h1>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </header>

      <section className="commandGrid">
        <CommandDeck
          hasStreams={streams.length > 0}
          topTrack={trackRows[0]}
          topArtist={artistRows[0]}
          topAlbum={albumRows[0]}
          totalMs={totals.totalMs}
          streamCount={countedStreams.length}
          peakHour={totals.peakHour?.hour ?? "00:00"}
        />
        <ImportDropzone isImporting={isImporting} onImport={handleImport} />
        <ImportStatus summary={summary} />
      </section>

      {error ? (
        <div className="errorBanner" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          {error}
        </div>
      ) : null}

      <MetricStrip
        metrics={[
          {
            icon: <AudioLines size={18} />,
            label: "Listening time",
            value: formatDuration(totals.totalMs),
            detail: `${countedStreams.length.toLocaleString()} counted streams`,
          },
          {
            icon: <Music2 size={18} />,
            label: "Tracks",
            value: totals.uniqueTracks.toLocaleString(),
            detail: trackRows[0] ? `Most played track: ${trackRows[0].trackName}` : "Waiting for import",
          },
          {
            icon: <Library size={18} />,
            label: "Artists",
            value: totals.uniqueArtists.toLocaleString(),
            detail: artistRows[0] ? `Most listened artist: ${artistRows[0].artistName}` : "Waiting for import",
          },
          {
            icon: <Album size={18} />,
            label: "Albums",
            value: totals.uniqueAlbums.toLocaleString(),
            detail: albumRows[0] ? `Most listened album: ${albumRows[0].albumName}` : "Waiting for import",
          },
          {
            icon: <Gauge size={18} />,
            label: "Skip rate",
            value: `${totals.skipPercent}%`,
            detail: "Streams Spotify marked as skipped",
          },
          {
            icon: <Flame size={18} />,
            label: "Longest streak",
            value: `${totals.streak}`,
            detail: totals.streak === 1 ? "1 listening day in a row" : `${totals.streak} listening days in a row`,
          },
        ]}
      />

      <nav className="viewTabs" aria-label="Dashboard views">
        {views.map((item) => (
          <button key={item} className={item === view ? "active" : ""} onClick={() => setView(item)} type="button">
            {item}
          </button>
        ))}
      </nav>

      {streams.length === 0 ? <EmptyStart /> : null}

      {streams.length > 0 ? (
        <section className="viewSurface" key={view}>
          {view === "Overview" ? (
            <OverviewView
              dailyRows={dailyRows}
              hourRows={hourRows}
              weekdayRows={weekdayRows}
              platformRows={platformRows}
              tracks={trackRows}
              artists={artistRows}
              albums={albumRows}
              bestDays={bestDayRows}
            />
          ) : null}

          {view === "Timeline" ? <Timeline streams={rangedStreams} /> : null}

          {view === "Tracks" ? (
            <DeepRanking title="Top tracks" subtitle="Songs ranked by listening time" rows={trackRows} kind="track" />
          ) : null}

          {view === "Artists" ? (
            <DeepRanking title="Top artists" subtitle="Artists ranked by listening time" rows={artistRows} kind="artist" />
          ) : null}

          {view === "Calendar" ? (
            <CalendarView
              days={calendarRows}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              streams={rangedStreams}
            />
          ) : null}

          {view === "Insights" ? (
            <InsightsView
              bestDays={bestDayRows}
              platforms={platformRows}
              weekdays={weekdayRows}
              albums={albumRows}
              tracks={trackRows}
              artists={artistRows}
            />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function CommandDeck({
  hasStreams,
  topTrack,
  topArtist,
  topAlbum,
  totalMs,
  streamCount,
  peakHour,
}: {
  hasStreams: boolean;
  topTrack?: TopTrack;
  topArtist?: TopArtist;
  topAlbum?: TopAlbum;
  totalMs: number;
  streamCount: number;
  peakHour: string;
}) {
  return (
    <article className="commandDeck" aria-label="Listening summary">
      <div className="deckGlow" aria-hidden="true" />
      <div className="deckHeader">
        <span className="livePill">
          <span />
          {hasStreams ? "Archive indexed" : "Awaiting import"}
        </span>
        <span className="microLabel">Local-first analytics</span>
      </div>
      <div className="deckHero">
        <div>
          <h2>{hasStreams ? formatDuration(totalMs) : "Import your ZIP"}</h2>
          <p>
            {hasStreams
              ? `${streamCount.toLocaleString()} counted streams mapped across tracks, artists, albums, days, and platforms.`
              : "Upload your ZIP to unlock lifetime charts, heatmaps, rankings, and timesheets."}
          </p>
        </div>
        <div className="deckDial" aria-hidden="true">
          <span />
          <i />
        </div>
      </div>
      <div className="deckStats">
        <div>
          <small>Top artist</small>
          <strong>{topArtist?.artistName ?? "Pending"}</strong>
        </div>
        <div>
          <small>Top track</small>
          <strong>{topTrack?.trackName ?? "Pending"}</strong>
        </div>
        <div>
          <small>Top album</small>
          <strong>{topAlbum?.albumName ?? "Pending"}</strong>
        </div>
        <div>
          <small>Peak hour</small>
          <strong>{peakHour}</strong>
        </div>
      </div>
    </article>
  );
}

function ImportStatus({ summary }: { summary: ImportSummary | null }) {
  const indexedLabel = summary
    ? `${Math.max(summary.importedRows - summary.hiddenRows, 0).toLocaleString()} stats-ready plays`
    : "Waiting for your archive";
  const rangeLabel =
    summary?.firstPlayedAt && summary.lastPlayedAt
      ? `${formatShortDate(summary.firstPlayedAt.slice(0, 10))} - ${formatShortDate(summary.lastPlayedAt.slice(0, 10))}`
      : "No listening range yet";

  return (
    <section className="receiptPanel">
      <span className="microLabel">Archive status</span>
      <div className={`archiveOrb ${summary ? "archiveOrbReady" : ""}`} aria-hidden="true">
        <span />
      </div>
      <h2>{summary ? "Indexed" : "Local parser ready"}</h2>
      <p>{indexedLabel}</p>
      <div className="archiveStatusGrid">
        <span>Range</span>
        <strong>{rangeLabel}</strong>
        <span>Privacy</span>
        <strong>Raw IP fields ignored</strong>
        <span>Cleanup</span>
        <strong>{summary ? "Duplicates and skips filtered" : "Ready to clean streams"}</strong>
      </div>
    </section>
  );
}

function MetricStrip({
  metrics,
}: {
  metrics: Array<{ icon: ReactNode; label: string; value: string; detail: string }>;
}) {
  return (
    <section className="metricStrip">
      {metrics.map((metric) => (
        <article className="metricTile" key={metric.label}>
          <span className="metricIcon">{metric.icon}</span>
          <small>{metric.label}</small>
          <strong>{metric.value}</strong>
          <p>{metric.detail}</p>
        </article>
      ))}
    </section>
  );
}

function OverviewView({
  dailyRows,
  hourRows,
  weekdayRows,
  platformRows,
  tracks,
  artists,
  albums,
  bestDays,
}: {
  dailyRows: DailyTotal[];
  hourRows: Array<{ hour: string; msPlayed: number }>;
  weekdayRows: CategoryTotal[];
  platformRows: CategoryTotal[];
  tracks: TopTrack[];
  artists: TopArtist[];
  albums: TopAlbum[];
  bestDays: DailyTotal[];
}) {
  return (
    <>
      <section className="dashboardGrid">
        <DailyChart data={dailyRows} />
        <RhythmPanel title="Listening by hour" caption="Local time" rows={hourRows.map((row) => ({ label: row.hour, msPlayed: row.msPlayed }))} />
      </section>
      <section className="dashboardGrid">
        <CategoryBarChart title="Weekday rhythm" caption="Daily avg minutes" data={weekdayRows} />
        <RhythmPanel title="Platforms" caption="Where plays came from" rows={platformRows.slice(0, 8)} horizontal />
      </section>
      <RankingCharts tracks={tracks} artists={artists} />
      <section className="dashboardGrid">
        <CompactRanking title="Top albums" rows={albums.slice(0, 7)} />
        <BestDays days={bestDays} />
      </section>
    </>
  );
}

function RhythmPanel({
  title,
  caption,
  rows,
  horizontal = false,
}: {
  title: string;
  caption: string;
  rows: Array<{ label: string; msPlayed: number; details?: CategoryTotal["details"] }>;
  horizontal?: boolean;
}) {
  const max = Math.max(...rows.map((row) => row.msPlayed), 1);
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  return (
    <section className={`chartPanel rhythmPanel ${horizontal ? "horizontalBars" : ""}`}>
      <div className="panelHeader">
        <h2>{title}</h2>
        <span>{caption}</span>
      </div>
      <div className={horizontal ? "sideBarRows" : "hourGrid"}>
        {rows.map((row) =>
          horizontal ? (
            <div className={`sideBarRow ${openInfo === row.label ? "sideBarRowOpen" : ""}`} key={row.label}>
              <div className="sideBarLabel">
                <span>{row.label}</span>
                {row.details ? (
                  <button
                    className="barInfoButton"
                    onClick={() => setOpenInfo(openInfo === row.label ? null : row.label)}
                    type="button"
                    aria-label={`Show ${row.label} platform breakdown`}
                  >
                    <Info size={14} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <div className="sideBarTrack">
                <i style={{ width: `${Math.max((row.msPlayed / max) * 100, 3)}%` }} />
              </div>
              <small>{formatDuration(row.msPlayed)}</small>
              {openInfo === row.label && row.details ? (
                <div className="platformBreakdown">
                  {row.details.slice(0, 8).map((detail) => (
                    <div key={detail.label}>
                      <span>{detail.label}</span>
                      <strong>{Math.round(detail.percent * 100)}%</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hourCell" key={row.label}>
              <span>{row.label}</span>
              <div>
                <i style={{ height: `${Math.max((row.msPlayed / max) * 100, 3)}%` }} />
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}

function CompactRanking({ title, rows }: { title: string; rows: TopAlbum[] }) {
  const max = Math.max(...rows.map((row) => row.msPlayed), 1);
  return (
    <section className="rankingPanel">
      <div className="panelHeader">
        <h2>{title}</h2>
        <span>Album minutes</span>
      </div>
      <div className="rankingRows">
        {rows.map((row, index) => (
          <article className="rankingRow" key={`${row.albumName}:${row.artistName}`}>
            <span className="rankNumber">{index + 1}</span>
            <div className="rankingText">
              <strong>{row.albumName}</strong>
              <small>
                {row.artistName ?? "Unknown artist"} · {row.uniqueTracks} tracks · {formatDuration(row.msPlayed)}
              </small>
            </div>
            <span className="rankingValue">{row.streams} plays</span>
            <div className="rankingBar" aria-hidden="true">
              <span style={{ width: `${Math.max((row.msPlayed / max) * 100, 3)}%` }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BestDays({ days }: { days: DailyTotal[] }) {
  return (
    <section className="rankingPanel bestDaysPanel">
      <div className="panelHeader">
        <h2>Best days</h2>
        <span>Highest listening totals</span>
      </div>
      <div className="bestDayGrid">
        {days.map((day) => (
          <article key={day.date}>
            <span>{formatShortDateWithYear(day.date)}</span>
            <strong>{formatDuration(day.msPlayed)}</strong>
            <small>{day.streams} streams</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function DeepRanking({
  title,
  subtitle,
  rows,
  kind,
}: {
  title: string;
  subtitle: string;
  rows: TopTrack[] | TopArtist[];
  kind: "track" | "artist";
}) {
  const max = Math.max(...rows.map((row) => row.msPlayed), 1);
  return (
    <section className="deepPanel">
      <div className="deepHeader">
        <div>
          <span className="microLabel">{kind === "track" ? "Track" : "Artist"}</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <TrendingUp size={28} aria-hidden="true" />
      </div>
      <div className="deepRows">
        {rows.slice(0, 40).map((row, index) => {
          const name = kind === "track" ? (row as TopTrack).trackName : (row as TopArtist).artistName;
          const detail =
            kind === "track"
              ? `${(row as TopTrack).artistName ?? "Unknown artist"} · ${row.streams} plays`
              : `${(row as TopArtist).uniqueTracks} tracks · ${row.streams} plays`;
          return (
            <article className="deepRow" key={name}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{name}</strong>
                <small>{detail}</small>
              </div>
              <em>{formatDuration(row.msPlayed)}</em>
              <i style={{ transform: `scaleX(${Math.max(row.msPlayed / max, 0.03)})` }} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

type CalendarYear = {
  year: number;
  leadingBlanks: number;
  days: DailyTotal[];
};

function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCalendarYears(days: DailyTotal[]): CalendarYear[] {
  if (days.length === 0) return [];

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const totalsByDate = new Map(sortedDays.map((day) => [day.date, day]));
  const cursor = parseLocalDate(sortedDays[0].date);
  const end = parseLocalDate(sortedDays.at(-1)!.date);
  const years = new Map<number, CalendarYear>();

  while (cursor <= end) {
    const date = toLocalDateKey(cursor);
    const year = cursor.getFullYear();
    const existingYear =
      years.get(year) ??
      ({
        year,
        leadingBlanks: cursor.getDay(),
        days: [],
      } satisfies CalendarYear);

    existingYear.days.push(
      totalsByDate.get(date) ?? {
        date,
        streams: 0,
        msPlayed: 0,
      }
    );
    years.set(year, existingYear);
    cursor.setDate(cursor.getDate() + 1);
  }

  return [...years.values()].sort((a, b) => a.year - b.year);
}

function CalendarView({
  days,
  selectedDate,
  onSelectDate,
  streams,
}: {
  days: DailyTotal[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  streams: NormalizedStream[];
}) {
  const calendarYears = buildCalendarYears(days);
  const calendarDays = calendarYears.flatMap((year) => year.days);
  const max = Math.max(...calendarDays.map((day) => day.msPlayed), 1);
  const selected = selectedDate ? calendarDays.find((day) => day.date === selectedDate) : calendarDays.at(-1);
  const selectedStreams = selected ? streams.filter((stream) => stream.localDate === selected.date && !stream.hiddenFromStats) : [];
  const selectedTracks = topTracks(selectedStreams).slice(0, 5);

  return (
    <section className="calendarLayout">
      <div className="deepPanel calendarPanel">
        <div className="deepHeader">
          <div>
            <span className="microLabel">Calendar</span>
            <h2>Listening heatmap</h2>
            <p>Every square is one local day. Red means heavier listening; pale squares are quiet days.</p>
          </div>
          <CalendarDays size={28} aria-hidden="true" />
        </div>
        <div className="calendarYears">
          {calendarYears.map((year) => (
            <section className="calendarYearBlock" key={year.year}>
              <h3>{year.year}</h3>
              <div className="calendarYearGrid">
                {Array.from({ length: year.leadingBlanks }, (_, index) => (
                  <span className="calendarBlank" key={`blank-${year.year}-${index}`} />
                ))}
                {year.days.map((day) => (
                  <button
                    key={day.date}
                    className={`${selected?.date === day.date ? "selected" : ""} ${
                      day.msPlayed > 0 ? "hasListening" : "noListening"
                    }`}
                    style={{ "--heat": day.msPlayed > 0 ? Math.max(day.msPlayed / max, 0.08) : 0 } as CSSProperties}
                    title={`${formatDay(day.date)} · ${formatDuration(day.msPlayed)}`}
                    onClick={() => onSelectDate(day.date)}
                    type="button"
                    aria-label={`${formatDay(day.date)}, ${formatDuration(day.msPlayed)}`}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <aside className="selectedDayPanel">
        <span className="microLabel">Selected day</span>
        <h2>{selected ? formatDay(selected.date) : "Pick a day"}</h2>
        <strong>{selected ? formatDuration(selected.msPlayed) : "0m"}</strong>
        <p>{selected ? `${selected.streams} counted streams` : "No listening selected"}</p>
        <div className="selectedTracks">
          {selectedTracks.map((track, index) => (
            <div key={track.trackUri}>
              <span>{index + 1}</span>
              <p>
                <strong>{track.trackName}</strong>
                <small>{track.artistName ?? "Unknown artist"}</small>
              </p>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function InsightsView({
  bestDays,
  platforms,
  weekdays,
  albums,
  tracks,
  artists,
}: {
  bestDays: DailyTotal[];
  platforms: CategoryTotal[];
  weekdays: CategoryTotal[];
  albums: TopAlbum[];
  tracks: TopTrack[];
  artists: TopArtist[];
}) {
  const strongestWeekday = [...weekdays].sort((a, b) => b.msPlayed - a.msPlayed)[0];
  const strongestPlatform = platforms[0];

  return (
    <section className="insightGrid">
      <InsightCard icon={<Sparkles />} label="Anchor artist" value={artists[0]?.artistName ?? "Unknown"} detail={`${formatDuration(artists[0]?.msPlayed ?? 0)} total`} />
      <InsightCard icon={<Activity />} label="Replay magnet" value={tracks[0]?.trackName ?? "Unknown"} detail={`${tracks[0]?.streams ?? 0} plays`} />
      <InsightCard icon={<CalendarDays />} label="Heaviest day" value={bestDays[0] ? formatShortDateWithYear(bestDays[0].date) : "None"} detail={formatDuration(bestDays[0]?.msPlayed ?? 0)} />
      <InsightCard icon={<Album />} label="Album world" value={albums[0]?.albumName ?? "Unknown"} detail={albums[0]?.artistName ?? "Unknown artist"} />
      <InsightCard icon={<BarChart3 />} label="Strongest weekday" value={strongestWeekday?.label ?? "None"} detail={formatDuration(strongestWeekday?.msPlayed ?? 0)} />
      <InsightCard icon={<Disc3 />} label="Main platform" value={strongestPlatform?.label ?? "None"} detail={formatDuration(strongestPlatform?.msPlayed ?? 0)} />
    </section>
  );
}

function InsightCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="insightCard">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function EmptyStart() {
  return (
    <section className="emptyStart">
      <div>
        <BarChart3 size={22} aria-hidden="true" />
        <h2>Import first, sync later</h2>
      </div>
      <p>
        Drop the Spotify Extended Streaming History ZIP. The app will build rankings, calendars, timelines, platform
        breakdowns, and day-by-day listening panels from local normalized data.
      </p>
      <div className="emptyFeatures">
        <span>
          <ListMusic size={16} aria-hidden="true" />
          Timeline
        </span>
        <span>
          <CalendarDays size={16} aria-hidden="true" />
          Heatmap
        </span>
        <span>
          <Sparkles size={16} aria-hidden="true" />
          Insights
        </span>
      </div>
    </section>
  );
}
