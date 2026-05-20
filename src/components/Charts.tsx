import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyTotal, TopArtist, TopTrack } from "../types";
import { formatDuration, formatShortDate } from "../lib/date";
import type { CategoryTotal } from "../lib/stats";

type DailyChartProps = {
  data: DailyTotal[];
};

type RankingChartProps = {
  tracks: TopTrack[];
  artists: TopArtist[];
};

type CategoryBarChartProps = {
  title: string;
  caption: string;
  data: CategoryTotal[];
};

export function DailyChart({ data }: DailyChartProps) {
  const chartData = data.slice(-45).map((day) => ({
    date: formatShortDate(day.date),
    minutes: Math.round(day.msPlayed / 60_000),
  }));

  return (
    <div className="chartPanel">
      <div className="panelHeader">
        <h2>Listening over time</h2>
        <span>{chartData.length} days</span>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={18} />
          <YAxis tickLine={false} axisLine={false} width={44} />
          <Tooltip formatter={(value) => [`${value}m`, "Listening"]} cursor={{ fill: "rgba(220, 38, 38, 0.08)" }} />
          <Bar dataKey="minutes" fill="#dc2626" radius={[10, 10, 10, 10]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type CategoryTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{
    payload?: {
      avgMinutes: number;
      totalMinutes: number;
      days?: number;
    };
  }>;
};

function CategoryTooltip({ active, label, payload }: CategoryTooltipProps) {
  if (!active || !payload?.[0]?.payload) return null;

  const point = payload[0].payload;
  return (
    <div className="chartTooltip">
      <strong>{label}</strong>
      <span>Avg: {point.avgMinutes.toLocaleString()}m / day</span>
      <span>Total: {point.totalMinutes.toLocaleString()}m</span>
      {point.days ? <span>{point.days} days in range</span> : null}
    </div>
  );
}

export function CategoryBarChart({ title, caption, data }: CategoryBarChartProps) {
  const chartData = data.map((item) => ({
    label: item.label,
    avgMinutes: Math.round(item.msPlayed / 60_000),
    totalMinutes: Math.round((item.totalMs ?? item.msPlayed) / 60_000),
    days: item.days,
  }));

  return (
    <div className="chartPanel fullChartPanel">
      <div className="panelHeader">
        <h2>{title}</h2>
        <span>{caption}</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<CategoryTooltip />} cursor={{ fill: "rgba(220, 38, 38, 0.08)" }} />
          <Bar dataKey="avgMinutes" fill="#dc2626" radius={[10, 10, 10, 10]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RankingCharts({ tracks, artists }: RankingChartProps) {
  return (
    <div className="rankGrid">
      <RankingList
        title="Top tracks"
        rows={tracks.slice(0, 8).map((track) => ({
          id: track.trackUri,
          name: track.trackName,
          detail: track.artistName ?? "Unknown artist",
          value: `${track.streams} plays`,
          msPlayed: track.msPlayed,
        }))}
      />
      <RankingList
        title="Top artists"
        rows={artists.slice(0, 8).map((artist) => ({
          id: artist.artistName,
          name: artist.artistName,
          detail: `${artist.uniqueTracks} tracks`,
          value: `${artist.streams} plays`,
          msPlayed: artist.msPlayed,
        }))}
      />
    </div>
  );
}

function RankingList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; name: string; detail: string; value: string; msPlayed: number }>;
}) {
  const max = Math.max(...rows.map((row) => row.msPlayed), 1);

  return (
    <section className="rankingPanel">
      <div className="panelHeader">
        <h2>{title}</h2>
        <span>By minutes</span>
      </div>
      <div className="rankingRows">
        {rows.length === 0 ? (
          <p className="emptyState">No stat-counting streams in this range.</p>
        ) : (
          rows.map((row, index) => (
            <article className="rankingRow" key={row.id}>
              <span className="rankNumber">{index + 1}</span>
              <div className="rankingText">
                <strong>{row.name}</strong>
                <small>
                  {row.detail} · {formatDuration(row.msPlayed)}
                </small>
              </div>
              <span className="rankingValue">{row.value}</span>
              <div className="rankingBar" aria-hidden="true">
                <span style={{ width: `${Math.max((row.msPlayed / max) * 100, 3)}%` }} />
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
