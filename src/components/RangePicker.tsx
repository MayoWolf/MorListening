import type { RangeKey } from "../lib/stats";

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: "all", label: "Lifetime" },
  { key: "year", label: "This year" },
  { key: "6m", label: "6 months" },
  { key: "4w", label: "4 weeks" },
  { key: "7d", label: "7 days" },
  { key: "today", label: "Today" },
];

type RangePickerProps = {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
};

export function RangePicker({ value, onChange }: RangePickerProps) {
  return (
    <div className="segmentedControl" aria-label="Time range">
      {ranges.map((range) => (
        <button
          key={range.key}
          className={range.key === value ? "active" : ""}
          onClick={() => onChange(range.key)}
          type="button"
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
