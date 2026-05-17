import { Box, Chip, Stack, Typography } from '@mui/material';

import type { AgentTurn } from '../../types/gofrAgent';

export default function AgentTurnMetadata({ turn }: { turn: AgentTurn | null }) {
  if (!turn) return <Typography variant="body2" color="text.secondary">No turn selected.</Typography>;
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {turn.requestId ? <Chip size="small" label={`request ${turn.requestId}`} /> : null}
        {turn.userInputRequest ? <Chip size="small" label={`prompt ${turn.userInputRequest.prompt_id}`} /> : null}
        {turn.sessionId ? <Chip size="small" label={`session ${turn.sessionId}`} /> : null}
        {turn.model ? <Chip size="small" label={turn.model} /> : null}
        {typeof turn.tokensUsed === 'number' ? <Chip size="small" label={`${turn.tokensUsed} tokens`} /> : null}
        {typeof turn.durationMs === 'number' ? <Chip size="small" label={`${turn.durationMs} ms`} /> : null}
      </Stack>
      {turn.error ? <Typography variant="body2" color="error">{turn.error}</Typography> : null}
      {turn.verificationGap ? (
        <Typography variant="body2" color="warning.main">
          Verification gap: {turn.verificationGap.reason}
        </Typography>
      ) : null}
      {turn.clarificationRequest ? (
        <Typography variant="body2" color="warning.main">
          Clarification requested: {turn.clarificationRequest.reason}
        </Typography>
      ) : null}
      {turn.userInputRequest ? (
        <Typography variant="body2" color="warning.main">
          Waiting for user input until {new Date(turn.userInputRequest.expires_at).toLocaleString()}
        </Typography>
      ) : null}
    </Box>
  );
}