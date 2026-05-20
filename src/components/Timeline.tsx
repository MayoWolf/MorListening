import { Clock3, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDay, formatDuration, formatExactDuration, formatTime } from "../lib/date";
import { groupStreamsByDate, statStreams, topArtists, topTracks } from "../lib/stats";
import type { NormalizedStream } from "../types";

type TimelineProps = {
  streams: NormalizedStream[];
};

export function Timeline({ streams }: TimelineProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return streams;
    return streams.filter((stream) =>
      [stream.trackName, stream.artistName, stream.albumName].some((value) =>
        value?.toLowerCase().includes(needle)
      )
    );
  }, [query, streams]);

  const groups = groupStreamsByDate(filtered).slice(0, 20);

  return (
    <section className="timelinePanel">
      <div className="timelineHeader">
        <div>
          <h2>Timesheet</h2>
          <p>{statStreams(filtered).length.toLocaleString()} counted streams in view</p>
        </div>
        <label className="searchBox">
          <Search size={17} aria-hidden="true" />
          <input
            placeholder="Search song, artist, album"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="emptyState">No streams match this range.</p>
      ) : (
        <div className="timelineDays">
          {groups.map((group) => {
            const dayTracks = topTracks(group.streams).slice(0, 3);
            const dayArtists = topArtists(group.streams).slice(0, 3);

            return (
              <article className="dayBlock" key={group.date}>
                <div className="dayHeader">
                  <div>
                    <h3>{formatDay(group.date)}</h3>
                    <p>{formatDuration(group.msPlayed)} listened</p>
                  </div>
                  <Clock3 size={20} aria-hidden="true" />
                </div>

                <div className="streamList">
                  {group.streams.slice(0, 18).map((stream) => (
                    <div className={`streamRow ${stream.hiddenFromStats ? "mutedStream" : ""}`} key={stream.id}>
                      <time>{formatTime(stream.playedAt)}</time>
                      <div>
                        <strong>{stream.trackName ?? "Unknown track"}</strong>
                        <span>{stream.artistName ?? "Unknown artist"}</span>
                      </div>
                      <small>{formatExactDuration(stream.msPlayed)}</small>
                    </div>
                  ))}
                </div>

                <div className="dayStats">
                  <MiniRanking title="Top tracks" rows={dayTracks.map((track) => `${track.trackName} · ${track.streams} plays`)} />
                  <MiniRanking
                    title="Top artists"
                    rows={dayArtists.map((artist) => `${artist.artistName} · ${artist.streams} plays`)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MiniRanking({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div>
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p>No counted plays</p>
      ) : (
        <ol>
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
