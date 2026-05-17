import { Box, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';

import type { AgentTurn } from '../../types/gofrAgent';

function statusColor(status: AgentTurn['status']): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  if (status === 'running') return 'primary';
  if (status === 'completed') return 'success';
  if (status === 'verification_gap' || status === 'clarification_requested' || status === 'waiting_for_user') return 'warning';
  if (status === 'failed' || status === 'cancelled') return 'error';
  return 'default';
}

export default function AgentChatThread({ turns, onSelectTurn }: { turns: AgentTurn[]; onSelectTurn: (turn: AgentTurn) => void }) {
  if (turns.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Ask GOFR-Agent a question to start a session.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ maxHeight: { xs: 360, lg: 620 }, overflowY: 'auto', pr: 0.5 }}>
      <Stack spacing={1.5}>
        {turns.map((turn) => (
          <Paper
            key={turn.id}
            variant="outlined"
            onClick={() => onSelectTurn(turn)}
            sx={{ p: 2, cursor: 'pointer', bgcolor: turn.role === 'user' ? 'action.hover' : 'background.paper' }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle2">{turn.role === 'user' ? 'You' : 'GOFR-Agent'}</Typography>
              {turn.status ? <Chip size="small" label={turn.status.replace(/_/g, ' ')} color={statusColor(turn.status)} /> : null}
              {turn.status === 'running' ? <CircularProgress size={16} /> : null}
            </Stack>
            <Box sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <Typography variant="body2">{turn.text || (turn.status === 'running' ? 'Working...' : '')}</Typography>
            </Box>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}