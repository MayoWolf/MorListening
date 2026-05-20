type StatCardProps = {
  label: string;
  value: string;
  detail?: string;
};

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article className="statCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}
