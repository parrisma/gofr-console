import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import { useState } from 'react';
import { api } from '../services/api';
import { useConfig } from '../hooks/useConfig';
import type { JwtToken } from '../stores/configStore';
import type {
  AntiDetectionResponse,
  ContentResponse,
  PageStructureResponse,
  SessionChunkResponse,
  SessionInfoResponse,
  ProfileType,
} from '../types/gofrDig';

const PROFILE_OPTIONS: Array<{ value: ProfileType; label: string; description: string }> = [
  { value: 'balanced', label: 'Balanced', description: 'Recommended for most sites' },
  { value: 'stealth', label: 'Stealth', description: 'Stronger bot detection avoidance' },
  { value: 'none', label: 'None', description: 'Fastest; minimal headers' },
  { value: 'browser_tls', label: 'Browser TLS', description: 'TLS fingerprinting sensitive sites' },
  { value: 'custom', label: 'Custom', description: 'Custom headers and UA' },
];

function JsonBlock({ data }: { data: unknown }) {
  if (!data) return null;
  return (
    <Box
      component="pre"
      sx={{
        mt: 2,
        p: 2,
        bgcolor: 'background.paper',
        borderRadius: 1,
        overflow: 'auto',
        fontSize: 12,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {JSON.stringify(data, null, 2)}
    </Box>
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function toInteger(value: number, min: number, max: number): number {
  const normalized = Math.trunc(value);
  return clampNumber(normalized, min, max);
}

function formatToolError(tool: string, err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  if (message.toLowerCase().includes(tool)) return message;
  return `${tool} failed: ${message}`;
}

export default function GofrDig() {
  const { tokens } = useConfig();

  // Token selection
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number>(-1);
  const selectedToken: JwtToken | null =
    selectedTokenIndex >= 0 && selectedTokenIndex < tokens.length
      ? tokens.at(selectedTokenIndex) ?? null
      : null;

  // Shared target URL for Structure & Content
  const [targetUrl, setTargetUrl] = useState('');

  // Anti-detection
  const [profile, setProfile] = useState<ProfileType>('balanced');
  const [respectRobots, setRespectRobots] = useState(true);
  const [rateLimitDelay, setRateLimitDelay] = useState(1.0);
  const [maxTokens, setMaxTokens] = useState(100000);
  const [customHeadersText, setCustomHeadersText] = useState('{\n  "Accept-Language": "en-US"\n}');
  const [customUserAgent, setCustomUserAgent] = useState('');
  const [antiLoading, setAntiLoading] = useState(false);
  const [antiError, setAntiError] = useState<string | null>(null);
  const [antiResponse, setAntiResponse] = useState<AntiDetectionResponse | null>(null);

  // Structure
  const [includeNav, setIncludeNav] = useState(true);
  const [includeInternalLinks, setIncludeInternalLinks] = useState(true);
  const [includeExternalLinks, setIncludeExternalLinks] = useState(true);
  const [includeForms, setIncludeForms] = useState(true);
  const [includeOutline, setIncludeOutline] = useState(true);
  const [structureLoading, setStructureLoading] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [structureResponse, setStructureResponse] = useState<PageStructureResponse | null>(null);

  // Content
  const [contentSelector, setContentSelector] = useState('');
  const [depth, setDepth] = useState(1);
  const [maxPages, setMaxPages] = useState(5);
  const [includeLinks, setIncludeLinks] = useState(true);
  const [includeImages, setIncludeImages] = useState(false);
  const [includeMeta, setIncludeMeta] = useState(true);
  const [sessionMode, setSessionMode] = useState(false);
  const [chunkSize, setChunkSize] = useState(4000);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentResponse, setContentResponse] = useState<ContentResponse | null>(null);
  const [contentTab, setContentTab] = useState(0);

  // Session
  const [sessionId, setSessionId] = useState('');
  const [chunkIndex, setChunkIndex] = useState(0);
  const [sessionInfoLoading, setSessionInfoLoading] = useState(false);
  const [sessionChunkLoading, setSessionChunkLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfoResponse | null>(null);
  const [sessionChunk, setSessionChunk] = useState<SessionChunkResponse | null>(null);

  const requireToken = (): string | undefined => selectedToken?.token;

  const handleApplyAntiDetection = async () => {
    setAntiLoading(true);
    setAntiError(null);
    try {
      let customHeaders: Record<string, string> | undefined;
      if (profile === 'custom' && customHeadersText.trim()) {
        try {
          customHeaders = JSON.parse(customHeadersText) as Record<string, string>;
        } catch {
          throw new Error('Invalid custom headers JSON. Use a valid object with string values.');
        }
      }

      const normalizedRateLimit = clampNumber(rateLimitDelay, 0, 60);
      const normalizedMaxTokens = toInteger(maxTokens, 1000, 1000000);

      const response = await api.digSetAntiDetection(requireToken(), {
        profile,
        respect_robots_txt: respectRobots,
        rate_limit_delay: normalizedRateLimit,
        max_tokens: normalizedMaxTokens,
        custom_headers: customHeaders,
        custom_user_agent: profile === 'custom' ? customUserAgent || undefined : undefined,
      });
      setAntiResponse(response);
    } catch (err) {
      setAntiError(formatToolError('set_antidetection', err, 'Failed to apply anti-detection settings'));
      setAntiResponse(null);
    } finally {
      setAntiLoading(false);
    }
  };

  const handleAnalyzeStructure = async () => {
    setStructureLoading(true);
    setStructureError(null);
    try {
      if (!targetUrl.trim()) {
        throw new Error('URL is required');
      }
      const response = await api.digGetStructure(requireToken(), targetUrl.trim(), {
        include_navigation: includeNav,
        include_internal_links: includeInternalLinks,
        include_external_links: includeExternalLinks,
        include_forms: includeForms,
        include_outline: includeOutline,
      });
      setStructureResponse(response);
    } catch (err) {
      setStructureError(formatToolError('get_structure', err, 'Failed to analyze structure'));
      setStructureResponse(null);
    } finally {
      setStructureLoading(false);
    }
  };

  const handleFetchContent = async () => {
    setContentLoading(true);
    setContentError(null);
    try {
      if (!targetUrl.trim()) {
        throw new Error('URL is required');
      }
      const normalizedDepth = toInteger(depth, 1, 3);
      const normalizedMaxPages = toInteger(maxPages, 1, 20);
      const normalizedChunkSize = toInteger(chunkSize, 500, 10000);
      const response = await api.digGetContent(requireToken(), targetUrl.trim(), {
        selector: contentSelector.trim() || undefined,
        depth: normalizedDepth,
        max_pages_per_level: normalizedMaxPages,
        include_links: includeLinks,
        include_images: includeImages,
        include_meta: includeMeta,
        session: sessionMode,
        chunk_size: sessionMode ? normalizedChunkSize : undefined,
      });
      setContentResponse(response);
      if (response.session_id) {
        setSessionId(response.session_id);
        if (response.total_chunks !== undefined) {
          setChunkIndex(0);
        }
      }
    } catch (err) {
      setContentError(formatToolError('get_content', err, 'Failed to fetch content'));
      setContentResponse(null);
    } finally {
      setContentLoading(false);
    }
  };

  const handleSessionInfo = async () => {
    setSessionInfoLoading(true);
    setSessionError(null);
    try {
      if (!sessionId.trim()) {
        throw new Error('Session ID is required');
      }
      const response = await api.digGetSessionInfo(requireToken(), sessionId.trim());
      setSessionInfo(response);
    } catch (err) {
      setSessionError(formatToolError('get_session_info', err, 'Failed to load session info'));
      setSessionInfo(null);
    } finally {
      setSessionInfoLoading(false);
    }
  };

  const handleSessionChunk = async () => {
    setSessionChunkLoading(true);
    setSessionError(null);
    try {
      if (!sessionId.trim()) {
        throw new Error('Session ID is required');
      }
      const normalizedChunkIndex = toInteger(chunkIndex, 0, Number.MAX_SAFE_INTEGER);
      const response = await api.digGetSessionChunk(requireToken(), sessionId.trim(), normalizedChunkIndex);
      setSessionChunk(response);
    } catch (err) {
      setSessionError(formatToolError('get_session_chunk', err, 'Failed to load session chunk'));
      setSessionChunk(null);
    } finally {
      setSessionChunkLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Typography variant="h4">GOFR-DIG</Typography>
        <Chip label="MCP" size="small" />
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Test and explore GOFR-DIG scraping features via MCP before automating workflows.
      </Typography>

      {/* ① Token & Target */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>①</Box>
            Token & Target URL
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select an access token, then enter the URL you want to scrape.
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="dig-token-label">Token</InputLabel>
            <Select
              labelId="dig-token-label"
              value={selectedTokenIndex}
              label="Token"
              onChange={(e) => setSelectedTokenIndex(Number(e.target.value))}
            >
              <MenuItem value={-1}>
                <em>Select token</em>
              </MenuItem>
              {tokens.map((token, index) => (
                <MenuItem key={token.name} value={index}>
                  {token.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Target URL"
            placeholder="https://example.com"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            fullWidth
            disabled={!selectedToken}
          />
        </CardContent>
      </Card>

      {/* ② Anti-Detection */}
      <Card sx={{ mt: 3, opacity: selectedToken ? 1 : 0.5, pointerEvents: selectedToken ? 'auto' : 'none' }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">
              <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>②</Box>
              Anti-Detection Settings
            </Typography>
            {antiLoading && <CircularProgress size={20} />}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure scraping profile before fetching. Applied server-side for the session.
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="dig-profile-label">Profile</InputLabel>
            <Select
              labelId="dig-profile-label"
              value={profile}
              label="Profile"
              onChange={(e) => setProfile(e.target.value as ProfileType)}
            >
              {PROFILE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label} — {option.description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={respectRobots}
                onChange={(e) => setRespectRobots(e.target.checked)}
              />
            }
            label="Respect robots.txt"
          />

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2} mt={2}>
            <TextField
              label="Rate limit delay (seconds)"
              type="number"
              value={rateLimitDelay}
              onChange={(e) => setRateLimitDelay(Number(e.target.value))}
              inputProps={{ min: 0, max: 60, step: 0.1 }}
            />
            <TextField
              label="Max tokens"
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              inputProps={{ min: 1000, max: 1000000, step: 1000 }}
            />
          </Box>

          {profile === 'custom' && (
            <Box mt={2}>
              <TextField
                label="Custom headers (JSON)"
                value={customHeadersText}
                onChange={(e) => setCustomHeadersText(e.target.value)}
                multiline
                minRows={4}
                fullWidth
                sx={{ mb: 2 }}
              />
              <TextField
                label="Custom User-Agent"
                value={customUserAgent}
                onChange={(e) => setCustomUserAgent(e.target.value)}
                fullWidth
              />
            </Box>
          )}

          {antiError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {antiError}
            </Alert>
          )}

          <Button variant="contained" sx={{ mt: 2 }} onClick={handleApplyAntiDetection} disabled={antiLoading}>
            Apply Settings
          </Button>

          <JsonBlock data={antiResponse} />
        </CardContent>
      </Card>

      {/* ③ Structure Discovery */}
      <Card sx={{ mt: 3, opacity: selectedToken ? 1 : 0.5, pointerEvents: selectedToken ? 'auto' : 'none' }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">
              <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>③</Box>
              Structure Discovery
            </Typography>
            {structureLoading && <CircularProgress size={20} />}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Analyse the page layout of <strong>{targetUrl || '(enter URL above)'}</strong> before extracting content.
          </Typography>

          <Box display="flex" flexWrap="wrap" gap={2}>
            <FormControlLabel
              control={<Switch checked={includeNav} onChange={(e) => setIncludeNav(e.target.checked)} />}
              label="Navigation"
            />
            <FormControlLabel
              control={<Switch checked={includeInternalLinks} onChange={(e) => setIncludeInternalLinks(e.target.checked)} />}
              label="Internal links"
            />
            <FormControlLabel
              control={<Switch checked={includeExternalLinks} onChange={(e) => setIncludeExternalLinks(e.target.checked)} />}
              label="External links"
            />
            <FormControlLabel
              control={<Switch checked={includeForms} onChange={(e) => setIncludeForms(e.target.checked)} />}
              label="Forms"
            />
            <FormControlLabel
              control={<Switch checked={includeOutline} onChange={(e) => setIncludeOutline(e.target.checked)} />}
              label="Outline"
            />
          </Box>

          {structureError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {structureError}
            </Alert>
          )}

          <Button variant="contained" sx={{ mt: 2 }} onClick={handleAnalyzeStructure} disabled={structureLoading}>
            Analyze Structure
          </Button>

          <JsonBlock data={structureResponse} />
        </CardContent>
      </Card>

      {/* ④ Content Extraction */}
      <Card sx={{ mt: 3, opacity: selectedToken ? 1 : 0.5, pointerEvents: selectedToken ? 'auto' : 'none' }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">
              <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>④</Box>
              Content Extraction
            </Typography>
            {contentLoading && <CircularProgress size={20} />}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Scrape content from <strong>{targetUrl || '(enter URL above)'}</strong>.
          </Typography>

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}>
            <TextField
              label="CSS selector (optional)"
              value={contentSelector}
              onChange={(e) => setContentSelector(e.target.value)}
            />
            <TextField
              label="Depth"
              type="number"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              inputProps={{ min: 1, max: 3, step: 1 }}
            />
            <TextField
              label="Max pages per level"
              type="number"
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              inputProps={{ min: 1, max: 20, step: 1 }}
            />
            <TextField
              label="Chunk size"
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              inputProps={{ min: 500, max: 10000, step: 100 }}
              disabled={!sessionMode}
            />
          </Box>

          <Box display="flex" flexWrap="wrap" gap={2} mt={2}>
            <FormControlLabel
              control={<Switch checked={includeLinks} onChange={(e) => setIncludeLinks(e.target.checked)} />}
              label="Include links"
            />
            <FormControlLabel
              control={<Switch checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} />}
              label="Include images"
            />
            <FormControlLabel
              control={<Switch checked={includeMeta} onChange={(e) => setIncludeMeta(e.target.checked)} />}
              label="Include meta"
            />
            <FormControlLabel
              control={<Switch checked={sessionMode} onChange={(e) => setSessionMode(e.target.checked)} />}
              label="Session mode"
            />
          </Box>

          {contentError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {contentError}
            </Alert>
          )}

          <Button variant="contained" sx={{ mt: 2 }} onClick={handleFetchContent} disabled={contentLoading}>
            Fetch Content
          </Button>

          {contentResponse && (
            <Box mt={2}>
              <Tabs value={contentTab} onChange={(_, value) => setContentTab(value)}>
                <Tab label="Text" />
                <Tab label="Headings" />
                <Tab label="Links" />
                <Tab label="Images" />
                <Tab label="Meta" />
                <Tab label="Summary" />
              </Tabs>
              <Divider sx={{ mb: 2 }} />
              {contentTab === 0 && (
                <Box sx={{ whiteSpace: 'pre-wrap' }}>{contentResponse.text || 'No text returned.'}</Box>
              )}
              {contentTab === 1 && <JsonBlock data={contentResponse.headings} />}
              {contentTab === 2 && <JsonBlock data={contentResponse.links} />}
              {contentTab === 3 && <JsonBlock data={contentResponse.images} />}
              {contentTab === 4 && <JsonBlock data={contentResponse.meta} />}
              {contentTab === 5 && <JsonBlock data={contentResponse.summary || contentResponse.pages} />}
            </Box>
          )}

          <JsonBlock data={contentResponse} />
        </CardContent>
      </Card>

      {/* ⑤ Session Viewer */}
      <Card sx={{ mt: 3, mb: 4, opacity: selectedToken ? 1 : 0.5, pointerEvents: selectedToken ? 'auto' : 'none' }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">
              <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>⑤</Box>
              Session Viewer
            </Typography>
            {(sessionInfoLoading || sessionChunkLoading) && <CircularProgress size={20} />}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Inspect chunked results from a session-mode scrape.
          </Typography>

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}>
            <TextField
              label="Session ID"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              fullWidth
            />
            <TextField
              label="Chunk index"
              type="number"
              value={chunkIndex}
              onChange={(e) => setChunkIndex(Number(e.target.value))}
              inputProps={{ min: 0 }}
            />
          </Box>

          {sessionError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {sessionError}
            </Alert>
          )}

          <Box display="flex" gap={2} mt={2} flexWrap="wrap">
            <Button variant="contained" onClick={handleSessionInfo} disabled={sessionInfoLoading}>
              Get Info
            </Button>
            <Button variant="outlined" onClick={handleSessionChunk} disabled={sessionChunkLoading}>
              Get Chunk
            </Button>
          </Box>

          {sessionInfo && (
            <Box mt={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Session Summary
              </Typography>
              <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2} mt={1}>
                <Typography variant="body2">Source: {sessionInfo.source_url}</Typography>
                <Typography variant="body2">Chunks: {sessionInfo.total_chunks}</Typography>
                <Typography variant="body2">Size: {sessionInfo.total_size_bytes} bytes</Typography>
                <Typography variant="body2">Created: {sessionInfo.created_at}</Typography>
              </Box>
            </Box>
          )}

          {sessionChunk && (
            <Box mt={2}>
              <Typography variant="subtitle2" color="text.secondary">
                Chunk {sessionChunk.chunk_index}
              </Typography>
              <Box sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{sessionChunk.text}</Box>
            </Box>
          )}

          <JsonBlock data={sessionInfo || sessionChunk} />
        </CardContent>
      </Card>
    </Box>
  );
}
