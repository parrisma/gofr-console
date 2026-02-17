import { useEffect, useState } from 'react';
import { Box, Button, Chip, CircularProgress, Paper, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

import { api } from '../services/api';
import { useConfig } from '../hooks/useConfig';
import { logger } from '../services/logging';
import RequestPreview from '../components/common/RequestPreview';
import JsonBlock from '../components/common/JsonBlock';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import GofrDocContextStrip from '../components/common/GofrDocContextStrip';
import type { DocPingResponse } from '../types/gofrDoc';

export default function GofrDocHealthCheck() {
  const { mcpServices, getMcpPort } = useConfig();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [response, setResponse] = useState<DocPingResponse | null>(null);

  const docService = mcpServices.find((service) => service.name === 'gofr-doc');
  const docMcpPort = getMcpPort('gofr-doc');
  const proxyUrl = '/api/gofr-doc/mcp/';
  const upstreamUrl = `http://${docService?.containerHostname ?? 'gofr-doc-mcp'}:${docMcpPort}/mcp/`;

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-DOC Health page viewed',
      component: 'GofrDocHealthCheck',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

  const runPing = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setLoading(true);
    setErr(null);
    setResponse(null);
    try {
      const result = await api.docPing();
      setResponse(result);
      logger.info({
        event: 'ui_form_submitted',
        message: 'docPing succeeded',
        request_id: requestId,
        component: 'GofrDocHealthCheck',
        operation: 'ping',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'docPing failed',
        request_id: requestId,
        component: 'GofrDocHealthCheck',
        operation: 'ping',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setLoading(false);
    }
  };

  const statusOk = response?.status === 'ok' || response?.status === 'healthy';

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Typography variant="h4">GOFR-DOC Health</Typography>
         <GofrDocContextStrip />
        <Chip label="MCP" size="small" />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Verify MCP connectivity to the GOFR-DOC service.
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          URL (via proxy): {proxyUrl}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upstream MCP URL: {upstreamUrl}
        </Typography>

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="contained"
            onClick={runPing}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {loading ? 'Running…' : 'Run Health Check'}
          </Button>
          <RequestPreview tool="ping" args={{}} />
        </Box>

        {response ? (
          <Box sx={{ mt: 2 }}>
            <Chip
              icon={statusOk ? <CheckCircleIcon /> : <ErrorIcon />}
              label={statusOk ? 'Healthy' : 'Error'}
              color={statusOk ? 'success' : 'error'}
              variant="outlined"
            />
          </Box>
        ) : null}

        {err ? (
          <ToolErrorAlert err={err} fallback="Ping failed" />
        ) : null}

        <JsonBlock data={response} copyLabel="Copy response" />
      </Paper>
    </Box>
  );
}
