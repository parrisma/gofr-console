import { Accordion, AccordionDetails, AccordionSummary, Box, Chip, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import JsonBlock from '../common/JsonBlock';
import type { AgentReasoningEvent } from '../../types/gofrAgent';

function eventTitle(event: AgentReasoningEvent): string {
  const service = typeof event.service === 'string' ? event.service : '';
  const tool = typeof event.tool === 'string' ? event.tool : '';
  if (service && tool) return `${event.kind}: ${service}/${tool}`;
  return event.kind;
}

export default function AgentRunTrace({ events }: { events: AgentReasoningEvent[] }) {
  if (events.length === 0) {
    return <Typography variant="body2" color="text.secondary">No reasoning events yet.</Typography>;
  }

  return (
    <Box sx={{ maxHeight: 184, overflowY: 'auto', pr: 0.5 }}>
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
  );
}