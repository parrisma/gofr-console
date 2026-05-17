import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import JsonBlock from '../common/JsonBlock';
import type { AgentProvenanceRecord } from '../../types/gofrAgent';

export default function AgentProvenancePanel({ provenance }: { provenance: AgentProvenanceRecord[] }) {
  if (provenance.length === 0) return <Typography variant="body2" color="text.secondary">No provenance returned.</Typography>;
  return (
    <Stack spacing={1}>
      {provenance.map((record, index) => (
        <Accordion key={`${record.request_id}-${record.service}-${record.tool}-${index}`} variant="outlined" disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">
              {record.service}/{record.tool} {record.ok ? 'ok' : 'failed'}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption" color="text.secondary">
              as_of: {record.as_of ?? 'not provided'}
            </Typography>
            <JsonBlock data={record} maxHeight={260} />
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  );
}