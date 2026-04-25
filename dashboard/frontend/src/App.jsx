import { Navigate, Route, Routes } from 'react-router-dom';

import { ShellLayout } from './components/ShellLayout';
import { useSnapshot } from './hooks/useSnapshot';
import { AlertsPage } from './pages/AlertsPage';
import { EnvironmentPage } from './pages/EnvironmentPage';
import { OperationsPage } from './pages/OperationsPage';
import { OverviewPage } from './pages/OverviewPage';
import { WeatherConditionsPage } from './pages/WeatherConditionsPage';
import './App.css';

function App() {
  const {
    snapshot,
    summary,
    horizon,
    loading,
    refreshing,
    error,
    setHorizon,
    loadSnapshot,
  } = useSnapshot(24);

  return (
    <ShellLayout
      generatedAt={snapshot.generatedAt}
      onRefresh={() => loadSnapshot(horizon, true)}
      refreshing={refreshing}
    >
      {error ? <p className="banner banner-error">{error}</p> : null}
      {loading ? <p className="banner">Loading live dashboard snapshot...</p> : null}

      {!loading ? (
        <Routes>
          <Route
            path="/"
            element={
              <OverviewPage
                snapshot={snapshot}
                summary={summary}
                horizon={horizon}
                setHorizon={setHorizon}
                onLoad={loadSnapshot}
              />
            }
          />
          <Route path="/weather-conditions" element={<WeatherConditionsPage />} />
          <Route path="/environment" element={<EnvironmentPage snapshot={snapshot} />} />
          <Route path="/operations" element={<OperationsPage snapshot={snapshot} />} />
          <Route path="/alerts" element={<AlertsPage snapshot={snapshot} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : null}
    </ShellLayout>
  );
}

export default App;
