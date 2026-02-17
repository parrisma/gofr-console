import { Alert, Box, Typography } from '@mui/material';

import { ApiError } from '../../services/api/errors';

const GENERIC_RECOVERY =
  'Try again. If this keeps happening, check the service Health page and confirm you selected the correct token/group.';

function toMessage(
  err: unknown,
  fallback: string,
  defaultRecovery?: string
): { title: string; details?: string; recovery?: string } {
  if (err instanceof ApiError) {
    const code = err.code ? ` (${String(err.code)})` : '';
    const title = `${err.service} / ${err.tool}${code}`;
    const details = err.message;
    const recovery = err.recovery;
    return { title, details, recovery };
  }
  if (err instanceof Error) return { title: fallback, details: err.message, recovery: defaultRecovery ?? GENERIC_RECOVERY };
  return {
    title: fallback,
    details: typeof err === 'string' ? err : undefined,
    recovery: defaultRecovery ?? GENERIC_RECOVERY,
  };
}

export default function ToolErrorAlert({
  err,
  fallback,
  severity = 'error',
  onClose,
  defaultRecovery,
}: {
  err: unknown;
  fallback: string;
  severity?: 'error' | 'warning';
  onClose?: (() => void) | undefined;
  defaultRecovery?: string;
}) {
  if (!err) return null;
  const { title, details, recovery } = toMessage(err, fallback, defaultRecovery);
  return (
    <Box sx={{ mt: 2 }}>
      <Alert severity={severity} onClose={onClose}>
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
