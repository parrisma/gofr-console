import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { useTokens } from '../../hooks/useTokens';
import { useGofrDocUi } from '../../hooks/useGofrDocUi';

function CopyChip({ label, value }: { label: string; value: string }) {
  const canCopy = Boolean(value && value.trim());
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <Chip
        size="small"
        variant="outlined"
        label={`${label}: ${value || '—'}`}
        sx={{ mr: 0.5 }}
      />
      <Tooltip title={canCopy ? `Copy ${label}` : `No ${label} to copy`} arrow>
        <span>
          <IconButton
            size="small"
            disabled={!canCopy}
            onClick={() => navigator.clipboard.writeText(value)}
            aria-label={`Copy ${label}`}
          >
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

export default function GofrDocContextStrip() {
  const { tokens } = useTokens();
  const { state: uiState } = useGofrDocUi();

  const selectedToken =
    uiState.selectedTokenIndex >= 0 && uiState.selectedTokenIndex < tokens.length
      ? tokens.at(uiState.selectedTokenIndex) ?? null
      : null;

  return (
    <Box
      sx={{
        mb: 2,
        p: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
        Context
      </Typography>

      <Chip
        size="small"
        variant="outlined"
        label={`Token: ${selectedToken?.name ?? '—'}`}
      />
      <Chip
        size="small"
        variant="outlined"
        label={`Group: ${selectedToken?.groups ?? '—'}`}
      />

      <CopyChip label="template_id" value={uiState.templateId || ''} />
      <CopyChip label="session_id" value={uiState.sessionId || ''} />
      <CopyChip label="style_id" value={uiState.styleId || ''} />
    </Box>
  );
}
