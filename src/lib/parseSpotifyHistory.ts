import JSZip from "jszip";
import { formatInTimeZone } from "date-fns-tz";
import type { ImportSummary, NormalizedStream, SpotifyExtendedStream } from "../types";

const STREAMING_HISTORY_FILE = /Streaming[_ ]History[_ ]Audio.*\.json$/i;

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSpotifyStreamRow(value: unknown): value is SpotifyExtendedStream {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SpotifyExtendedStream;
  return typeof candidate.ts === "string" && typeof candidate.ms_played === "number";
}

async function normalizeStream(
  raw: SpotifyExtendedStream,
  userTimeZone: string,
  source: "import" | "sync" = "import"
): Promise<NormalizedStream> {
  const trackUri = raw.spotify_track_uri ?? null;
  const playedAt = raw.ts;
  const localDate = formatInTimeZone(new Date(raw.ts), userTimeZone, "yyyy-MM-dd");
  const hiddenFromStats =
    raw.ms_played < 30_000 ||
    raw.skipped === true ||
    !trackUri ||
    Boolean(raw.episode_name) ||
    Boolean(raw.spotify_episode_uri) ||
    Boolean(raw.audiobook_uri) ||
    Boolean(raw.audiobook_chapter_uri);

  const id = await sha256(
    [
      playedAt,
      trackUri ?? "local-or-missing-track",
      raw.ms_played,
      raw.reason_start ?? "",
      raw.reason_end ?? "",
      raw.master_metadata_track_name ?? "",
      raw.master_metadata_album_artist_name ?? "",
    ].join(":")
  );

  return {
    id,
    playedAt,
    localDate,
    trackUri,
    trackName: raw.master_metadata_track_name ?? null,
    artistName: raw.master_metadata_album_artist_name ?? null,
    albumName: raw.master_metadata_album_album_name ?? null,
    msPlayed: raw.ms_played,
    platform: raw.platform ?? null,
    country: raw.conn_country ?? null,
    reasonStart: raw.reason_start ?? null,
    reasonEnd: raw.reason_end ?? null,
    shuffle: raw.shuffle ?? null,
    skipped: raw.skipped ?? null,
    offline: raw.offline ?? null,
    incognitoMode: raw.incognito_mode ?? null,
    hiddenFromStats,
    source,
  };
}

async function readJsonFile(file: File): Promise<SpotifyExtendedStream[]> {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`${file.name} is not a Spotify streaming-history array.`);
  }
  return parsed.filter(isSpotifyStreamRow);
}

async function readZipFile(file: File): Promise<Array<{ name: string; rows: SpotifyExtendedStream[] }>> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && STREAMING_HISTORY_FILE.test(entry.name.split("/").pop() ?? entry.name)
  );

  if (entries.length === 0) {
    throw new Error(`${file.name} did not contain Streaming_History_Audio JSON files.`);
  }

  const results = await Promise.all(
    entries.map(async (entry) => {
      const text = await entry.async("text");
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(`${entry.name} is not a Spotify streaming-history array.`);
      }
      return {
        name: entry.name,
        rows: parsed.filter(isSpotifyStreamRow),
      };
    })
  );

  return results;
}

export async function parseSpotifyHistoryFiles(
  files: File[],
  userTimeZone: string
): Promise<{ streams: NormalizedStream[]; summary: ImportSummary }> {
  const rawFileRows: Array<{ name: string; rows: SpotifyExtendedStream[] }> = [];

  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      rawFileRows.push(...(await readZipFile(file)));
    } else if (file.name.toLowerCase().endsWith(".json")) {
      rawFileRows.push({ name: file.name, rows: await readJsonFile(file) });
    }
  }

  const rawRows = rawFileRows.flatMap((fileRows) => fileRows.rows);
  const normalized = await Promise.all(rawRows.map((row) => normalizeStream(row, userTimeZone)));
  const byId = new Map<string, NormalizedStream>();

  for (const stream of normalized) {
    byId.set(stream.id, stream);
  }

  const streams = [...byId.values()].sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const hiddenRows = streams.filter((stream) => stream.hiddenFromStats).length;

  return {
    streams,
    summary: {
      filesRead: rawFileRows.length,
      rawRows: rawRows.length,
      importedRows: streams.length,
      duplicateRows: normalized.length - streams.length,
      hiddenRows,
      firstPlayedAt: streams[0]?.playedAt ?? null,
      lastPlayedAt: streams.at(-1)?.playedAt ?? null,
    },
  };
}
