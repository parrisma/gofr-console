import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: '#121212', paper: '#1E1E1E' },
    primary: { main: '#00E5FF' },
    secondary: { main: '#7C4DFF' },
    success: { main: '#00C853' },
    error: { main: '#FF1744' },
  },
});
