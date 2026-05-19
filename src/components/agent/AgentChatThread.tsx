import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Chip, CircularProgress, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';

import type { AgentTurn } from '../../types/gofrAgent';

type ResponseDisplayMode = 'text' | 'markdown';

const MARKDOWN_REMARK_PLUGINS = [remarkGfm];

function statusColor(status: AgentTurn['status']): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  if (status === 'running') return 'primary';
  if (status === 'completed') return 'success';
  if (status === 'verification_gap' || status === 'clarification_requested' || status === 'waiting_for_user') return 'warning';
  if (status === 'failed' || status === 'cancelled') return 'error';
  return 'default';
}

function turnText(turn: AgentTurn): string {
  return turn.text || (turn.status === 'running' ? 'Working...' : '');
}

function MarkdownResponse({ text }: { text: string }) {
  return (
    <Box
      sx={{
        color: 'text.primary',
        fontSize: '0.875rem',
        lineHeight: 1.5,
        overflowWrap: 'anywhere',
        '& > :first-of-type': { mt: 0 },
        '& > :last-child': { mb: 0 },
        '& p': { my: 0.75 },
        '& ul, & ol': { my: 0.75, pl: 2.5 },
        '& li': { my: 0.25 },
        '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 1.25, mb: 0.75, fontWeight: 700, lineHeight: 1.25 },
        '& h1': { fontSize: '1.25rem' },
        '& h2': { fontSize: '1.125rem' },
        '& h3, & h4, & h5, & h6': { fontSize: '1rem' },
        '& code': {
          bgcolor: 'action.hover',
          borderRadius: 0.5,
          fontFamily: 'monospace',
          fontSize: '0.8125rem',
          px: 0.5,
          py: 0.125,
        },
        '& pre': {
          bgcolor: 'action.hover',
          borderRadius: 1,
          my: 1,
          overflow: 'auto',
          p: 1,
          '& code': { bgcolor: 'transparent', p: 0 },
        },
        '& table': { borderCollapse: 'collapse', display: 'block', my: 1, overflowX: 'auto', width: '100%' },
        '& th, & td': { border: 1, borderColor: 'divider', px: 1, py: 0.5, textAlign: 'left' },
        '& blockquote': { borderLeft: 3, borderColor: 'divider', color: 'text.secondary', my: 1, pl: 1.5 },
        '& a': { color: 'primary.main' },
      }}
    >
      <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS} skipHtml>
        {text}
      </ReactMarkdown>
    </Box>
  );
}

function TurnBody({ turn, responseMode }: { turn: AgentTurn; responseMode: ResponseDisplayMode }) {
  const text = turnText(turn);
  if (turn.role === 'assistant' && responseMode === 'markdown' && text) {
    return <MarkdownResponse text={text} />;
  }

  return (
    <Box sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}

export default function AgentChatThread({ turns, onSelectTurn }: { turns: AgentTurn[]; onSelectTurn: (turn: AgentTurn) => void }) {
  const [responseMode, setResponseMode] = useState<ResponseDisplayMode>('text');

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
    <Box sx={{ display: 'grid', gap: 1 }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        aria-label="Ask response display mode"
        value={responseMode}
        onChange={(_, value: ResponseDisplayMode | null) => {
          if (value) setResponseMode(value);
        }}
        sx={{ justifySelf: 'end' }}
      >
        <ToggleButton value="text">Text</ToggleButton>
        <ToggleButton value="markdown">Markdown</ToggleButton>
      </ToggleButtonGroup>
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
              <TurnBody turn={turn} responseMode={responseMode} />
            </Paper>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
