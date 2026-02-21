import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

function humanise(value: string): string {
  // Convert kebab-case or snake_case to title case
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function UserBadge() {
  const navigate = useNavigate();
  const { user, authenticated, logout } = useAuth();

  if (!authenticated || !user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography variant="body2" noWrap>
        {user.displayName}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7 }} noWrap>
        |
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7 }} noWrap>
        {humanise(user.userType)}
      </Typography>
      <Typography variant="body2" sx={{ opacity: 0.7 }} noWrap>
        |
      </Typography>
      <Button
        color="inherit"
        size="small"
        onClick={handleLogout}
        sx={{ textTransform: 'none', minWidth: 0 }}
      >
        Logout
      </Button>
    </Box>
  );
}
