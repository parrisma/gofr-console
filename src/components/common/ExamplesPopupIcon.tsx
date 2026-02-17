import { useMemo, useState } from 'react';
import { Box, Button, ClickAwayListener, IconButton, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

function normaliseExamples(examples: Array<string> | string): Array<string> {
  if (Array.isArray(examples)) return examples;
  return [examples];
}

export default function ExamplesPopupIcon({
  title = 'Examples',
  examples,
  maxHeight = 360,
}: {
  title?: string;
  examples: Array<string> | string;
  maxHeight?: number;
}) {
  const [pinned, setPinned] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);

  const open = pinned || hoverOpen;
  const list = useMemo(() => normaliseExamples(examples), [examples]);
  const text = list
    .map((ex, idx) => `Example ${idx + 1}\n${ex.trim()}`)
    .join('\n\n---\n\n');

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
            <Box sx={{ maxWidth: 720 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                <Typography variant="subtitle2">{title}</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => navigator.clipboard.writeText(text)}
                >
                  Copy
                </Button>
              </Box>
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
                  maxHeight,
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
            aria-label={title}
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
