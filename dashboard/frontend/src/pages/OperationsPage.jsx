export function OperationsPage({ snapshot }) {
  const operations = snapshot.operations || {};
  const recommendation = operations.pumpRecommendation || {};
  const pumps = operations.pumpStatus || [];
  const activity = operations.activityLog || [];
  const maintenance = operations.maintenance || [];

  return (
    <section className="page-grid">
      <header className="page-header single-column">
        <div>
          <p className="eyebrow">Operations Control</p>
          <h1>Pump and Emptying Decisions</h1>
          <p className="lead-text">
            Rule-based execution layer capped at two pumps, informed by forecast level and urgency.
          </p>
        </div>
      </header>

      <section className="panel two-col-span">
        <div className="panel-header">
          <h2>Decision Summary</h2>
          <p>Action envelope generated for the next predicted risk horizon.</p>
        </div>
        <div className="decision-strip">
          <article>
            <p className="label">Severity</p>
            <p className={`severity-chip chip-${recommendation.severity || 'normal'}`}>
              {(recommendation.severity || 'normal').toUpperCase()}
            </p>
          </article>
          <article>
            <p className="label">Recommended Pumps</p>
            <p className="big-number">{recommendation.recommendedPumps || 0} / 2</p>
          </article>
          <article>
            <p className="label">Predicted Max Level</p>
            <p className="big-number">{Number(recommendation.maxPredictedLevel || 0).toFixed(1)}%</p>
          </article>
          <article>
            <p className="label">Hours to High Threshold</p>
            <p className="big-number">{Number(recommendation.hoursToHighThreshold || 0)}h</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Pump Status</h2>
          <p>Current state and expected load for each pump.</p>
        </div>
        <div className="pump-grid">
          {pumps.map((pump) => (
            <article key={pump.name} className="pump-card">
              <p className="pump-title">{pump.name}</p>
              <p className={`pump-state state-${pump.state}`}>{pump.state}</p>
              <p className="pump-metric">Flow: {pump.flowRateLps} L/s</p>
              <p className="pump-metric">Load: {pump.loadPercent}%</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Maintenance Calendar</h2>
          <p>Operational checks surfaced from current scenario.</p>
        </div>
        <ul className="notes-list compact">
          {maintenance.map((item) => (
            <li key={`${item.title}-${item.window}`}>
              <span>{item.title}</span>
              <span>{item.window}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel two-col-span">
        <div className="panel-header">
          <h2>Activity Log</h2>
          <p>Recent dynamic level changes detected by the model context.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((row) => (
                <tr key={`${row.timestamp}-${row.status}`}>
                  <td>{row.timestamp}</td>
                  <td>{row.status}</td>
                  <td>{row.change}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
