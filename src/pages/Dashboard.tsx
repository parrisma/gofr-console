import { useEffect, useState } from 'react';
import { Box, Button, Card, CardContent, Typography, Grid } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface HealthStatus {
  status: string;
  services: {
    neo4j: { status: string; message: string };
    chromadb: { status: string; message: string };
    llm: { status: string; message: string };
  };
  timestamp: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    api.healthCheck()
      .then(setHealth)
      .catch(() => {
        // Swallow — healthCheck already returns a default on failure,
        // but guard against any unexpected rejection.
        setHealth({
          status: 'unknown',
          services: {
            neo4j: { status: 'unknown', message: 'Service unreachable' },
            chromadb: { status: 'unknown', message: 'Service unreachable' },
            llm: { status: 'unknown', message: 'Service unreachable' },
          },
          timestamp: new Date().toISOString(),
        });
      });
  }, []);

  const services = [
    {
      name: 'GOFR-IQ',
      label: 'Intelligence',
      status: health?.services.neo4j?.status,
      route: '/gofr-iq/health',
      nextAction: 'Open Client 360',
      nextRoute: '/gofr-iq/client-360',
    },
    {
      name: 'GOFR-DIG',
      label: 'Data Ingestion',
      status: 'up',
      route: '/gofr-dig',
      nextAction: 'Scrape a URL',
      nextRoute: '/gofr-dig',
    },
    {
      name: 'GOFR-PLOT',
      label: 'Visualization',
      status: 'up',
      route: '/gofr-plot/health',
      nextAction: 'Open Plot Health',
      nextRoute: '/gofr-plot/health',
    },
    {
      name: 'GOFR-DOC',
      label: 'Documentation',
      status: health?.services.chromadb?.status,
      route: '/gofr-doc',
      nextAction: 'Create a doc session',
      nextRoute: '/gofr-doc/sessions',
    },
    {
      name: 'GOFR-NP',
      label: 'Network & Policy',
      status: health?.services.llm?.status,
      route: null,
      nextAction: 'Coming soon',
      nextRoute: null,
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box
          component="img"
          src="/logo.png"
          alt="GOFR"
          sx={{ width: 64, height: 64, objectFit: 'contain' }}
        />
        <Box>
          <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            GOFR Console
          </Typography>
        </Box>
      </Box>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Getting started
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Start with the most common workflows.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button variant="contained" onClick={() => navigate('/gofr-iq/client-360')}>
                  Open Client 360
                </Button>
                <Button variant="contained" onClick={() => navigate('/gofr-dig')}>
                  Scrape a URL
                </Button>
                <Button variant="contained" onClick={() => navigate('/gofr-doc/sessions')}>
                  Create Doc Session
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        {services.map((service) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={service.name}>
            <Card
              onClick={() => service.route && navigate(service.route)}
              sx={{
                cursor: service.route ? 'pointer' : 'default',
                '&:hover': service.route ? {
                  boxShadow: 4,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s',
                } : {},
              }}
            >
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <CheckCircle color="success" />
                  <Box>
                    <Typography variant="h6">{service.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {service.label}: Online
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Next: {service.nextAction}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {health && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Last checked: {new Date(health.timestamp).toLocaleString()}
        </Typography>
      )}
    </Box>
  );
}
