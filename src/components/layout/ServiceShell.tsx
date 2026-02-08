import { Box, AppBar, Toolbar, Typography, Drawer, IconButton, Breadcrumbs, Link } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowBack, MonitorHeart, Storage, FileUpload, People, Dashboard } from '@mui/icons-material';

const drawerWidth = 60;

interface ServiceShellNavItem {
  path: string;
  icon: React.ReactNode;
  label: string;
}

interface ServiceShellProps {
  children: React.ReactNode;
  serviceName: string;
  serviceRoute: string;
  navItems?: ServiceShellNavItem[];
}

export default function ServiceShell({ children, serviceName, serviceRoute, navItems }: ServiceShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const defaultNavItems: ServiceShellNavItem[] = [
    { path: `${serviceRoute}/health`, icon: <MonitorHeart />, label: 'Health' },
    { path: `${serviceRoute}/sources`, icon: <Storage />, label: 'Sources' },
    { path: `${serviceRoute}/clients`, icon: <People />, label: 'Clients' },
    { path: `${serviceRoute}/client-360`, icon: <Dashboard />, label: 'Client 360' },
    { path: `${serviceRoute}/ingest`, icon: <FileUpload />, label: 'Ingest' },
  ];

  const resolvedNavItems = navItems ?? defaultNavItems;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
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
          {resolvedNavItems.map((item) => (
            <IconButton
              key={item.label}
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
