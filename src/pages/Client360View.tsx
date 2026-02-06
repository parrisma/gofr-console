import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  AlertTitle,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Snackbar,
} from '@mui/material';
import ClientHeader from '../components/common/ClientHeader';
import ClientProfileEditDialog from '../components/client/ClientProfileEditDialog';
import { PortfolioPanel } from '../components/common/PortfolioPanel';
import { WatchlistPanel } from '../components/common/WatchlistPanel';
import { ClientNewsPanel } from '../components/common/ClientNewsPanel';
import { api } from '../services/api';
import { useConfig } from '../hooks/useConfig';
import type { JwtToken } from '../stores/configStore';
import type { ClientProfile as ClientProfileType, ClientProfileUpdate } from '../types/clientProfile';

interface Client {
  guid: string;
  name: string;
  client_type: string;
}

interface ClientProfile {
  name: string;
  client_type: string;
  alert_frequency?: string;
  impact_threshold?: number;
  mandate_type?: string;
  benchmark?: string;
  horizon?: string;
  esg_constrained?: boolean;
  turnover_rate?: number;
  mandate_text?: string;
}

interface ScoreBreakdown {
  holdings: { score: number; weight: number };
  mandate: { score: number; weight: number };
  constraints: { score: number; weight: number };
  engagement: { score: number; weight: number };
}

interface ProfileScore {
  score: number;
  breakdown: ScoreBreakdown;
  missing_fields: string[];
}

export default function Client360View() {
  const { tokens } = useConfig();
  
  // Token selection
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number>(-1);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientGuid, setSelectedClientGuid] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [profileScore, setProfileScore] = useState<ProfileScore | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  
  // Get selected token safely
  const selectedToken: JwtToken | null =
    selectedTokenIndex >= 0 && selectedTokenIndex < tokens.length
      ? tokens.at(selectedTokenIndex) ?? null
      : null;

  // Accept any non-empty string as a valid GUID
  const isValidGuid = (guid: string): boolean => {
    return Boolean(guid && guid.length > 0);
  };

  // Load clients when token changes
  useEffect(() => {
    if (!selectedToken?.token) {
      setClients([]);
      setSelectedClientGuid(null);
      setLoading(false);
      return;
    }
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToken]);

  // Load profile when client is selected
  useEffect(() => {
    if (selectedClientGuid && selectedToken?.token) {
      loadClientProfile(selectedClientGuid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientGuid, selectedToken]);

  const loadClients = async () => {
    if (!selectedToken?.token) return;
    
    setLoading(true);
    setError(null);

    try {
      const result = await api.listClients(selectedToken.token);
      console.log('Clients loaded:', result.clients?.map((c: Client) => ({ name: c.name, guid: c.guid })));
      
      // Filter clients to only those the user has permission to access
      // by testing profile access for each client
      const allClients = result.clients || [];
      const accessibleClients: Client[] = [];
      
      for (const client of allClients) {
        if (!isValidGuid(client.guid)) {
          continue; // Skip clients with invalid GUIDs
        }
        
        // Test if we can access this client's profile
        try {
          await api.getClientProfile(selectedToken.token, client.guid);
          accessibleClients.push(client);
        } catch (err) {
          // If profile fails to load, likely a permissions issue - skip this client
          console.log(`Skipping client ${client.name} (${client.guid}): no access`);
        }
      }
      
      setClients(accessibleClients);
      
      // Auto-select first accessible client
      if (accessibleClients.length > 0) {
        setSelectedClientGuid(accessibleClients[0].guid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const loadClientProfile = async (clientGuid: string) => {
    if (!isValidGuid(clientGuid) || !selectedToken?.token) {
      setClientProfile(null);
      setProfileScore(null);
      return;
    }

    setProfileLoading(true);

    try {
      // Fetch profile (required)
      const profileResponse = await api.getClientProfile(selectedToken.token, clientGuid);
      console.log('Profile loaded:', profileResponse);
      console.log('Profile response keys:', Object.keys(profileResponse));
      console.log('profile.mandate_text:', profileResponse.profile?.mandate_text);
      
      // Flatten nested structure from backend
      const flatProfile: ClientProfile = {
        name: profileResponse.name,
        client_type: profileResponse.client_type,
        // Extract from nested 'profile' object
        mandate_type: profileResponse.profile?.mandate_type,
        benchmark: profileResponse.profile?.benchmark,
        horizon: profileResponse.profile?.horizon,
        esg_constrained: profileResponse.profile?.esg_constrained,
        turnover_rate: profileResponse.profile?.turnover_rate,
        mandate_text: profileResponse.profile?.mandate_text,
        // Extract from nested 'settings' object
        alert_frequency: profileResponse.settings?.alert_frequency,
        impact_threshold: profileResponse.settings?.impact_threshold,
      };
      
      console.log('Flattened profile:', flatProfile);
      console.log('flatProfile.mandate_text:', flatProfile.mandate_text);
      setClientProfile(flatProfile);

      // Fetch score (optional - may fail if backend tool doesn't exist yet)
      try {
        const score = await api.getClientProfileScore(selectedToken.token, clientGuid);
        console.log('Profile score loaded:', score);
        setProfileScore(score);
      } catch (scoreErr) {
        console.warn('Failed to load profile score (tool may not exist yet):', scoreErr);
        setProfileScore(null);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setClientProfile(null);
      setProfileScore(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle edit dialog open
  const handleEditOpen = () => {
    setEditDialogOpen(true);
  };

  // Handle edit dialog close
  const handleEditClose = () => {
    setEditDialogOpen(false);
  };

  // Handle save from edit dialog
  const handleSaveProfile = async (updates: ClientProfileUpdate) => {
    if (!selectedClientGuid || !selectedToken?.token) {
      throw new Error('No client or token selected');
    }

    console.log('Saving profile updates:', updates);
    const result = await api.updateClientProfile(selectedToken.token, selectedClientGuid, updates);
    console.log('Profile update result:', result);
    
    // Refresh profile and score after successful update
    await loadClientProfile(selectedClientGuid);
    
    // Show success message
    setSnackbarMessage('Profile updated successfully');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <AlertTitle>Error Loading Clients</AlertTitle>
          {error}
        </Alert>
      </Box>
    );
  }

  const selectedClient = clients.find(c => c.guid === selectedClientGuid);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Client 360 View
      </Typography>
      
      {/* Token Selection */}
      <FormControl fullWidth size="small" sx={{ mb: 3, maxWidth: 400 }}>
        <InputLabel>Token (Group)</InputLabel>
        <Select
          value={selectedTokenIndex >= 0 ? selectedTokenIndex : ''}
          label="Token (Group)"
          onChange={(e) => setSelectedTokenIndex(Number(e.target.value))}
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

      <Box sx={{ display: 'flex', gap: 3, mt: 3 }}>
        {/* Left Sidebar: Client List */}
        <Paper sx={{ width: 300, flexShrink: 0 }}>
          <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}>
            <Typography variant="h6">Clients</Typography>
          </Box>
          <List sx={{ maxHeight: 'calc(100vh - 250px)', overflow: 'auto' }}>
            {clients.map((client) => {
              const isInvalidGuid = !isValidGuid(client.guid);
              return (
                <Box key={client.guid}>
                  <ListItem disablePadding>
                    <ListItemButton
                      selected={selectedClientGuid === client.guid}
                      onClick={() => {
                        console.log('Selecting client:', client.name, client.guid);
                        setSelectedClientGuid(client.guid);
                      }}
                      disabled={isInvalidGuid}
                    >
                      <ListItemText
                        primary={client.name}
                        secondary={isInvalidGuid ? 'Invalid GUID' : client.client_type}
                        secondaryTypographyProps={{
                          color: isInvalidGuid ? 'error' : 'text.secondary'
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                  <Divider key={`divider-${client.guid}`} />
                </Box>
              );
            })}
          </List>
        </Paper>

        {/* Main Content: Client 360 Dashboard */}
        <Box sx={{ flex: 1 }}>
          {!selectedClient && !loading && !selectedToken && (
            <Alert severity="warning">
              <AlertTitle>No Token Selected</AlertTitle>
              Select an authentication token from the dropdown above to load clients.
            </Alert>
          )}

          {!selectedClient && !loading && selectedToken && clients.length === 0 && (
            <Alert severity="info">
              <AlertTitle>No Clients Available</AlertTitle>
              No clients were found for the selected token ({selectedToken.name}). 
              This may mean no clients have been created yet, or this token does not have access to any clients.
            </Alert>
          )}

          {!selectedClient && !loading && selectedToken && clients.length > 0 && (
            <Alert severity="info">
              <AlertTitle>No Client Selected</AlertTitle>
              Select a client from the list to view their 360 profile.
            </Alert>
          )}

          {selectedClient && !isValidGuid(selectedClient.guid) && (
            <Alert severity="error">
              <AlertTitle>Invalid Client GUID</AlertTitle>
              Client GUID "{selectedClient.guid}" is not a valid UUID. This is a known backend data
              issue. Expected format: 36-character UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)
            </Alert>
          )}

          {selectedClient && isValidGuid(selectedClient.guid) && (
            <>
              {profileLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                  <CircularProgress />
                </Box>
              )}

              {!profileLoading && clientProfile && (
                <>
                  {/* Stage 5.2: Client Header "The Vitals" */}
                  <ClientHeader
                    name={clientProfile.name}
                    clientType={clientProfile.client_type}
                    mandateType={clientProfile.mandate_type}
                    benchmark={clientProfile.benchmark}
                    horizon={clientProfile.horizon}
                    alertFrequency={clientProfile.alert_frequency}
                    esgConstrained={clientProfile.esg_constrained}
                    impactThreshold={clientProfile.impact_threshold}
                    turnoverRate={clientProfile.turnover_rate}
                    mandateText={clientProfile.mandate_text}
                    restrictions={clientProfile.restrictions}
                    completenessScore={profileScore?.score}
                    scoreBreakdown={profileScore?.breakdown}
                    missingFields={profileScore?.missing_fields}
                    editable={true}
                    onEdit={handleEditOpen}
                  />

                  {/* Portfolio & News Side-by-Side */}
                  <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                    {/* Left: Portfolio & Watchlist */}
                    <Box sx={{ flex: 2 }}>
                      {/* Stage 5.3: Portfolio & Holdings */}
                      <Box sx={{ mb: 3 }}>
                        {selectedToken && selectedClientGuid && <PortfolioPanel clientGuid={selectedClientGuid} authToken={selectedToken.token} />}
                      </Box>

                      {/* Stage 5.4: Watchlist */}
                      <Box sx={{ mb: 3 }}>
                        {selectedToken && selectedClientGuid && (
                          <WatchlistPanel 
                            clientGuid={selectedClientGuid} 
                            authToken={selectedToken.token}
                            defaultImpactThreshold={clientProfile?.impact_threshold}
                          />
                        )}
                      </Box>
                    </Box>

                    {/* Right: News Feed */}
                    <Box sx={{ flex: 1, minWidth: 400 }}>
                      {selectedToken && selectedClient && selectedClientGuid && (
                        <ClientNewsPanel 
                          clientGuid={selectedClientGuid} 
                          clientName={selectedClient.name}
                          authToken={selectedToken.token}
                          impactThreshold={clientProfile?.impact_threshold}
                          restrictions={clientProfile?.restrictions}
                        />
                      )}
                    </Box>
                  </Box>
                </>
              )}

              {!profileLoading && !clientProfile && (
                <Alert severity="warning">
                  <AlertTitle>No Profile Data</AlertTitle>
                  Unable to load profile for selected client.
                </Alert>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Edit Profile Dialog */}
      {clientProfile && selectedClient && (
        <ClientProfileEditDialog
          open={editDialogOpen}
          onClose={handleEditClose}
          onSave={handleSaveProfile}
          profile={clientProfile as ClientProfileType}
          clientName={selectedClient.name}
        />
      )}

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
