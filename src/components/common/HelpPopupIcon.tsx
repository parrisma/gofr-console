import { useMemo, useState } from 'react';
import { Box, ClickAwayListener, IconButton, Tooltip, Typography } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

function toDisplayText(body: string | string[]): string {
  if (Array.isArray(body)) return body.join('\n');
  return body;
}

export default function HelpPopupIcon({
  title,
  body,
}: {
  title: string;
  body: string | string[];
}) {
  const [pinned, setPinned] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);

  const open = pinned || hoverOpen;
  const text = useMemo(() => toDisplayText(body), [body]);

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
          placement="bottom"
          title={
            <Box sx={{ maxWidth: 560 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {title}
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
                  maxHeight: 320,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {text}
              </Box>
            </Box>
          }
        >
          <IconButton
            size="small"
            color="inherit"
            aria-label={title}
            onClick={() => {
              setPinned((v) => !v);
              setHoverOpen(false);
            }}
          >
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}
