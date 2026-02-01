import { Box, AppBar, Toolbar, Typography, Drawer, IconButton, Breadcrumbs, Link } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowBack, MonitorHeart, Storage, FileUpload, People, Dashboard } from '@mui/icons-material';

const drawerWidth = 60;

interface ServiceShellProps {
  children: React.ReactNode;
  serviceName: string;
  serviceRoute: string;
}

export default function ServiceShell({ children, serviceName, serviceRoute }: ServiceShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: `${serviceRoute}/health`, icon: <MonitorHeart />, label: 'Health' },
    { path: `${serviceRoute}/sources`, icon: <Storage />, label: 'Sources' },
    { path: `${serviceRoute}/clients`, icon: <People />, label: 'Clients' },
    { path: `${serviceRoute}/client-360`, icon: <Dashboard />, label: 'Client 360' },
    { path: `${serviceRoute}/ingest`, icon: <FileUpload />, label: 'Ingest' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => navigate('/')}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Breadcrumbs sx={{ color: 'white' }}>
            <Link
              color="inherit"
              onClick={() => navigate('/')}
              sx={{ cursor: 'pointer', textDecoration: 'none' }}
            >
              GOFR Console
            </Link>
            <Typography color="inherit">{serviceName}</Typography>
          </Breadcrumbs>
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

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
