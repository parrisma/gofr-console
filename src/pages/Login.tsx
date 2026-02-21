import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await login(username, password);
      if (ok) {
        navigate('/');
      } else {
        setError('Invalid username or password');
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: 380, p: 2, textAlign: 'center' }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Box
              component="img"
              src="/logo.png"
              alt="GOFR"
              sx={{ height: 48, width: 48, objectFit: 'contain', mb: 1 }}
            />
            <Typography variant="h5" component="h1">
              GOFR Console
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              autoFocus
              margin="normal"
              size="small"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              margin="normal"
              size="small"
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !username || !password}
              sx={{ mt: 2 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
