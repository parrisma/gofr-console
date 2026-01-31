import { Box, Typography, Card, CardContent, Chip, CircularProgress, Alert, Stack } from '@mui/material';
import { CheckCircle, Error, Refresh } from '@mui/icons-material';
import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

interface ServiceStatus {
  status: string;
  message: string;
  node_count?: number;
  document_count?: number;
  chat_model?: string;
}

interface HealthStatus {
  status: string;
  message: string;
  services: {
    neo4j: ServiceStatus;
    chromadb: ServiceStatus;
    llm: ServiceStatus;
  };
  timestamp: string;
}

export default function GofrIQ() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.healthCheck();
      setHealth(data);
    } catch {
      setError('Failed to fetch health status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const isHealthy = health?.status === 'healthy';

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="h4">GOFR-IQ Health</Typography>
        {loading && <CircularProgress size={24} />}
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        MCP server status and dependencies. Click card to refresh.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card
        sx={{
          mt: 3,
          maxWidth: 700,
          cursor: 'pointer',
          '&:hover': { boxShadow: 4, transform: 'translateY(-2px)', transition: 'all 0.2s' },
        }}
        onClick={refreshHealth}
      >
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            {isHealthy ? (
              <CheckCircle color="success" sx={{ fontSize: 48 }} />
            ) : health ? (
              <Error color="error" sx={{ fontSize: 48 }} />
            ) : (
              <Refresh color="disabled" sx={{ fontSize: 48 }} />
            )}
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="h5">GOFR-IQ MCP Server</Typography>
                {health && (
                  <Chip
                    label={health.status}
                    color={isHealthy ? 'success' : 'error'}
                    size="small"
                  />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {health?.message || 'Click to check status'}
              </Typography>
            </Box>
          </Box>

          {health && (
            <Stack spacing={2} mt={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Service Dependencies
              </Typography>
              
              {/* Neo4j */}
              <Box display="flex" alignItems="center" justifyContent="space-between" p={1.5} bgcolor="background.paper" borderRadius={1}>
                <Box>
                  <Typography variant="body1" fontWeight="medium">Neo4j</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {health.services.neo4j.message}
                    {health.services.neo4j.node_count !== undefined && ` • ${health.services.neo4j.node_count} nodes`}
                  </Typography>
                </Box>
                <Chip
                  label={health.services.neo4j.status}
                  color={health.services.neo4j.status === 'healthy' ? 'success' : 'error'}
                  size="small"
                />
              </Box>

              {/* ChromaDB */}
              <Box display="flex" alignItems="center" justifyContent="space-between" p={1.5} bgcolor="background.paper" borderRadius={1}>
                <Box>
                  <Typography variant="body1" fontWeight="medium">ChromaDB</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {health.services.chromadb.message}
                    {health.services.chromadb.document_count !== undefined && ` • ${health.services.chromadb.document_count} documents`}
                  </Typography>
                </Box>
                <Chip
                  label={health.services.chromadb.status}
                  color={health.services.chromadb.status === 'healthy' ? 'success' : 'error'}
                  size="small"
                />
              </Box>

              {/* LLM */}
              <Box display="flex" alignItems="center" justifyContent="space-between" p={1.5} bgcolor="background.paper" borderRadius={1}>
                <Box>
                  <Typography variant="body1" fontWeight="medium">LLM API</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {health.services.llm.message}
                    {health.services.llm.chat_model && ` • ${health.services.llm.chat_model}`}
                  </Typography>
                </Box>
                <Chip
                  label={health.services.llm.status}
                  color={health.services.llm.status === 'healthy' ? 'success' : 'error'}
                  size="small"
                />
              </Box>
            </Stack>
          )}

          {health && (
            <Box mt={3}>
              <Typography variant="caption" color="text.secondary">
                Last checked: {new Date(health.timestamp).toLocaleString()}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
