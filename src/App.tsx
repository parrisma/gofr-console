import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import ServiceShell from './components/layout/ServiceShell';
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary';
import Dashboard from './pages/Dashboard';
import Operations from './pages/Operations';
import GofrIQ from './pages/GofrIQ';
import GofrIQSources from './pages/GofrIQSources';
import GofrIQClients from './pages/GofrIQClients';
import GofrIQIngest from './pages/GofrIQIngest';
import GofrIQHealthCheck from './pages/GofrIQHealthCheck';
import Client360View from './pages/Client360View';
import GofrDig from './pages/GofrDig';
import GofrDigHealthCheck from './pages/GofrDigHealthCheck';
import GofrDigSessions from './pages/GofrDigSessions';
import { MonitorHeart, Search, Storage } from '@mui/icons-material';
import { logger } from './services/logging';

function RouteChangeLogger() {
  const location = useLocation();

  useEffect(() => {
    logger.info({
      event: 'ui_route_change',
      message: `Route changed to ${location.pathname}`,
      component: 'App',
      operation: 'route_change',
      result: 'success',
      data: {
        path: location.pathname,
      },
    });
  }, [location.pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <RouteChangeLogger />
      <GlobalErrorBoundary>
      <Routes>
        <Route path="/" element={<AppShell><Dashboard /></AppShell>} />
        <Route path="/operations" element={<AppShell><Operations /></AppShell>} />
        <Route path="/gofr-iq/health" element={
          <ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQ />
          </ServiceShell>
        } />
        <Route path="/gofr-iq/health-check" element={
          <ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQHealthCheck />
          </ServiceShell>
        } />
        <Route path="/gofr-iq/sources" element={
          <ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQSources />
          </ServiceShell>
        } />
        <Route path="/gofr-iq/clients" element={
          <ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQClients />
          </ServiceShell>
        } />
        <Route path="/gofr-iq/client-360" element={
          <ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <Client360View />
          </ServiceShell>
        } />
        <Route path="/gofr-iq/ingest" element={
          <ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQIngest />
          </ServiceShell>
        } />
        <Route path="/gofr-dig" element={
          <ServiceShell
            serviceName="GOFR-DIG"
            serviceRoute="/gofr-dig"
            navItems={[
              { path: '/gofr-dig/health', icon: <MonitorHeart />, label: 'Health' },
              { path: '/gofr-dig', icon: <Search />, label: 'Scraper' },
              { path: '/gofr-dig/sessions', icon: <Storage />, label: 'Sessions' },
            ]}
          >
            <GofrDig />
          </ServiceShell>
        } />
        <Route path="/gofr-dig/health" element={
          <ServiceShell
            serviceName="GOFR-DIG"
            serviceRoute="/gofr-dig"
            navItems={[
              { path: '/gofr-dig/health', icon: <MonitorHeart />, label: 'Health' },
              { path: '/gofr-dig', icon: <Search />, label: 'Scraper' },
              { path: '/gofr-dig/sessions', icon: <Storage />, label: 'Sessions' },
            ]}
          >
            <GofrDigHealthCheck />
          </ServiceShell>
        } />
        <Route path="/gofr-dig/sessions" element={
          <ServiceShell
            serviceName="GOFR-DIG"
            serviceRoute="/gofr-dig"
            navItems={[
              { path: '/gofr-dig/health', icon: <MonitorHeart />, label: 'Health' },
              { path: '/gofr-dig', icon: <Search />, label: 'Scraper' },
              { path: '/gofr-dig/sessions', icon: <Storage />, label: 'Sessions' },
            ]}
          >
            <GofrDigSessions />
          </ServiceShell>
        } />
      </Routes>
      </GlobalErrorBoundary>
    </BrowserRouter>
  );
}

export default App
