import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import ServiceShell from './components/layout/ServiceShell';
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary';
import RequireAuth from './components/common/RequireAuth';
import Login from './pages/Login';
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
import GofrDocHealthCheck from './pages/GofrDocHealthCheck';
import GofrDocDiscovery from './pages/GofrDocDiscovery';
import GofrDocSessions from './pages/GofrDocSessions';
import GofrDocBuilder from './pages/GofrDocBuilder';
import GofrDocRenderProxy from './pages/GofrDocRenderProxy';
import GofrPlotHealthCheck from './pages/GofrPlotHealthCheck';
import GofrPlotDiscovery from './pages/GofrPlotDiscovery';
import GofrPlotSessions from './pages/GofrPlotSessions';
import GofrPlotBuilder from './pages/GofrPlotBuilder';
import GofrNpHealthCheck from './pages/GofrNpHealthCheck';
import GofrNpTools from './pages/GofrNpTools';
import { MonitorHeart, Search, Storage, Build, Description } from '@mui/icons-material';
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
  const gofrDigNavItems = [
    { path: '/gofr-dig/health', icon: <MonitorHeart />, label: 'Health' },
    { path: '/gofr-dig', icon: <Search />, label: 'Scraper' },
    { path: '/gofr-dig/sessions', icon: <Storage />, label: 'Sessions' },
  ];

  const gofrDocNavItems = [
    { path: '/gofr-doc/health', icon: <MonitorHeart />, label: 'Health' },
    { path: '/gofr-doc/discovery', icon: <Search />, label: 'Discovery' },
    { path: '/gofr-doc/sessions', icon: <Storage />, label: 'Sessions' },
    { path: '/gofr-doc/builder', icon: <Build />, label: 'Builder' },
    { path: '/gofr-doc/render', icon: <Description />, label: 'Render' },
  ];

  const gofrPlotNavItems = [
    { path: '/gofr-plot/health', icon: <MonitorHeart />, label: 'Health' },
    { path: '/gofr-plot/discovery', icon: <Search />, label: 'Discovery' },
    { path: '/gofr-plot/sessions', icon: <Storage />, label: 'Sessions' },
    { path: '/gofr-plot/builder', icon: <Build />, label: 'Builder' },
  ];

  const gofrNpNavItems = [
    { path: '/gofr-np/health', icon: <MonitorHeart />, label: 'Health' },
    { path: '/gofr-np/tools', icon: <Build />, label: 'Tools' },
  ];

  return (
    <BrowserRouter>
      <RouteChangeLogger />
      <GlobalErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><AppShell><Dashboard /></AppShell></RequireAuth>} />
          <Route path="/operations" element={<RequireAuth><AppShell><Operations /></AppShell></RequireAuth>} />
        <Route path="/gofr-iq/health" element={
          <RequireAuth><ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQ />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-iq/health-check" element={
          <RequireAuth><ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQHealthCheck />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-iq/sources" element={
          <RequireAuth><ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQSources />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-iq/clients" element={
          <RequireAuth><ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQClients />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-iq/client-360" element={
          <RequireAuth><ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <Client360View />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-iq/ingest" element={
          <RequireAuth><ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQIngest />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-dig" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-DIG"
            serviceRoute="/gofr-dig"
            navItems={gofrDigNavItems}
          >
            <GofrDig />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-dig/health" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-DIG"
            serviceRoute="/gofr-dig"
            navItems={gofrDigNavItems}
          >
            <GofrDigHealthCheck />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-dig/sessions" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-DIG"
            serviceRoute="/gofr-dig"
            navItems={gofrDigNavItems}
          >
            <GofrDigSessions />
          </ServiceShell></RequireAuth>
        } />

        <Route path="/gofr-doc" element={<Navigate to="/gofr-doc/sessions" replace />} />
        <Route path="/gofr-doc/health" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-DOC"
            serviceRoute="/gofr-doc"
            navItems={gofrDocNavItems}
          >
            <GofrDocHealthCheck />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-doc/discovery" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-DOC"
            serviceRoute="/gofr-doc"
            navItems={gofrDocNavItems}
          >
            <GofrDocDiscovery />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-doc/sessions" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-DOC"
            serviceRoute="/gofr-doc"
            navItems={gofrDocNavItems}
          >
            <GofrDocSessions />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-doc/builder" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-DOC"
            serviceRoute="/gofr-doc"
            navItems={gofrDocNavItems}
          >
            <GofrDocBuilder />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-doc/render" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-DOC"
            serviceRoute="/gofr-doc"
            navItems={gofrDocNavItems}
          >
            <GofrDocRenderProxy />
          </ServiceShell></RequireAuth>
        } />

        <Route path="/gofr-plot" element={<Navigate to="/gofr-plot/health" replace />} />
        <Route path="/gofr-plot/health" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-PLOT"
            serviceRoute="/gofr-plot"
            navItems={gofrPlotNavItems}
          >
            <GofrPlotHealthCheck />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-plot/discovery" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-PLOT"
            serviceRoute="/gofr-plot"
            navItems={gofrPlotNavItems}
          >
            <GofrPlotDiscovery />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-plot/sessions" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-PLOT"
            serviceRoute="/gofr-plot"
            navItems={gofrPlotNavItems}
          >
            <GofrPlotSessions />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-plot/builder" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-PLOT"
            serviceRoute="/gofr-plot"
            navItems={gofrPlotNavItems}
          >
            <GofrPlotBuilder />
          </ServiceShell></RequireAuth>
        } />

        <Route path="/gofr-np" element={<Navigate to="/gofr-np/health" replace />} />
        <Route path="/gofr-np/health" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-NP"
            serviceRoute="/gofr-np"
            navItems={gofrNpNavItems}
          >
            <GofrNpHealthCheck />
          </ServiceShell></RequireAuth>
        } />
        <Route path="/gofr-np/tools" element={
          <RequireAuth><ServiceShell
            serviceName="GOFR-NP"
            serviceRoute="/gofr-np"
            navItems={gofrNpNavItems}
          >
            <GofrNpTools />
          </ServiceShell></RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </GlobalErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
