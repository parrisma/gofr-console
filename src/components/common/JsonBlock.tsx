import { Box, Button, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

function toDisplayText(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export default function JsonBlock({
  data,
  maxHeight = 600,
  copyLabel = 'Copy',
}: {
  data: unknown;
  maxHeight?: number;
  copyLabel?: string;
}) {
  if (data == null) return null;
  const text = toDisplayText(data);
  return (
    <Box sx={{ mt: 2 }}>
      <Box display="flex" justifyContent="flex-end" mb={1}>
        <Tooltip title="Copy to clipboard" arrow>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={() => navigator.clipboard.writeText(text)}
              disabled={!text}
            >
              {copyLabel}
            </Button>
          </span>
        </Tooltip>
      </Box>
      <Box
        component="pre"
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          borderRadius: 1,
          overflowX: 'auto',
          overflowY: 'auto',
          maxWidth: '100%',
          maxHeight,
          fontSize: 12,
          border: '1px solid',
          borderColor: 'divider',
          whiteSpace: 'pre',
          wordBreak: 'keep-all',
          m: 0,
        }}
      >
        {text}
      </Box>
    </Box>
  );
}
