import { AlertStack } from '../components/AlertStack';

export function AlertsPage({ snapshot }) {
  const alerts = snapshot.alerts || [];
  const notifications = snapshot.notifications || [];
  const logs = snapshot.systemLogs || [];

  return (
    <section className="page-grid">
      <header className="page-header single-column">
        <div>
          <p className="eyebrow">Risk and Notification Hub</p>
          <h1>Alerts and Escalation Feed</h1>
          <p className="lead-text">
            Consolidated warnings for overflow, low-level events, rainfall spikes, and forecast service status.
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Active Alerts</h2>
          <p>Actionable messages generated from the current forecast context.</p>
        </div>
        <AlertStack alerts={alerts} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Notification Queue</h2>
          <p>Latest advisory feed intended for operator attention.</p>
        </div>
        <ul className="notification-list">
          {notifications.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <p>{item.title}</p>
              <span>{item.message}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel two-col-span">
        <div className="panel-header">
          <h2>System Logs</h2>
          <p>Backend and inference timeline markers.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((item, index) => (
                <tr key={`${item.time}-${index}`}>
                  <td>{item.time}</td>
                  <td>{item.event}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
