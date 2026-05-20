import type { DailyTotal, NormalizedStream, TopArtist, TopTrack } from "../types";

export type RangeKey = "all" | "today" | "7d" | "4w" | "6m" | "year";

export type TopAlbum = {
  albumName: string;
  artistName: string | null;
  streams: number;
  msPlayed: number;
  uniqueTracks: number;
};

export type CategoryTotal = {
  label: string;
  streams: number;
  msPlayed: number;
  totalMs?: number;
  days?: number;
  details?: CategoryBreakdown[];
};

export type CategoryBreakdown = {
  label: string;
  streams: number;
  msPlayed: number;
  percent: number;
};

export function statStreams(streams: NormalizedStream[]): NormalizedStream[] {
  return streams.filter((stream) => !stream.hiddenFromStats);
}

export function filterByRange(
  streams: NormalizedStream[],
  range: RangeKey,
  now = new Date()
): NormalizedStream[] {
  if (range === "all") return streams;

  const end = now.getTime();
  const start = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  }

  if (range === "7d") {
    start.setDate(start.getDate() - 7);
  }

  if (range === "4w") {
    start.setDate(start.getDate() - 28);
  }

  if (range === "6m") {
    start.setMonth(start.getMonth() - 6);
  }

  if (range === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  }

  const startMs = start.getTime();
  return streams.filter((stream) => {
    const playedAt = new Date(stream.playedAt).getTime();
    return playedAt >= startMs && playedAt <= end;
  });
}

export function topTracks(streams: NormalizedStream[]): TopTrack[] {
  const map = new Map<string, TopTrack>();

  for (const stream of statStreams(streams)) {
    if (!stream.trackUri) continue;
    const existing = map.get(stream.trackUri) ?? {
      trackUri: stream.trackUri,
      trackName: stream.trackName ?? "Unknown track",
      artistName: stream.artistName,
      streams: 0,
      msPlayed: 0,
      firstPlayedAt: stream.playedAt,
      lastPlayedAt: stream.playedAt,
    };

    existing.streams += 1;
    existing.msPlayed += stream.msPlayed;
    existing.firstPlayedAt =
      stream.playedAt < existing.firstPlayedAt ? stream.playedAt : existing.firstPlayedAt;
    existing.lastPlayedAt =
      stream.playedAt > existing.lastPlayedAt ? stream.playedAt : existing.lastPlayedAt;
    map.set(stream.trackUri, existing);
  }

  return [...map.values()].sort((a, b) => b.msPlayed - a.msPlayed);
}

export function topArtists(streams: NormalizedStream[]): TopArtist[] {
  const map = new Map<
    string,
    Omit<TopArtist, "uniqueTracks"> & {
      uniqueTracks: Set<string>;
    }
  >();

  for (const stream of statStreams(streams)) {
    if (!stream.artistName) continue;
    const existing = map.get(stream.artistName) ?? {
      artistName: stream.artistName,
      streams: 0,
      msPlayed: 0,
      uniqueTracks: new Set<string>(),
      firstPlayedAt: stream.playedAt,
      lastPlayedAt: stream.playedAt,
    };

    existing.streams += 1;
    existing.msPlayed += stream.msPlayed;
    if (stream.trackUri) existing.uniqueTracks.add(stream.trackUri);
    existing.firstPlayedAt =
      stream.playedAt < existing.firstPlayedAt ? stream.playedAt : existing.firstPlayedAt;
    existing.lastPlayedAt =
      stream.playedAt > existing.lastPlayedAt ? stream.playedAt : existing.lastPlayedAt;
    map.set(stream.artistName, existing);
  }

  return [...map.values()]
    .map((artist) => ({
      ...artist,
      uniqueTracks: artist.uniqueTracks.size,
    }))
    .sort((a, b) => b.msPlayed - a.msPlayed);
}

export function dailyTotals(streams: NormalizedStream[]): DailyTotal[] {
  const map = new Map<string, DailyTotal>();

  for (const stream of statStreams(streams)) {
    const existing = map.get(stream.localDate) ?? {
      date: stream.localDate,
      streams: 0,
      msPlayed: 0,
    };
    existing.streams += 1;
    existing.msPlayed += stream.msPlayed;
    map.set(stream.localDate, existing);
  }

  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export function hourlyTotals(streams: NormalizedStream[]): Array<{ hour: string; msPlayed: number }> {
  const totals = Array.from({ length: 24 }, (_, hour) => ({
    hour: formatHourLabel(hour),
    msPlayed: 0,
  }));

  for (const stream of statStreams(streams)) {
    const hour = new Date(stream.playedAt).getHours();
    totals[hour].msPlayed += stream.msPlayed;
  }

  return totals;
}

export function topAlbums(streams: NormalizedStream[]): TopAlbum[] {
  const map = new Map<
    string,
    Omit<TopAlbum, "uniqueTracks"> & {
      uniqueTracks: Set<string>;
    }
  >();

  for (const stream of statStreams(streams)) {
    if (!stream.albumName) continue;
    const key = `${stream.albumName}:${stream.artistName ?? "unknown"}`;
    const existing = map.get(key) ?? {
      albumName: stream.albumName,
      artistName: stream.artistName,
      streams: 0,
      msPlayed: 0,
      uniqueTracks: new Set<string>(),
    };

    existing.streams += 1;
    existing.msPlayed += stream.msPlayed;
    if (stream.trackUri) existing.uniqueTracks.add(stream.trackUri);
    map.set(key, existing);
  }

  return [...map.values()]
    .map((album) => ({
      ...album,
      uniqueTracks: album.uniqueTracks.size,
    }))
    .sort((a, b) => b.msPlayed - a.msPlayed);
}

export function weekdayTotals(streams: NormalizedStream[]): CategoryTotal[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const totals = labels.map((label) => ({
    streams: 0,
    msPlayed: 0,
    label,
  }));
  const countedStreams = statStreams(streams);

  for (const stream of countedStreams) {
    const day = new Date(stream.playedAt).getDay();
    totals[day].streams += 1;
    totals[day].msPlayed += stream.msPlayed;
  }

  if (countedStreams.length === 0) return totals;

  const sortedDates = countedStreams.map((stream) => stream.localDate).sort();
  const start = new Date(`${sortedDates[0]}T12:00:00`);
  const end = new Date(`${sortedDates.at(-1)}T12:00:00`);
  const daysByWeekday = Array.from({ length: 7 }, () => 0);

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    daysByWeekday[cursor.getDay()] += 1;
  }

  return totals.map((total, index) => ({
    ...total,
    totalMs: total.msPlayed,
    days: daysByWeekday[index],
    msPlayed: daysByWeekday[index] > 0 ? total.msPlayed / daysByWeekday[index] : 0,
  }));
}

function cleanPlatform(platform: string | null | undefined): string {
  return (platform ?? "Unknown").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function formatPlatformLabel(platform: string | null | undefined): string {
  if (!platform) return "Other";

  const cleaned = cleanPlatform(platform).toLowerCase();

  const knownLabels: Record<string, string> = {
    android: "Android",
    ios: "iOS",
    iphone: "iPhone",
    ipad: "iPad",
    mac: "Mac",
    macos: "macOS",
    osx: "macOS",
    windows: "Windows",
    linux: "Linux",
    web: "Web",
    webplayer: "Web Player",
    "web player": "Web Player",
    playstation: "PlayStation",
    ps4: "PlayStation 4",
    ps5: "PlayStation 5",
    xbox: "Xbox",
    sonos: "Sonos",
    chromecast: "Chromecast",
    unknown: "Other",
  };

  if (knownLabels[cleaned]) return knownLabels[cleaned];

  if (cleaned.includes("android")) return "Android";
  if (cleaned.includes("windows")) return "Windows";
  if (cleaned.includes("iphone") || cleaned.includes("ipad") || cleaned.includes("ios")) return "iOS";
  if (cleaned.includes("playstation") || cleaned.includes("ps4") || cleaned.includes("ps5")) return "PlayStation";
  if (cleaned.includes("scei") || cleaned.includes("sony")) return "PlayStation";
  if (cleaned.includes("xbox")) return "Xbox";
  if (cleaned.includes("mac os") || cleaned.includes("macos") || cleaned.includes("osx")) return "macOS";
  if (cleaned.includes("linux")) return "Linux";
  if (cleaned.includes("web")) return "Web";
  if (cleaned.includes("chromecast")) return "Chromecast";
  if (cleaned.includes("sonos")) return "Sonos";

  return "Other";
}

export function platformTotals(streams: NormalizedStream[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  const rawMaps = new Map<string, Map<string, CategoryBreakdown>>();

  for (const stream of statStreams(streams)) {
    const label = formatPlatformLabel(stream.platform);
    const existing = map.get(label) ?? { label, streams: 0, msPlayed: 0 };
    existing.streams += 1;
    existing.msPlayed += stream.msPlayed;
    map.set(label, existing);

    const rawLabel = cleanPlatform(stream.platform);
    const rawMap = rawMaps.get(label) ?? new Map<string, CategoryBreakdown>();
    const rawExisting = rawMap.get(rawLabel) ?? {
      label: rawLabel,
      streams: 0,
      msPlayed: 0,
      percent: 0,
    };
    rawExisting.streams += 1;
    rawExisting.msPlayed += stream.msPlayed;
    rawMap.set(rawLabel, rawExisting);
    rawMaps.set(label, rawMap);
  }

  return [...map.values()]
    .map((total) => {
      const details = [...(rawMaps.get(total.label)?.values() ?? [])]
        .map((detail) => ({
          ...detail,
          percent: total.msPlayed > 0 ? detail.msPlayed / total.msPlayed : 0,
        }))
        .sort((a, b) => b.msPlayed - a.msPlayed);

      return {
        ...total,
        details: details.length > 1 || total.label === "Other" ? details : undefined,
      };
    })
    .sort((a, b) => b.msPlayed - a.msPlayed);
}

export function bestDays(streams: NormalizedStream[], limit = 6): DailyTotal[] {
  return [...dailyTotals(streams)].sort((a, b) => b.msPlayed - a.msPlayed).slice(0, limit);
}

export function calendarDays(streams: NormalizedStream[]): DailyTotal[] {
  return dailyTotals(streams);
}

export function currentListeningStreak(days: DailyTotal[], now = new Date()): number {
  const daySet = new Set(days.filter((day) => day.msPlayed > 0).map((day) => day.date));
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  let streak = 0;

  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function skipRate(streams: NormalizedStream[]): number {
  if (streams.length === 0) return 0;
  return streams.filter((stream) => stream.skipped === true).length / streams.length;
}

export function groupStreamsByDate(streams: NormalizedStream[]): Array<{
  date: string;
  streams: NormalizedStream[];
  msPlayed: number;
}> {
  const map = new Map<string, NormalizedStream[]>();

  for (const stream of [...streams].sort((a, b) => b.playedAt.localeCompare(a.playedAt))) {
    const existing = map.get(stream.localDate) ?? [];
    existing.push(stream);
    map.set(stream.localDate, existing);
  }

  return [...map.entries()]
    .map(([date, dayStreams]) => ({
      date,
      streams: dayStreams,
      msPlayed: statStreams(dayStreams).reduce((sum, stream) => sum + stream.msPlayed, 0),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
