import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, Divider, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import type {
  AgentHealthCheckResponse,
  AgentHttpHealthResponse,
  AgentMcpEndpointDiagnostic,
  AgentPingResponse,
  AgentRuntimeUiLimits,
} from '../../types/gofrAgent';

interface AgentHealthPanelProps {
  ping: AgentPingResponse | null;
  httpHealth: AgentHttpHealthResponse | null;
  mcpHealth: AgentHealthCheckResponse | null;
  healthError?: string | null;
  endpointDiagnostic: AgentMcpEndpointDiagnostic;
  runtimeLimits: AgentRuntimeUiLimits;
}

function healthStatusColor(status: string): 'default' | 'success' | 'warning' | 'error' {
  if (status === 'healthy' || status === 'ok') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'unhealthy' || status === 'failed') return 'error';
  return 'default';
}

function enabledCount(values: Record<string, boolean | undefined>): number {
  return Object.values(values).filter(Boolean).length;
}

export default function AgentHealthPanel({
  ping,
  httpHealth,
  mcpHealth,
  healthError,
  endpointDiagnostic,
  runtimeLimits,
}: AgentHealthPanelProps) {
  const health = mcpHealth ?? httpHealth;
  const downstream = mcpHealth?.downstream_services ?? httpHealth?.downstream ?? null;

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      {healthError ? <Alert severity="warning">{healthError}</Alert> : null}
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {ping ? <Chip size="small" color="success" label={`process ${ping.status}`} /> : null}
        {ping?.version ? <Chip size="small" label={`version ${ping.version}`} /> : null}
        {health ? <Chip size="small" color={healthStatusColor(health.status)} label={health.status} /> : null}
        {downstream ? <Chip size="small" label={`${downstream.healthy}/${downstream.total} downstream healthy`} /> : null}
        <Chip size="small" label={`MCP ${endpointDiagnostic.host}`} />
        <Chip size="small" label={endpointDiagnostic.path} />
      </Stack>
      {health?.message ? <Typography variant="body2">{health.message}</Typography> : null}
      <Divider />
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {mcpHealth?.config.models.selected ? <Chip size="small" label={`model ${mcpHealth.config.models.selected}`} /> : null}
        <Chip size="small" label={`max steps ${runtimeLimits.maxSteps}`} />
        <Chip size="small" label={`question ${runtimeLimits.questionMaxLength}`} />
        <Chip size="small" label={`context ${runtimeLimits.contextMaxLength}`} />
        {mcpHealth ? <Chip size="small" label={`${enabledCount(mcpHealth.config.features)} features enabled`} /> : null}
      </Stack>
      {mcpHealth?.downstream_services.items.length ? (
        <Stack spacing={1}>
          {mcpHealth.downstream_services.items.map((item) => (
            <Accordion key={item.name} variant="outlined" disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>{item.name}</Typography>
                  <Chip size="small" color={healthStatusColor(item.status)} label={item.status} />
                  <Chip size="small" label={`${item.tool_count} tools`} />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {item.error ? <Alert severity="warning">{item.error}</Alert> : null}
                  {item.registration_error ? <Alert severity="warning">{item.registration_error}</Alert> : null}
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={item.supports_results_hub ? 'hub supported' : 'hub not advertised'} />
                    <Chip size="small" label={item.can_publish_results ? 'publishes results' : 'no publish'} />
                    <Chip size="small" label={item.can_consume_results ? 'consumes results' : 'no consume'} />
                  </Stack>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}