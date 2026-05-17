import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { filterVisibleAgentTools } from '../../services/gofrAgent';
import type { AgentServiceStatus } from '../../types/gofrAgent';

export default function AgentCapabilitiesPanel({ services, error }: { services: AgentServiceStatus[]; error?: string | null }) {
  if (error) return <Alert severity="warning">{error}</Alert>;
  if (services.length === 0) return <Typography variant="body2" color="text.secondary">No services loaded.</Typography>;

  return (
    <Stack spacing={1}>
      {services.map((service) => {
        const tools = filterVisibleAgentTools(service.tools);
        return (
          <Accordion key={service.name} variant="outlined" disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>{service.name}</Typography>
                <Chip size="small" label={service.status} />
                <Chip size="small" label={`${tools.length} tools`} />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'grid', gap: 1 }}>
                {service.description ? <Typography variant="body2">{service.description}</Typography> : null}
                {service.error ? <Alert severity="warning">{service.error}</Alert> : null}
                {service.registration_error ? <Alert severity="warning">{service.registration_error}</Alert> : null}
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {tools.map((tool) => <Chip key={tool.name} size="small" label={tool.name} />)}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Hub: {service.supports_results_hub ? 'supported' : 'not advertised'}
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
}