import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { api } from '../services/api';

export default function GofrDigHealthCheck() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<{ status: string; service: string } | null>(null);

  const runHealthCheck = async () => {
    setLoading(true);
    setError(null);
    setHealthData(null);
    try {
      const result = await api.digPing();
      setHealthData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Health check failed';
      setError(message.toLowerCase().includes('ping') ? message : `ping failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const statusOk = healthData?.status === 'ok' || healthData?.status === 'healthy';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GOFR-DIG Health Check
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Verify MCP connectivity to the GOFR-DIG scraping service.
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Button
          variant="contained"
          onClick={runHealthCheck}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} /> : undefined}
        >
          {loading ? 'Checking…' : 'Run Health Check'}
        </Button>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {healthData && (
        <Paper sx={{ p: 3 }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            {statusOk ? (
              <CheckCircleIcon color="success" />
            ) : (
              <ErrorIcon color="error" />
            )}
            <Typography variant="h6">
              {statusOk ? 'Service Healthy' : 'Service Unhealthy'}
            </Typography>
            <Chip
              label={healthData.status}
              color={statusOk ? 'success' : 'error'}
              size="small"
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Service: {healthData.service}
          </Typography>
          <Box
            component="pre"
            sx={{
              mt: 2,
              p: 2,
              bgcolor: 'background.paper',
              borderRadius: 1,
              overflow: 'auto',
              fontSize: 12,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {JSON.stringify(healthData, null, 2)}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
