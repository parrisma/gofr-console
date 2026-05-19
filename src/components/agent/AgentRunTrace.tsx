import { useEffect, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import JsonBlock from '../common/JsonBlock';
import { traceTextLines } from './agentTraceText';
import type { AgentReasoningEvent } from '../../types/gofrAgent';

type TraceMode = 'text' | 'json';

function eventTitle(event: AgentReasoningEvent): string {
  const service = typeof event.service === 'string' ? event.service : '';
  const tool = typeof event.tool === 'string' ? event.tool : '';
  if (service && tool) return `${event.kind}: ${service}/${tool}`;
  return event.kind;
}

function tracePlainText(events: AgentReasoningEvent[]): string {
  return events.flatMap((event) => traceTextLines(event)).join('\n');
}

export default function AgentRunTrace({ events }: { events: AgentReasoningEvent[] }) {
  const [mode, setMode] = useState<TraceMode>('text');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [events.length, mode]);

  if (events.length === 0) {
    return <Typography variant="body2" color="text.secondary">No reasoning events yet.</Typography>;
  }

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <ToggleButtonGroup
        size="small"
        exclusive
        aria-label="Run trace display mode"
        value={mode}
        onChange={(_, value: TraceMode | null) => {
          if (value) setMode(value);
        }}
        sx={{ justifySelf: 'end' }}
      >
        <ToggleButton value="text">Text</ToggleButton>
        <ToggleButton value="json">JSON</ToggleButton>
      </ToggleButtonGroup>
      {mode === 'text' ? (
        <Box
          ref={scrollContainerRef}
          component="pre"
          sx={{
            m: 0,
            maxHeight: 184,
            overflowY: 'auto',
            pr: 0.5,
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {tracePlainText(events)}
        </Box>
      ) : (
        <Box ref={scrollContainerRef} sx={{ maxHeight: 184, overflowY: 'auto', pr: 0.5 }}>
          <Stack spacing={1}>
            {events.map((event) => (
              <Accordion key={event.event_id} variant="outlined" disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Chip size="small" label={event.sequence} />
                    <Typography variant="body2" noWrap>{eventTitle(event)}</Typography>
                    {event.truncated ? <Chip size="small" color="warning" label="truncated" /> : null}
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'grid', gap: 1 }}>
                    {typeof event.summary === 'string' ? <Typography variant="body2">{event.summary}</Typography> : null}
                    {typeof event.error === 'string' ? <Typography variant="body2" color="error">{event.error}</Typography> : null}
                    <JsonBlock data={event} maxHeight={260} />
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
