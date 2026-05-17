import { useState } from 'react';
import {
  Box,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SendIcon from '@mui/icons-material/Send';

import {
  AGENT_HARD_MAX_STEPS,
  AGENT_QUESTION_MAX_LENGTH,
  clampAgentMaxSteps,
  type AgentChatSettings,
  type AgentOutputFormat,
} from '../../types/gofrAgent';

interface AgentComposerProps {
  settings: AgentChatSettings;
  disabled: boolean;
  busy: boolean;
  maxStepsLimit?: number;
  questionMaxLength?: number;
  onSend: (question: string) => void;
  onReset: () => void;
  onRefresh: () => void;
  onSettingsChange: (settings: Partial<AgentChatSettings>) => void;
}

export default function AgentComposer({
  settings,
  disabled,
  busy,
  maxStepsLimit = AGENT_HARD_MAX_STEPS,
  questionMaxLength = AGENT_QUESTION_MAX_LENGTH,
  onSend,
  onReset,
  onRefresh,
  onSettingsChange,
}: AgentComposerProps) {
  const [question, setQuestion] = useState('');
  const trimmed = question.trim();
  const overLimit = question.length > questionMaxLength;
  const canSend = Boolean(trimmed) && !overLimit && !disabled && !busy;

  const send = () => {
    if (!canSend) return;
    onSend(question);
    setQuestion('');
  };

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <TextField
        label="Question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') send();
        }}
        multiline
        minRows={3}
        maxRows={8}
        fullWidth
        error={overLimit}
        helperText={`${question.length}/${questionMaxLength}`}
        disabled={disabled && !trimmed}
      />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={settings.outputFormat}
          onChange={(_, value: AgentOutputFormat | null) => {
            if (value) onSettingsChange({ outputFormat: value });
          }}
        >
          <ToggleButton value="text">Text</ToggleButton>
          <ToggleButton value="json">JSON</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          label="Steps"
          type="number"
          size="small"
          value={settings.maxSteps}
          onChange={(event) => onSettingsChange({
            maxSteps: Math.min(maxStepsLimit, clampAgentMaxSteps(Number(event.target.value))),
          })}
          slotProps={{ htmlInput: { min: 1, max: maxStepsLimit } }}
          sx={{ width: { xs: '100%', md: 120 } }}
        />
        <FormControlLabel
          control={<Switch checked={settings.toolsOnly} onChange={(event) => onSettingsChange({ toolsOnly: event.target.checked })} />}
          label="Tools only"
        />
        <FormControlLabel
          control={<Switch checked={settings.noCommentary} onChange={(event) => onSettingsChange({ noCommentary: event.target.checked })} />}
          label="No commentary"
        />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh connection">
          <span>
            <IconButton onClick={onRefresh} disabled={busy} aria-label="Refresh GOFR-Agent connection">
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Reset session">
          <span>
            <IconButton onClick={onReset} disabled={busy} aria-label="Reset GOFR-Agent session">
              <RestartAltIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Send">
          <span>
            <IconButton color="primary" onClick={send} disabled={!canSend} aria-label="Send question">
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}