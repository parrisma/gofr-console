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
import type { DocPingResponse, PlotListHandlersResponse } from '../types/gofrDoc';

export default function GofrPlotHealthCheck() {
  const { mcpServices, getMcpPort } = useConfig();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [pingRes, setPingRes] = useState<DocPingResponse | null>(null);
  const [handlersRes, setHandlersRes] = useState<PlotListHandlersResponse | null>(null);

  const docService = mcpServices.find((service) => service.name === 'gofr-doc');
  const docMcpPort = getMcpPort('gofr-doc');
  const proxyUrl = '/api/gofr-doc/mcp/';
  const upstreamUrl = `http://${docService?.containerHostname ?? 'gofr-doc-mcp'}:${docMcpPort}/mcp/`;

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-PLOT Health page viewed',
      component: 'GofrPlotHealthCheck',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

  const runHealth = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();

    setLoading(true);
    setErr(null);
    setPingRes(null);
    setHandlersRes(null);

    try {
      const [ping, handlers] = await Promise.all([
        api.docPing(),
        api.docPlotListHandlers(),
      ]);
      setPingRes(ping);
      setHandlersRes(handlers);

      logger.info({
        event: 'ui_form_submitted',
        message: 'GOFR-PLOT health checks succeeded',
        request_id: requestId,
        component: 'GofrPlotHealthCheck',
        operation: 'plot_health_check',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'GOFR-PLOT health checks failed',
        request_id: requestId,
        component: 'GofrPlotHealthCheck',
        operation: 'plot_health_check',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setLoading(false);
    }
  };

  const statusOk = pingRes?.status === 'ok' || pingRes?.status === 'healthy';

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Typography variant="h4">GOFR-PLOT Health</Typography>
        <Chip label="via GOFR-DOC MCP" size="small" />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Verify MCP connectivity and that plot tools are registered in GOFR-DOC.
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
            onClick={runHealth}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {loading ? 'Running…' : 'Run Health Check'}
          </Button>
          <RequestPreview tool="ping" args={{}} />
          <RequestPreview tool="list_handlers" args={{}} />
        </Box>

        {pingRes ? (
          <Box sx={{ mt: 2 }}>
            <Chip
              icon={statusOk ? <CheckCircleIcon /> : <ErrorIcon />}
              label={statusOk ? 'Healthy' : 'Error'}
              color={statusOk ? 'success' : 'error'}
              variant="outlined"
            />
          </Box>
        ) : null}

        {err ? <ToolErrorAlert err={err} fallback="Health check failed" /> : null}

        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          ping
        </Typography>
        <JsonBlock data={pingRes} copyLabel="Copy ping" />

        <Typography variant="subtitle2" sx={{ mt: 2 }}>
          list_handlers
        </Typography>
        <JsonBlock data={handlersRes} copyLabel="Copy handlers" />
      </Paper>
    </Box>
  );
}
