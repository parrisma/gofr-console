import { useState } from 'react';
import { Box, ClickAwayListener, IconButton, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

function toDisplayText(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(args).filter(([key]) => !/token|authorization/i.test(key));
  return Object.fromEntries(entries);
}

export default function RequestPreview({
  tool,
  args,
}: {
  tool: string;
  args: Record<string, unknown>;
}) {
  const [pinned, setPinned] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);

  const payload = {
    tool,
    arguments: sanitizeArgs(args),
  };
  const text = toDisplayText(payload);

  const open = pinned || hoverOpen;

  return (
    <ClickAwayListener
      onClickAway={() => {
        if (pinned) setPinned(false);
      }}
    >
      <Box sx={{ display: 'inline-flex' }}>
        <Tooltip
          open={open}
          onOpen={() => {
            if (!pinned) setHoverOpen(true);
          }}
          onClose={() => {
            if (!pinned) setHoverOpen(false);
          }}
          disableHoverListener={pinned}
          disableFocusListener={pinned}
          disableTouchListener={pinned}
          enterDelay={120}
          leaveDelay={240}
          placement="right"
          title={
            <Box sx={{ maxWidth: 520 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Request preview
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  fontSize: 12,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  maxHeight: 260,
                  overflow: 'auto',
                  whiteSpace: 'pre',
                  wordBreak: 'keep-all',
                }}
              >
                {text}
              </Box>
            </Box>
          }
        >
          <IconButton
            size="small"
            aria-label="Request preview"
            onClick={() => {
              setPinned((v) => !v);
              setHoverOpen(false);
            }}
          >
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}
