import { useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, Divider, Grid, Stack, TextField, Typography } from '@mui/material';

import AgentChatThread from '../components/agent/AgentChatThread';
import AgentComposer from '../components/agent/AgentComposer';
import AgentProvenancePanel from '../components/agent/AgentProvenancePanel';
import AgentRunTrace from '../components/agent/AgentRunTrace';
import AgentTurnMetadata from '../components/agent/AgentTurnMetadata';
import TokenSelect from '../components/common/TokenSelect';
import { useGofrAgentChat } from '../hooks/useGofrAgentChat';
import type { AgentConnectionState, AgentTurn } from '../types/gofrAgent';

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

export default function GofrAgent() {
  const agent = useGofrAgentChat();
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null);
  const selectedTurn: AgentTurn | null = selectedTurnId
    ? agent.state.turns.find((turn) => turn.id === selectedTurnId) ?? agent.selectedTurn
    : agent.selectedTurn;
  const canSend = agent.connection.status === 'connected' || agent.connection.status === 'degraded';

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">GOFR-Agent</Typography>
          <Typography variant="body2" color="text.secondary">
            Session {agent.state.sessionId}
          </Typography>
        </Box>
        <Chip label={connectionLabel(agent.connection)} color={connectionColor(agent.connection)} />
        <TokenSelect
          label="Agent token"
          tokens={agent.tokens}
          value={agent.selectedTokenIndex}
          onChange={agent.setSelectedTokenIndex}
          noneLabel="Select token"
          helperText="Bearer token sent to GOFR-Agent"
        />
        <TextField
          label="Token override"
          type="password"
          size="small"
          value={agent.customAuthToken}
          onChange={(event) => agent.setCustomAuthToken(event.target.value)}
          helperText="Raw token, not saved"
          autoComplete="off"
          sx={{ minWidth: 260 }}
        />
      </Stack>

      {'message' in agent.connection && agent.connection.status !== 'connected' ? (
        <Alert severity={connectionAlertSeverity(agent.connection)}>{agent.connection.message}</Alert>
      ) : null}
      {agent.state.error ? <Alert severity="error">{agent.state.error}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardContent sx={{ display: 'grid', gap: 2 }}>
              <AgentChatThread turns={agent.state.turns} onSelectTurn={(turn) => setSelectedTurnId(turn.id)} />
              <Divider />
              <AgentComposer
                settings={agent.state.settings}
                disabled={!canSend}
                busy={agent.hasActiveRun}
                maxStepsLimit={agent.runtimeLimits.maxSteps}
                questionMaxLength={agent.runtimeLimits.questionMaxLength}
                onSend={agent.sendQuestion}
                onReset={agent.resetSession}
                onRefresh={agent.refreshConnection}
                onSettingsChange={(settings) => agent.dispatch({ type: 'update_settings', settings })}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Turn Details</Typography>
                <AgentTurnMetadata turn={selectedTurn} />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Run Trace</Typography>
                <AgentRunTrace events={selectedTurn?.events ?? []} />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Provenance</Typography>
                <AgentProvenancePanel provenance={selectedTurn?.provenance ?? []} />
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}