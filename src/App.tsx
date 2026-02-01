import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import ServiceShell from './components/layout/ServiceShell';
import Dashboard from './pages/Dashboard';
import Operations from './pages/Operations';
import GofrIQ from './pages/GofrIQ';
import GofrIQSources from './pages/GofrIQSources';
import GofrIQClients from './pages/GofrIQClients';
import GofrIQIngest from './pages/GofrIQIngest';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell><Dashboard /></AppShell>} />
        <Route path="/operations" element={<AppShell><Operations /></AppShell>} />
        <Route path="/gofr-iq/health" element={
          <ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQ />
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
        <Route path="/gofr-iq/ingest" element={
          <ServiceShell serviceName="GOFR-IQ" serviceRoute="/gofr-iq">
            <GofrIQIngest />
          </ServiceShell>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App
