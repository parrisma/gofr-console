import { Box, Paper, Typography, Chip, Stack, Divider } from '@mui/material';
import { Warning } from '@mui/icons-material';

interface ClientHeaderProps {
  name: string;
  clientType: string;
  mandateType?: string;
  alertFrequency?: string;
  esgConstrained?: boolean;
  impactThreshold?: number;
  turnoverRate?: number;
}

export default function ClientHeader({
  name,
  clientType,
  mandateType,
  alertFrequency,
  esgConstrained,
  impactThreshold,
  turnoverRate,
}: ClientHeaderProps) {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack spacing={2}>
        {/* Client Name & Type */}
        <Box>
          <Typography variant="h4" gutterBottom>
            {name}
          </Typography>
          <Chip label={clientType} color="primary" />
        </Box>

        <Divider />

        {/* Key Profile Info */}
        <Stack direction="row" spacing={3} flexWrap="wrap">
          {mandateType && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Mandate Profile
              </Typography>
              <Typography variant="h6" sx={{ mt: 0.5 }}>
                {mandateType}
              </Typography>
            </Box>
          )}

          {alertFrequency && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Alert Frequency
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {alertFrequency}
              </Typography>
            </Box>
          )}

          {impactThreshold !== undefined && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Impact Threshold
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {impactThreshold}
              </Typography>
            </Box>
          )}

          {turnoverRate !== undefined && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Turnover Rate
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {(turnoverRate * 100).toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Stack>

        {/* Constraints & Flags */}
        {esgConstrained && (
          <>
            <Divider />
            <Box>
              <Chip
                icon={<Warning />}
                label="ESG Constrained"
                color="error"
                sx={{ mr: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                This client has ESG investment restrictions
              </Typography>
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}
