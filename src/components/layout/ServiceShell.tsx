import type { ReactNode } from 'react';
import { Box, AppBar, Toolbar, Typography, Drawer, IconButton, Breadcrumbs, Link } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowBack, MonitorHeart, Storage, FileUpload, People, Dashboard } from '@mui/icons-material';

import HelpPopupIcon from '../common/HelpPopupIcon';

const drawerWidth = 60;

interface ServiceShellNavItem {
  path: string;
  icon: ReactNode;
  label: string;
}

interface ServiceShellProps {
  children: ReactNode;
  serviceName: string;
  serviceRoute: string;
  navItems?: ServiceShellNavItem[];
}

export default function ServiceShell({ children, serviceName, serviceRoute, navItems }: ServiceShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const helpText = (() => {
    if (serviceName === 'GOFR-IQ') {
      return [
        'GOFR-IQ quick start',
        '',
        '1) Select a token (controls the client group you can access)',
        '2) Open Client 360 and pick a client',
        '3) Review portfolio + watchlist + news',
        '4) Update mandate / restrictions as needed',
        '',
        'Tip: If you see empty lists, double-check you selected the intended token/group in Operations.',
      ];
    }
    if (serviceName === 'GOFR-DIG') {
      return [
        'GOFR-DIG quick start',
        '',
        '1) Select a token (this defines the storage/access group)',
        '2) Paste the URL you want to scrape',
        '3) Apply anti-detection settings',
        '4) Analyse structure (optional selectors)',
        '5) Fetch content (session mode for large scrapes)',
        '',
        'Tip: Use Sessions to browse chunked results and re-use URLs in automation.',
      ];
    }
    if (serviceName === 'GOFR-DOC') {
      return [
        'GOFR-DOC quick start',
        '',
        '1) Discovery: pick template_id (and optional style_id)',
        '2) Sessions: create a session (save session_id)',
        '3) Builder: set global parameters, then add fragments',
        '4) Render: generate HTML/PDF/Markdown (proxy for large outputs)',
        '',
        'Tip: Sessions/Builder/Render require a token. Discovery tools do not.',
      ];
    }
    if (serviceName === 'GOFR-PLOT') {
      return [
        'GOFR-PLOT quick start',
        '',
        '1) Discovery: browse themes and chart types (no token required)',
        '2) Builder: select a token, render a plot (inline or proxy)',
        '3) Sessions: list stored proxy images and fetch via get_image',
        '4) Embed: in Builder, add_plot_fragment into a GOFR-DOC session',
        '',
        'Tip: Plot tools are served by GOFR-DOC (not a separate plot service).',
      ];
    }
    return ['Help is not available for this service yet.'];
  })();

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
          <Box sx={{ ml: 1 }}>
            <HelpPopupIcon title={`${serviceName} help`} body={helpText} />
          </Box>
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
