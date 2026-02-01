import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import { Search, People, ArrowBack, Person } from '@mui/icons-material';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { useConfig } from '../hooks/useConfig';
import type { JwtToken } from '../stores/configStore';

interface Client {
  client_guid: string;
  name: string;
  client_type: string | null;
  group_guid?: string;
  created_at?: string | null;
}

interface ClientProfile {
  client_guid: string;
  name: string;
  client_type: string | null;
  alert_frequency?: string;
  impact_threshold?: number;
  mandate_type?: string;
  benchmark?: string;
  horizon?: string;
  esg_constrained?: boolean;
  portfolio_guid?: string;
  watchlist_guid?: string;
  group_guid?: string;
  created_at?: string | null;
}

export default function GofrIQClients() {
  const { tokens } = useConfig();

  // Tab state
  const [activeTab, setActiveTab] = useState(0);

  // Token selection
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number>(-1);

  // Clients state
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected client for detail view
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Get selected token safely
  const selectedToken: JwtToken | null =
    selectedTokenIndex >= 0 && selectedTokenIndex < tokens.length
      ? tokens.at(selectedTokenIndex) ?? null
      : null;

  // Validate UUID format (36 chars with proper structure)
  const isValidGuid = (guid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(guid);
  };

  // Load clients when token is selected
  const fetchClients = useCallback(async () => {
    if (!selectedToken?.token) {
      setClients([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.listClients(selectedToken.token);
      const clientList = data.clients || [];
      
      // Check for invalid GUIDs
      const invalidClients = clientList.filter((c: Client) => !isValidGuid(c.client_guid));
      if (invalidClients.length > 0) {
        console.warn('Clients with invalid GUIDs:', invalidClients.map((c: Client) => c.client_guid));
        setError(`Warning: ${invalidClients.length} client(s) have invalid GUIDs and cannot be viewed in detail.`);
      }
      
      setClients(clientList);
    } catch (err) {
      setClients([]);
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [selectedToken?.token]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Load client profile when selected
  const fetchClientProfile = useCallback(async (clientGuid: string) => {
    if (!selectedToken?.token) return;
    
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await api.getClientProfile(selectedToken.token, clientGuid);
      setClientProfile(data);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to load client profile');
      setClientProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [selectedToken?.token]);

  // Handle client selection
  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setActiveTab(1);
    
    // Check for valid GUID before fetching profile
    if (!isValidGuid(client.client_guid)) {
      setProfileError(`Invalid client GUID format: "${client.client_guid}". Expected a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000).`);
      setClientProfile(null);
      return;
    }
    
    fetchClientProfile(client.client_guid);
  };

  // Handle back to list
  const handleBackToList = () => {
    setActiveTab(0);
    setSelectedClient(null);
    setClientProfile(null);
  };

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter((client) => client.name.toLowerCase().includes(query));
  }, [clients, searchQuery]);

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="h4">Client Management</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Manage investment clients and their portfolios.
      </Typography>

      {tokens.length === 0 && (
        <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
          No tokens configured. Add tokens in Operations to manage clients.
        </Alert>
      )}

      <Card sx={{ mt: 3, maxWidth: 900 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => {
            if (newValue === 0) handleBackToList();
            else setActiveTab(newValue);
          }}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<People />} iconPosition="start" label="List" />
          <Tab
            icon={<Person />}
            iconPosition="start"
            label={selectedClient?.name || 'Detail'}
            disabled={!selectedClient}
          />
        </Tabs>

        <CardContent>
          {/* Token Selection - shown in both tabs */}
          <FormControl fullWidth size="small" sx={{ mb: 3 }}>
            <InputLabel>Token (Group)</InputLabel>
            <Select
              value={selectedTokenIndex >= 0 ? selectedTokenIndex : ''}
              label="Token (Group)"
              onChange={(e) => {
                setSelectedTokenIndex(Number(e.target.value));
                handleBackToList();
              }}
              disabled={tokens.length === 0}
            >
              {tokens.length === 0 && (
                <MenuItem disabled>No tokens available</MenuItem>
              )}
              {tokens.map((token: JwtToken, index: number) => (
                <MenuItem key={index} value={index}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <span>{token.name}</span>
                    <Chip label={token.groups} size="small" color="secondary" variant="outlined" />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* LIST TAB */}
          {activeTab === 0 && (
            <Box>
              {error && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {!selectedToken && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Select a token to view clients.
                </Alert>
              )}

              {selectedToken && (
                <>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <Chip
                      label={`${filteredClients.length} client${filteredClients.length !== 1 ? 's' : ''}`}
                      size="small"
                    />
                    {loading && <CircularProgress size={18} sx={{ ml: 1 }} />}
                  </Box>

                  {/* Search */}
                  <TextField
                    placeholder="Search clients..."
                    size="small"
                    fullWidth
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{ mb: 2 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search />
                        </InputAdornment>
                      ),
                    }}
                  />

                  {/* Clients List */}
                  {filteredClients.length === 0 && !loading && (
                    <Alert severity="info">
                      {searchQuery
                        ? 'No clients match your search.'
                        : 'No clients found for this group.'}
                    </Alert>
                  )}

                  {filteredClients.length > 0 && (
                    <List disablePadding>
                      {filteredClients.map((client, index) => (
                        <Box key={client.client_guid}>
                          <ListItemButton
                            onClick={() => handleClientClick(client)}
                            sx={{ borderRadius: 1 }}
                          >
                            <ListItemText
                              primary={client.name}
                              secondary={client.client_type}
                            />
                          </ListItemButton>
                          {index < filteredClients.length - 1 && <Divider />}
                        </Box>
                      ))}
                    </List>
                  )}
                </>
              )}
            </Box>
          )}

          {/* DETAIL TAB */}
          {activeTab === 1 && selectedClient && (
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={3}>
                <IconButton size="small" onClick={handleBackToList}>
                  <ArrowBack />
                </IconButton>
                <Typography variant="h6">{selectedClient.name}</Typography>
              </Box>

              {profileLoading && (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress />
                </Box>
              )}

              {profileError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {profileError}
                </Alert>
              )}

              {clientProfile && !profileLoading && (
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 200 }}>Name</TableCell>
                      <TableCell>{clientProfile.name}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Client Type</TableCell>
                      <TableCell>
                        {clientProfile.client_type ? (
                          <Chip label={clientProfile.client_type} size="small" color="primary" />
                        ) : (
                          <Typography variant="body2" color="text.secondary">N/A</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Alert Frequency</TableCell>
                      <TableCell>{clientProfile.alert_frequency || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Impact Threshold</TableCell>
                      <TableCell>{clientProfile.impact_threshold ?? 'N/A'}</TableCell>
                    </TableRow>
                    {clientProfile.mandate_type && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Mandate Type</TableCell>
                        <TableCell>{clientProfile.mandate_type}</TableCell>
                      </TableRow>
                    )}
                    {clientProfile.benchmark && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Benchmark</TableCell>
                        <TableCell>{clientProfile.benchmark}</TableCell>
                      </TableRow>
                    )}
                    {clientProfile.horizon && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Horizon</TableCell>
                        <TableCell>{clientProfile.horizon}</TableCell>
                      </TableRow>
                    )}
                    {clientProfile.esg_constrained !== undefined && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>ESG Constrained</TableCell>
                        <TableCell>
                          <Chip
                            label={clientProfile.esg_constrained ? 'Yes' : 'No'}
                            size="small"
                            color={clientProfile.esg_constrained ? 'success' : 'default'}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Client GUID</TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {clientProfile.client_guid}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    {clientProfile.portfolio_guid && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Portfolio GUID</TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace">
                            {clientProfile.portfolio_guid}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {clientProfile.watchlist_guid && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Watchlist GUID</TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace">
                            {clientProfile.watchlist_guid}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {clientProfile.group_guid && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Group GUID</TableCell>
                        <TableCell>
                          <Typography variant="caption" fontFamily="monospace">
                            {clientProfile.group_guid}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    {clientProfile.created_at && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                        <TableCell>
                          {new Date(clientProfile.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {!clientProfile && !profileLoading && !profileError && (
                <Alert severity="info">
                  Loading client details...
                </Alert>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
