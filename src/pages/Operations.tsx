import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  IconButton,
  Chip,
  Button,
  Divider,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Settings,
  Edit,
  Check,
  Close,
  RestartAlt,
  Science,
  Business,
  Add,
  Delete,
  Key,
  ContentCopy,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useConfig } from '../hooks/useConfig';
import type { Environment, ServicePorts, JwtToken } from '../stores/configStore';

interface EditState {
  serviceName: string;
  env: Environment;
  field: 'mcp' | 'mcpo' | 'web';
  value: string;
}

interface TokenDialogState {
  open: boolean;
  mode: 'add' | 'edit';
  index?: number;
  name: string;
  groups: string;
  token: string;
}

export default function Operations() {
  const {
    environment,
    mcpServices,
    infraServices,
    tokens,
    setEnvironment,
    updateMcpServicePorts,
    resetToDefaults,
    addToken,
    updateToken,
    deleteToken,
  } = useConfig();

  const [editState, setEditState] = useState<EditState | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [tokenDialog, setTokenDialog] = useState<TokenDialogState>({
    open: false,
    mode: 'add',
    name: '',
    groups: '',
    token: '',
  });
  const [visibleTokens, setVisibleTokens] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const handleEnvironmentChange = (
    _event: React.MouseEvent<HTMLElement>,
    newEnv: Environment | null
  ) => {
    if (newEnv) {
      setEnvironment(newEnv);
    }
  };

  const startEdit = (serviceName: string, env: Environment, field: EditState['field'], currentValue: number) => {
    setEditState({ serviceName, env, field, value: String(currentValue) });
  };

  const cancelEdit = () => {
    setEditState(null);
  };

  const saveEdit = () => {
    if (!editState) return;
    const port = parseInt(editState.value, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      return; // Invalid port
    }

    // MCP service - need to get current ports and update one field
    const service = mcpServices.find(s => s.name === editState.serviceName);
    if (service) {
      const currentPorts = service.ports[editState.env];
      const newPorts: ServicePorts = {
        ...currentPorts,
        [editState.field]: port,
      };
      updateMcpServicePorts(editState.serviceName, editState.env, newPorts);
    }
    setEditState(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Token management functions
  const openAddToken = () => {
    setTokenDialog({
      open: true,
      mode: 'add',
      name: '',
      groups: '',
      token: '',
    });
  };

  const openEditToken = (index: number) => {
    const t = tokens.find((_, i) => i === index);
    if (!t) {
      return;
    }
    setTokenDialog({
      open: true,
      mode: 'edit',
      index,
      name: t.name,
      groups: t.groups,
      token: t.token,
    });
  };

  const closeTokenDialog = () => {
    setTokenDialog({
      open: false,
      mode: 'add',
      name: '',
      groups: '',
      token: '',
    });
  };

  const saveTokenDialog = () => {
    const tokenData: JwtToken = {
      name: tokenDialog.name.trim(),
      groups: tokenDialog.groups.trim(),
      token: tokenDialog.token.trim(),
    };
    if (!tokenData.name || !tokenData.groups || !tokenData.token) return;

    if (tokenDialog.mode === 'add') {
      addToken(tokenData);
    } else if (tokenDialog.index !== undefined) {
      updateToken(tokenDialog.index, tokenData);
    }
    closeTokenDialog();
  };

  const toggleTokenVisibility = (index: number) => {
    setVisibleTokens((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
  };

  const confirmDeleteToken = (index: number) => {
    deleteToken(index);
    setDeleteConfirm(null);
  };

  const renderPortCell = (serviceName: string, env: Environment, field: EditState['field'], port: number) => {
    const isEditing = editState?.serviceName === serviceName && editState?.env === env && editState?.field === field;
    const isActiveEnv = env === environment;

    if (isEditing) {
      return (
        <Box display="flex" alignItems="center" gap={0.5}>
          <TextField
            size="small"
            value={editState.value}
            onChange={(e) => setEditState({ ...editState, value: e.target.value })}
            onKeyDown={handleKeyDown}
            autoFocus
            sx={{ width: 80 }}
            inputProps={{ style: { textAlign: 'center' } }}
          />
          <IconButton size="small" color="primary" onClick={saveEdit}>
            <Check fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={cancelEdit}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      );
    }

    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            fontWeight: isActiveEnv ? 'bold' : 'normal',
            color: isActiveEnv ? 'primary.main' : 'text.secondary',
          }}
        >
          {port}
        </Typography>
        <Tooltip title={`Edit ${env} port`}>
          <IconButton
            size="small"
            onClick={() => startEdit(serviceName, env, field, port)}
            sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
          >
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={1}>
        <Settings sx={{ fontSize: 32, color: 'primary.main' }} />
        <Typography variant="h4">Operations</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Environment configuration and service port management
      </Typography>

      {/* Environment Toggle */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Active Environment
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select which environment the console connects to
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={environment}
              exclusive
              onChange={handleEnvironmentChange}
              size="large"
            >
              <ToggleButton value="prod" sx={{ px: 4 }}>
                <Business sx={{ mr: 1 }} />
                Production
              </ToggleButton>
              <ToggleButton value="dev" sx={{ px: 4 }}>
                <Science sx={{ mr: 1 }} />
                Development
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Alert severity="info" sx={{ mt: 2 }}>
            Currently using <strong>{environment === 'prod' ? 'Production' : 'Development'}</strong> ports.
            Changes take effect immediately for new connections.
          </Alert>
        </CardContent>
      </Card>

      {/* MCP Services */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            MCP Services
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Model Context Protocol server ports. Click the edit icon to modify.
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Service</strong></TableCell>
                  <TableCell align="center" colSpan={3}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                      <Business fontSize="small" />
                      Production
                    </Box>
                  </TableCell>
                  <TableCell align="center" colSpan={3}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                      <Science fontSize="small" />
                      Development
                    </Box>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell align="center"><Typography variant="caption">MCP</Typography></TableCell>
                  <TableCell align="center"><Typography variant="caption">MCPO</Typography></TableCell>
                  <TableCell align="center"><Typography variant="caption">Web</Typography></TableCell>
                  <TableCell align="center"><Typography variant="caption">MCP</Typography></TableCell>
                  <TableCell align="center"><Typography variant="caption">MCPO</Typography></TableCell>
                  <TableCell align="center"><Typography variant="caption">Web</Typography></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mcpServices.map((service) => (
                  <TableRow key={service.name} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight="medium">
                          {service.displayName}
                        </Typography>
                        <Chip
                          label={service.containerHostname}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      {renderPortCell(service.name, 'prod', 'mcp', service.ports.prod.mcp)}
                    </TableCell>
                    <TableCell align="center">
                      {renderPortCell(service.name, 'prod', 'mcpo', service.ports.prod.mcpo)}
                    </TableCell>
                    <TableCell align="center">
                      {renderPortCell(service.name, 'prod', 'web', service.ports.prod.web)}
                    </TableCell>
                    <TableCell align="center">
                      {renderPortCell(service.name, 'dev', 'mcp', service.ports.dev.mcp)}
                    </TableCell>
                    <TableCell align="center">
                      {renderPortCell(service.name, 'dev', 'mcpo', service.ports.dev.mcpo)}
                    </TableCell>
                    <TableCell align="center">
                      {renderPortCell(service.name, 'dev', 'web', service.ports.dev.web)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Infrastructure Services - Read Only */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="h6">
              Infrastructure Services
            </Typography>
            <Chip label="Read Only" size="small" color="default" />
          </Box>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Database and supporting service ports. Managed by GOFR-IQ.
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Service</strong></TableCell>
                  <TableCell align="center">
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                      <Business fontSize="small" />
                      Production
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                      <Science fontSize="small" />
                      Development
                    </Box>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {infraServices.map((service) => (
                  <TableRow key={service.name} hover>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight="medium">
                          {service.displayName}
                        </Typography>
                        <Chip
                          label={service.containerHostname}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          color: environment === 'prod' ? 'primary.main' : 'text.secondary',
                          fontWeight: environment === 'prod' ? 'bold' : 'normal',
                        }}
                      >
                        {service.ports.prod}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          color: environment === 'dev' ? 'primary.main' : 'text.secondary',
                          fontWeight: environment === 'dev' ? 'bold' : 'normal',
                        }}
                      >
                        {service.ports.dev}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* JWT Tokens */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Key color="primary" />
              <Typography variant="h6">JWT Tokens</Typography>
              <Chip label={`${tokens.length} token${tokens.length !== 1 ? 's' : ''}`} size="small" />
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={openAddToken}
              size="small"
            >
              Add Token
            </Button>
          </Box>

          {tokens.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No JWT tokens configured. Add a token to enable group-based access control.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Groups</TableCell>
                    <TableCell>Token</TableCell>
                    <TableCell align="center" width={140}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tokens.map((t, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {t.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={t.groups} size="small" color="secondary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              maxWidth: 250,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {visibleTokens.has(index)
                              ? t.token
                              : `${t.token.substring(0, 20)}${'•'.repeat(20)}`}
                          </Typography>
                          <Tooltip title={visibleTokens.has(index) ? 'Hide' : 'Show'}>
                            <IconButton size="small" onClick={() => toggleTokenVisibility(index)}>
                              {visibleTokens.has(index) ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Copy token">
                            <IconButton size="small" onClick={() => copyToken(t.token)}>
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        {deleteConfirm === index ? (
                          <Box display="flex" gap={0.5} justifyContent="center">
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              onClick={() => confirmDeleteToken(index)}
                            >
                              Delete
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setDeleteConfirm(null)}
                            >
                              Cancel
                            </Button>
                          </Box>
                        ) : (
                          <Box display="flex" gap={0.5} justifyContent="center">
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => openEditToken(index)}>
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => setDeleteConfirm(index)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Token Add/Edit Dialog */}
      <Dialog open={tokenDialog.open} onClose={closeTokenDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {tokenDialog.mode === 'add' ? 'Add JWT Token' : 'Edit JWT Token'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Name"
              value={tokenDialog.name}
              onChange={(e) => setTokenDialog({ ...tokenDialog, name: e.target.value })}
              placeholder="e.g., sim-us-sales"
              fullWidth
              size="small"
            />
            <TextField
              label="Groups"
              value={tokenDialog.groups}
              onChange={(e) => setTokenDialog({ ...tokenDialog, groups: e.target.value })}
              placeholder="e.g., us_sales"
              fullWidth
              size="small"
              helperText="Group name used for access control"
            />
            <TextField
              label="JWT Token"
              value={tokenDialog.token}
              onChange={(e) => setTokenDialog({ ...tokenDialog, token: e.target.value })}
              placeholder="Paste the full JWT token"
              fullWidth
              multiline
              rows={4}
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTokenDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={saveTokenDialog}
            disabled={!tokenDialog.name.trim() || !tokenDialog.groups.trim() || !tokenDialog.token.trim()}
          >
            {tokenDialog.mode === 'add' ? 'Add' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset */}
      <Divider sx={{ my: 3 }} />
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="body2" color="text.secondary">
            Reset MCP port configurations to default values
          </Typography>
        </Box>
        {showResetConfirm ? (
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={() => {
                resetToDefaults();
                setShowResetConfirm(false);
              }}
            >
              Confirm Reset
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowResetConfirm(false)}
            >
              Cancel
            </Button>
          </Box>
        ) : (
          <Button
            variant="outlined"
            color="warning"
            startIcon={<RestartAlt />}
            onClick={() => setShowResetConfirm(true)}
          >
            Reset to Defaults
          </Button>
        )}
      </Box>
    </Box>
  );
}
