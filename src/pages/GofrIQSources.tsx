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
} from '@mui/material';
import { Search, Storage, ShowChart } from '@mui/icons-material';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { useConfig } from '../hooks/useConfig';
import type { JwtToken } from '../stores/configStore';

interface Source {
  source_guid: string;
  name: string;
  type: string;
  region: string | null;
  languages: string[];
  trust_level: string;
  active: boolean;
}

interface Instrument {
  ticker: string;
  name: string;
  instrument_type: string;
  sector?: string;
  exchange?: string;
  currency?: string;
  company?: string;
}

export default function GofrIQSources() {
  const { tokens } = useConfig();

  // Sources state
  const [sources, setSources] = useState<Source[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [sourceSearch, setSourceSearch] = useState('');

  // Instruments state
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrumentsLoading, setInstrumentsLoading] = useState(false);
  const [instrumentsError, setInstrumentsError] = useState<string | null>(null);
  const [instrumentSearch, setInstrumentSearch] = useState('');

  // Get admin token
  const adminToken = useMemo(() => {
    const adminEntry = tokens.find((entry: JwtToken) => entry.name === 'admin');
    return adminEntry?.token;
  }, [tokens]);

  const fetchSources = useCallback(async () => {
    if (!adminToken) {
      setSourcesError('Admin token not configured. Add it in Operations.');
      return;
    }
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const data = await api.listSources(adminToken);
      setSources(data.sources || []);
    } catch {
      setSourcesError('Failed to fetch sources');
    } finally {
      setSourcesLoading(false);
    }
  }, [adminToken]);

  const fetchInstruments = useCallback(async () => {
    if (!adminToken) {
      setInstrumentsError('Admin token not configured. Add it in Operations.');
      return;
    }
    setInstrumentsLoading(true);
    setInstrumentsError(null);
    try {
      const data = await api.listInstruments(adminToken);
      setInstruments(data.instruments || []);
    } catch {
      setInstrumentsError('Failed to fetch instruments');
    } finally {
      setInstrumentsLoading(false);
    }
  }, [adminToken]);

  // Filter sources by search
  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return sources;
    const q = sourceSearch.toLowerCase();
    return sources.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.type.toLowerCase().includes(q) ||
        s.region?.toLowerCase().includes(q) ||
        s.languages?.some((l) => l.toLowerCase().includes(q))
    );
  }, [sources, sourceSearch]);

  // Filter instruments by search
  const filteredInstruments = useMemo(() => {
    if (!instrumentSearch.trim()) return instruments;
    const q = instrumentSearch.toLowerCase();
    return instruments.filter(
      (i) =>
        i.ticker?.toLowerCase().includes(q) ||
        i.name?.toLowerCase().includes(q) ||
        i.instrument_type?.toLowerCase().includes(q) ||
        i.sector?.toLowerCase().includes(q)
    );
  }, [instruments, instrumentSearch]);

  // Load data when admin token becomes available
  useEffect(() => {
    if (adminToken) {
      fetchSources();
      fetchInstruments();
    }
  }, [adminToken, fetchSources, fetchInstruments]);

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="h4">Intelligence Repository</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Knowledge graph sources and discovered financial instruments from ingested documents.
      </Typography>

      {/* Sources Card */}
      <Card sx={{ mt: 3, maxWidth: 800 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Storage color="primary" />
            <Typography variant="h6">Sources</Typography>
            <Chip
              label={`${sources.length} source${sources.length !== 1 ? 's' : ''}`}
              size="small"
            />
            {sourcesLoading && <CircularProgress size={18} sx={{ ml: 1 }} />}
          </Box>

          {sourcesError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {sourcesError}
            </Alert>
          )}

          {!adminToken && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Configure an "admin" token in Operations to view sources.
            </Alert>
          )}

          {sources.length > 0 && (
            <>
              <TextField
                size="small"
                placeholder="Search sources..."
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2, width: 300 }}
              />

              <Box
                sx={{
                  maxHeight: 400,
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {filteredSources.map((source) => (
                  <Box
                    key={source.source_guid || source.name}
                    sx={{
                      p: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {source.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {source.type} • {source.region || 'Global'}
                          {source.languages?.length > 0 && ` • ${source.languages.join(', ')}`}
                        </Typography>
                      </Box>
                      <Box display="flex" gap={1} alignItems="center">
                        <Chip
                          label={`Trust: ${source.trust_level}`}
                          size="small"
                          color={source.trust_level === 'high' ? 'success' : source.trust_level === 'medium' ? 'warning' : 'default'}
                          variant="outlined"
                        />
                        <Chip
                          label={source.active ? 'Active' : 'Inactive'}
                          size="small"
                          color={source.active ? 'success' : 'default'}
                        />
                      </Box>
                    </Box>
                  </Box>
                ))}
                {filteredSources.length === 0 && sourceSearch && (
                  <Box p={2} textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      No sources match "{sourceSearch}"
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* Instruments Card */}
      <Card sx={{ mt: 3, maxWidth: 800 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <ShowChart color="primary" />
            <Typography variant="h6">Instruments</Typography>
            <Chip
              label={`${instruments.length} instrument${instruments.length !== 1 ? 's' : ''}`}
              size="small"
            />
            {instrumentsLoading && <CircularProgress size={18} sx={{ ml: 1 }} />}
          </Box>

          {instrumentsError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {instrumentsError}
            </Alert>
          )}

          {!adminToken && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Configure an "admin" token in Operations to view instruments.
            </Alert>
          )}

          {instruments.length > 0 && (
            <>
              <TextField
                size="small"
                placeholder="Search instruments..."
                value={instrumentSearch}
                onChange={(e) => setInstrumentSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2, width: 300 }}
              />

              <Box
                sx={{
                  maxHeight: 400,
                  overflowY: 'auto',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {filteredInstruments.map((instrument) => (
                  <Box
                    key={instrument.ticker}
                    sx={{
                      p: 1.5,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontWeight="bold" color="primary">
                            {instrument.ticker}
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {instrument.name}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {instrument.sector || 'Unknown sector'}
                          {instrument.exchange && ` • ${instrument.exchange}`}
                          {instrument.currency && ` • ${instrument.currency}`}
                        </Typography>
                      </Box>
                      <Chip
                        label={instrument.instrument_type || 'STOCK'}
                        size="small"
                        color="info"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                ))}
                {filteredInstruments.length === 0 && instrumentSearch && (
                  <Box p={2} textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      No instruments match "{instrumentSearch}"
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
