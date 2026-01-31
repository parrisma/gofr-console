import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import ServiceShell from './components/layout/ServiceShell';
import Dashboard from './pages/Dashboard';
import Operations from './pages/Operations';
import GofrIQ from './pages/GofrIQ';

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
      </Routes>
    </BrowserRouter>
  );
}

export default App
