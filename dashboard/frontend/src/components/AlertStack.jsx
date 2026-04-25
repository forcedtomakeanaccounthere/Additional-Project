export function AlertStack({ alerts = [] }) {
  if (alerts.length === 0) {
    return (
      <div className="alert-card alert-info">
        <p className="alert-title">System Calm</p>
        <p className="alert-message">No active risk notifications at this moment.</p>
      </div>
    );
  }

  return (
    <div className="alert-stack">
      {alerts.map((item, index) => (
        <article key={`${item.title}-${index}`} className={`alert-card alert-${item.level || 'info'}`}>
          <p className="alert-title">{item.title}</p>
          <p className="alert-message">{item.message}</p>
          {item.action ? <p className="alert-action">Action: {item.action}</p> : null}
        </article>
      ))}
    </div>
  );
}
