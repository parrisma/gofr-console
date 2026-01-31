import { Box, Typography } from '@mui/material';
import { Settings } from '@mui/icons-material';

export default function Operations() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="60vh"
    >
      <Settings sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
      <Typography variant="h4" gutterBottom>
        Operations
      </Typography>
      <Typography variant="body1" color="text.secondary">
        System operations and tools coming soon
      </Typography>
    </Box>
  );
}
