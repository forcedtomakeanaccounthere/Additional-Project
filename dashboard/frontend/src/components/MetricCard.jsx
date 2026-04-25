export function MetricCard({ label, value, hint, status = 'normal' }) {
  return (
    <article className={`metric-card metric-${status}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-hint">{hint}</p>
    </article>
  );
}
