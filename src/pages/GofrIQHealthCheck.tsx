import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  AlertTitle,
  CircularProgress,
  Stack,
  Chip,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { api } from '../services/api';

interface HealthData {
  status: string;
  message: string;
  services: {
    neo4j: { status: string; message: string; node_count?: number };
    chromadb: { status: string; message: string; document_count?: number };
    llm: { status: string; message: string; chat_model?: string };
  };
  timestamp: string;
}

export default function GofrIQHealthCheck() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const runHealthCheck = async () => {
    setLoading(true);
    setError(null);
    setHealthData(null);

    try {
      const result = await api.healthCheck();
      setHealthData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    return status === 'ok' || status === 'healthy' ? (
      <CheckCircleIcon color="success" />
    ) : (
      <ErrorIcon color="error" />
    );
  };

  const getStatusColor = (status: string): 'success' | 'error' | 'default' => {
    return status === 'ok' || status === 'healthy' ? 'success' : 'error';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom>
          GOFR-IQ MCP Health Check
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Stage 5.0: Pre-Flight MCP Communication Test
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Stack spacing={3}>
          <Button
            variant="contained"
            onClick={runHealthCheck}
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? 'Testing Connection...' : 'Run Health Check'}
          </Button>

          {error && (
            <Alert severity="error">
              <AlertTitle>Connection Failed</AlertTitle>
              {error}
            </Alert>
          )}

          {healthData && (
            <>
              <Alert
                severity={
                  healthData.status === 'ok' || healthData.status === 'healthy'
                    ? 'success'
                    : 'error'
                }
              >
                <AlertTitle>
                  {healthData.status === 'ok' || healthData.status === 'healthy'
                    ? 'MCP Connection Successful'
                    : 'MCP Connection Issues Detected'}
                </AlertTitle>
                {healthData.message}
              </Alert>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Service Status
                </Typography>

                <Stack spacing={2}>
                  {/* Neo4j Status */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {getStatusIcon(healthData.services.neo4j.status)}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1">Neo4j Graph Database</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {healthData.services.neo4j.message}
                        {healthData.services.neo4j.node_count !== undefined &&
                          ` (${healthData.services.neo4j.node_count} nodes)`}
                      </Typography>
                    </Box>
                    <Chip
                      label={healthData.services.neo4j.status}
                      size="small"
                      color={getStatusColor(healthData.services.neo4j.status)}
                    />
                  </Box>

                  <Divider />

                  {/* ChromaDB Status */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {getStatusIcon(healthData.services.chromadb.status)}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1">ChromaDB Vector Store</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {healthData.services.chromadb.message}
                        {healthData.services.chromadb.document_count !== undefined &&
                          ` (${healthData.services.chromadb.document_count} documents)`}
                      </Typography>
                    </Box>
                    <Chip
                      label={healthData.services.chromadb.status}
                      size="small"
                      color={getStatusColor(healthData.services.chromadb.status)}
                    />
                  </Box>

                  <Divider />

                  {/* LLM Status */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {getStatusIcon(healthData.services.llm.status)}
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1">LLM Service</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {healthData.services.llm.message}
                        {healthData.services.llm.chat_model &&
                          ` (Model: ${healthData.services.llm.chat_model})`}
                      </Typography>
                    </Box>
                    <Chip
                      label={healthData.services.llm.status}
                      size="small"
                      color={getStatusColor(healthData.services.llm.status)}
                    />
                  </Box>
                </Stack>
              </Paper>

              <Typography variant="caption" color="text.secondary">
                Last checked: {new Date(healthData.timestamp).toLocaleString()}
              </Typography>
            </>
          )}

          {!healthData && !error && !loading && (
            <Alert severity="info">
              Click "Run Health Check" to verify MCP connectivity and service status.
            </Alert>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
