export type SpotifyExtendedStream = {
  ts: string;
  username?: string;
  platform?: string;
  ms_played: number;
  conn_country?: string;
  ip_addr_decrypted?: string;
  user_agent_decrypted?: string;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
  spotify_track_uri?: string | null;
  episode_name?: string | null;
  episode_show_name?: string | null;
  spotify_episode_uri?: string | null;
  audiobook_title?: string | null;
  audiobook_uri?: string | null;
  audiobook_chapter_uri?: string | null;
  audiobook_chapter_title?: string | null;
  reason_start?: string | null;
  reason_end?: string | null;
  shuffle?: boolean;
  skipped?: boolean | null;
  offline?: boolean;
  offline_timestamp?: number | null;
  incognito_mode?: boolean;
};

export type NormalizedStream = {
  id: string;
  playedAt: string;
  localDate: string;
  trackUri: string | null;
  trackName: string | null;
  artistName: string | null;
  albumName: string | null;
  msPlayed: number;
  platform: string | null;
  country: string | null;
  reasonStart: string | null;
  reasonEnd: string | null;
  shuffle: boolean | null;
  skipped: boolean | null;
  offline: boolean | null;
  incognitoMode: boolean | null;
  hiddenFromStats: boolean;
  source: "import" | "sync";
};

export type ImportSummary = {
  filesRead: number;
  rawRows: number;
  importedRows: number;
  duplicateRows: number;
  hiddenRows: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
};

export type TopTrack = {
  trackUri: string;
  trackName: string;
  artistName: string | null;
  streams: number;
  msPlayed: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
};

export type TopArtist = {
  artistName: string;
  streams: number;
  msPlayed: number;
  uniqueTracks: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
};

export type DailyTotal = {
  date: string;
  streams: number;
  msPlayed: number;
};
