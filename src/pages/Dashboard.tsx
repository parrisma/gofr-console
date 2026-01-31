import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Grid } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface HealthStatus {
  status: string;
  services: {
    neo4j: string;
    chromadb: string;
    vault: string;
  };
  timestamp: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    api.healthCheck().then(setHealth);
  }, []);

  const services = [
    { name: 'GOFR-IQ', label: 'Intelligence', status: health?.services.neo4j, route: '/gofr-iq/health' },
    { name: 'GOFR-DIG', label: 'Data Ingestion', status: 'up', route: null },
    { name: 'GOFR-PLOT', label: 'Visualization', status: 'up', route: null },
    { name: 'GOFR-DOC', label: 'Documentation', status: health?.services.chromadb, route: null },
    { name: 'GOFR-NP', label: 'Network & Policy', status: health?.services.vault, route: null },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Grid container spacing={2}>
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
