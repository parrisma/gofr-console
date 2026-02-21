import { Box, AppBar, Toolbar, Typography, Drawer, IconButton } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BuildIcon from '@mui/icons-material/Build';
import UserBadge from './UserBadge';

const drawerWidth = 60;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: <DashboardIcon />, label: 'Dashboard' },
    { path: '/operations', icon: <BuildIcon />, label: 'Operations' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              component="img"
              src="/logo.png"
              alt="GOFR"
              sx={{ height: 28, width: 28, objectFit: 'contain' }}
            />
            <Typography variant="h6" noWrap component="div">
              GOFR Console
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <UserBadge />
        </Toolbar>
      </AppBar>
      
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2 }}>
          <IconButton
            onClick={() => navigate('/')}
            aria-label="Go to home"
            sx={{ mb: 2 }}
          >
            <Box
              component="img"
              src="/logo.png"
              alt="GOFR"
              sx={{ height: 32, width: 32, objectFit: 'contain' }}
            />
          </IconButton>
          {navItems.map((item) => (
            <IconButton
              key={item.path}
              color={location.pathname === item.path ? 'primary' : 'inherit'}
              onClick={() => navigate(item.path)}
              sx={{ mb: 2 }}
              title={item.label}
            >
              {item.icon}
            </IconButton>
          ))}
        </Box>
      </Drawer>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
