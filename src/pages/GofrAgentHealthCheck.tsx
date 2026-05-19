import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

import AgentCapabilitiesPanel from '../components/agent/AgentCapabilitiesPanel';
import AgentHealthPanel from '../components/agent/AgentHealthPanel';
import TokenSelect from '../components/common/TokenSelect';
import { useGofrAgentChat } from '../hooks/useGofrAgentChat';
import type { AgentConnectionState, AgentHealthCheckResponse, AgentHttpHealthResponse } from '../types/gofrAgent';

function connectionLabel(connection: AgentConnectionState): string {
  if (connection.status === 'connected') return connection.version ? `Connected ${connection.version}` : 'Connected';
  if (connection.status === 'degraded') return 'Degraded';
  if (connection.status === 'unhealthy') return 'Unhealthy';
  if (connection.status === 'checking') return 'Checking';
  if (connection.status === 'needs-token') return 'Needs token';
  if (connection.status === 'unauthorized') return 'Unauthorized';
  if (connection.status === 'misconfigured') return 'Misconfigured';
  if (connection.status === 'unavailable') return 'Unavailable';
  return 'Idle';
}

function connectionColor(connection: AgentConnectionState): 'default' | 'success' | 'warning' | 'error' | 'primary' {
  if (connection.status === 'connected') return 'success';
  if (connection.status === 'degraded') return 'warning';
  if (connection.status === 'unhealthy') return 'error';
  if (connection.status === 'checking') return 'primary';
  if (connection.status === 'needs-token' || connection.status === 'misconfigured') return 'warning';
  if (connection.status === 'unauthorized' || connection.status === 'unavailable') return 'error';
  return 'default';
}

function connectionAlertSeverity(connection: AgentConnectionState): 'info' | 'warning' | 'error' {
  if (connection.status === 'needs-token') return 'info';
  if (connection.status === 'unhealthy' || connection.status === 'unauthorized' || connection.status === 'unavailable') return 'error';
  return 'warning';
}

function healthSeverity(health: AgentHttpHealthResponse | AgentHealthCheckResponse): 'success' | 'warning' | 'error' {
  if (health.status === 'healthy') return 'success';
  if (health.status === 'degraded') return 'warning';
  return 'error';
}

function healthSummary(health: AgentHttpHealthResponse | AgentHealthCheckResponse): string {
  const downstream = 'downstream_services' in health ? health.downstream_services : health.downstream;
  return `${health.message} Downstream: ${downstream.healthy}/${downstream.total} healthy, ${downstream.degraded} degraded, ${downstream.failed} failed.`;
}

export default function GofrAgentHealthCheck() {
  const agent = useGofrAgentChat();
  const health = agent.mcpHealth ?? agent.httpHealth;
  const checking = agent.connection.status === 'checking';

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">GOFR-Agent Health</Typography>
          <Typography variant="body2" color="text.secondary">
            Runtime readiness, MCP diagnostics, and downstream capabilities.
          </Typography>
        </Box>
        <Chip label={connectionLabel(agent.connection)} color={connectionColor(agent.connection)} />
        <TokenSelect
          label="Agent token"
          tokens={agent.tokens}
          value={agent.selectedTokenIndex}
          onChange={agent.setSelectedTokenIndex}
          disabled={agent.hasActiveRun}
          noneLabel="Select token"
          helperText="Bearer token sent to GOFR-Agent"
        />
        <Button
          variant="outlined"
          onClick={() => void agent.refreshConnection()}
          disabled={checking}
          startIcon={checking ? <CircularProgress size={18} /> : <RefreshIcon />}
        >
          Refresh
        </Button>
      </Stack>

      {'message' in agent.connection && agent.connection.status !== 'connected' ? (
        <Alert severity={connectionAlertSeverity(agent.connection)}>{agent.connection.message}</Alert>
      ) : null}
      {health ? <Alert severity={healthSeverity(health)}>{healthSummary(health)}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Health</Typography>
              <AgentHealthPanel
                ping={agent.httpPing}
                httpHealth={agent.httpHealth}
                mcpHealth={agent.mcpHealth}
                healthError={agent.healthError}
                endpointDiagnostic={agent.endpointDiagnostic}
                runtimeLimits={agent.runtimeLimits}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Capabilities</Typography>
              <AgentCapabilitiesPanel services={agent.services} error={agent.capabilitiesError} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}