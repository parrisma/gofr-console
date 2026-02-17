import { Alert, Box, Typography } from '@mui/material';

import { ApiError } from '../../services/api/errors';

function toMessage(err: unknown, fallback: string): { title: string; details?: string; recovery?: string } {
  if (err instanceof ApiError) {
    const code = err.code ? ` (${String(err.code)})` : '';
    const title = `${err.service} / ${err.tool}${code}`;
    const details = err.message;
    const recovery = err.recovery;
    return { title, details, recovery };
  }
  if (err instanceof Error) return { title: fallback, details: err.message };
  return { title: fallback, details: typeof err === 'string' ? err : undefined };
}

export default function ToolErrorAlert({ err, fallback }: { err: unknown; fallback: string }) {
  if (!err) return null;
  const { title, details, recovery } = toMessage(err, fallback);
  return (
    <Box sx={{ mt: 2 }}>
      <Alert severity="error">
        <Typography variant="subtitle2" gutterBottom>
          {title}
        </Typography>
        {details && <Typography variant="body2">{details}</Typography>}
        {recovery ? (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Recovery: {recovery}
          </Typography>
        ) : null}
      </Alert>
    </Box>
  );
}
