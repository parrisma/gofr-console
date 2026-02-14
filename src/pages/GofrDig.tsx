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
  Tooltip,
  IconButton,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useConfig } from '../hooks/useConfig';
import { logger } from '../services/logging';
import type { JwtToken } from '../stores/configStore';
import type {
  AntiDetectionResponse,
  ContentResponse,
  PageStructureResponse,
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
        overflowX: 'auto',
        overflowY: 'auto',
        maxWidth: '100%',
        maxHeight: 600,
        fontSize: 12,
        border: '1px solid',
        borderColor: 'divider',
        whiteSpace: 'pre',
        wordBreak: 'keep-all',
      }}
    >
      {JSON.stringify(data, null, 2)}
    </Box>
  );
}

/** Small info-icon tooltip placed inline next to a label or control. */
function FieldTip({ tip }: { tip: string }) {
  return (
    <Tooltip title={tip} arrow placement="top" enterDelay={200}>
      <IconButton size="small" tabIndex={-1} sx={{ ml: 0.5, p: 0.25, color: 'action.active' }}>
        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}

function formatToolError(tool: string, err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  if (message.toLowerCase().includes(tool)) return message;
  return `${tool} failed: ${message}`;
}

export default function GofrDig() {
  const { tokens } = useConfig();

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-DIG page viewed',
      component: 'GofrDig',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

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
  const [rateLimitDelay, setRateLimitDelay] = useState(1.0);
  const [maxResponseChars, setMaxResponseChars] = useState(400000);
  const [customHeadersText, setCustomHeadersText] = useState('{\n  "Accept-Language": "en-US"\n}');
  const [customUserAgent, setCustomUserAgent] = useState('');
  const [antiLoading, setAntiLoading] = useState(false);
  const [antiError, setAntiError] = useState<string | null>(null);
  const [antiResponse, setAntiResponse] = useState<AntiDetectionResponse | null>(null);

  // Structure
  const [structureSelector, setStructureSelector] = useState('');
  const [includeNav, setIncludeNav] = useState(true);
  const [includeInternalLinks, setIncludeInternalLinks] = useState(true);
  const [includeExternalLinks, setIncludeExternalLinks] = useState(true);
  const [includeForms, setIncludeForms] = useState(true);
  const [includeOutline, setIncludeOutline] = useState(true);
  const [structureTimeout, setStructureTimeout] = useState(60);
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
  const [filterNoise, setFilterNoise] = useState(true);
  const [sessionMode, setSessionMode] = useState(false);
  const [chunkSize, setChunkSize] = useState(4000);
  const [maxBytes, setMaxBytes] = useState(5242880);
  const [contentTimeout, setContentTimeout] = useState(60);
  const [parseResults, setParseResults] = useState(true);
  const [sourceProfileName, setSourceProfileName] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentResponse, setContentResponse] = useState<ContentResponse | null>(null);
  const [contentTab, setContentTab] = useState(0);

  const requireToken = (): string | undefined => selectedToken?.token;

  const handleApplyAntiDetection = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    logger.info({
      event: 'ui_action_clicked',
      message: 'Apply anti-detection clicked',
      request_id: requestId,
      component: 'GofrDig',
      operation: 'set_antidetection',
      data: { profile },
    });
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

      const response = await api.digSetAntiDetection(requireToken(), {
        profile,
        rate_limit_delay: rateLimitDelay,
        max_response_chars: maxResponseChars,
        custom_headers: customHeaders,
        custom_user_agent: profile === 'custom' ? customUserAgent || undefined : undefined,
      });
      setAntiResponse(response);
      logger.info({
        event: 'ui_form_submitted',
        message: 'set_antidetection succeeded',
        request_id: requestId,
        component: 'GofrDig',
        operation: 'set_antidetection',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      setAntiError(formatToolError('set_antidetection', err, 'Failed to apply anti-detection settings'));
      setAntiResponse(null);
      logger.error({
        event: 'ui_form_submitted',
        message: 'set_antidetection failed',
        request_id: requestId,
        component: 'GofrDig',
        operation: 'set_antidetection',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: err instanceof Error ? err.message : 'unknown' },
      });
    } finally {
      setAntiLoading(false);
    }
  };

  const handleAnalyzeStructure = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    logger.info({
      event: 'ui_action_clicked',
      message: 'Analyze structure clicked',
      request_id: requestId,
      component: 'GofrDig',
      operation: 'get_structure',
      data: { selector_present: Boolean(structureSelector.trim()) },
    });
    setStructureLoading(true);
    setStructureError(null);
    try {
      if (!targetUrl) {
        throw new Error('URL is required');
      }
      const response = await api.digGetStructure(requireToken(), targetUrl, {
        selector: structureSelector,
        include_navigation: includeNav,
        include_internal_links: includeInternalLinks,
        include_external_links: includeExternalLinks,
        include_forms: includeForms,
        include_outline: includeOutline,
        timeout_seconds: structureTimeout,
      });
      setStructureResponse(response);
      logger.info({
        event: 'ui_form_submitted',
        message: 'get_structure succeeded',
        request_id: requestId,
        component: 'GofrDig',
        operation: 'get_structure',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      setStructureError(formatToolError('get_structure', err, 'Failed to analyze structure'));
      setStructureResponse(null);
      logger.error({
        event: 'ui_form_submitted',
        message: 'get_structure failed',
        request_id: requestId,
        component: 'GofrDig',
        operation: 'get_structure',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: err instanceof Error ? err.message : 'unknown' },
      });
    } finally {
      setStructureLoading(false);
    }
  };

  const handleFetchContent = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    logger.info({
      event: 'ui_action_clicked',
      message: 'Fetch content clicked',
      request_id: requestId,
      component: 'GofrDig',
      operation: 'get_content',
      data: { depth, filter_noise: filterNoise },
    });
    setContentLoading(true);
    setContentError(null);
    try {
      if (!targetUrl) {
        throw new Error('URL is required');
      }
      const response = await api.digGetContent(requireToken(), targetUrl, {
        selector: contentSelector,
        depth,
        max_pages_per_level: maxPages,
        include_links: includeLinks,
        include_images: includeImages,
        include_meta: includeMeta,
        filter_noise: filterNoise,
        session: sessionMode,
        chunk_size: chunkSize,
        max_bytes: maxBytes,
        timeout_seconds: contentTimeout,
        parse_results: parseResults,
        source_profile_name: sourceProfileName || undefined,
      });
      setContentResponse(response);
      logger.info({
        event: 'ui_form_submitted',
        message: 'get_content succeeded',
        request_id: requestId,
        component: 'GofrDig',
        operation: 'get_content',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { response_type: response.response_type ?? 'inline' },
      });
    } catch (err) {
      setContentError(formatToolError('get_content', err, 'Failed to fetch content'));
      setContentResponse(null);
      logger.error({
        event: 'ui_form_submitted',
        message: 'get_content failed',
        request_id: requestId,
        component: 'GofrDig',
        operation: 'get_content',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: err instanceof Error ? err.message : 'unknown' },
      });
    } finally {
      setContentLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Typography variant="h4">GOFR-DIG</Typography>
        <Chip label="MCP" size="small" />
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Test and explore GOFR-DIG scraping features via MCP before automating workflows.
      </Typography>

      <Alert severity="info" icon={false} sx={{ mt: 1, '& .MuiAlert-message': { width: '100%' } }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>How it works</Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>① Pick a token</strong> — this determines which access group the scraped material belongs to.
          <strong>② Set anti-detection</strong> — configure how requests appear to the target site.
          <strong>③ Analyse structure</strong> — preview the page layout and find the right CSS selectors.
          <strong>④ Extract content</strong> — pull the actual text, links, and metadata.
          <strong>⑤ Review sessions</strong> — browse chunked results from large scrapes.
          Each step builds on the previous one; start from the top and work down.
        </Typography>
      </Alert>

      {/* ① Token & Target */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>①</Box>
            Token & URL to Scrape
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select an access token, then enter the URL you want to scrape.
          </Typography>

          <Box display="flex" alignItems="flex-start" gap={1} sx={{ mb: 2 }}>
            <FormControl fullWidth>
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
            <Box sx={{ pt: 2 }}>
              <FieldTip tip="The token determines which access group the scraped content is stored under. Only users with access to that group can view, search, or use the material. Choose the token that matches the intended audience." />
            </Box>
          </Box>

          <TextField
            label="URL to scrape"
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

          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            <Typography variant="body2">robots.txt is always enforced — this cannot be disabled.</Typography>
          </Alert>

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2}>
            <Tooltip title="Wait time between consecutive HTTP requests. 0 = no delay (aggressive). Increase to 2–5 s for rate-limited sites." arrow placement="top">
              <TextField
                label="Rate limit delay (seconds)"
                type="number"
                value={rateLimitDelay}
                onChange={(e) => setRateLimitDelay(Number(e.target.value))}
                inputProps={{ min: 0, max: 60, step: 0.1 }}
              />
            </Tooltip>
            <Tooltip title="Maximum content size returned (character count, not tokens). Content exceeding this is truncated. Range: 4 000 – 4 000 000. Default: 400 000." arrow placement="top">
              <TextField
                label="Max response chars"
                type="number"
                value={maxResponseChars}
                onChange={(e) => setMaxResponseChars(Number(e.target.value))}
                inputProps={{ min: 4000, max: 4000000, step: 1000 }}
              />
            </Tooltip>
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

          <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={2} mb={2}>
            <Tooltip title='Scope structural analysis to a CSS selector, e.g. "#main", "article". Leave blank for full page.' arrow placement="top">
              <TextField
                label="CSS selector (optional)"
                value={structureSelector}
                onChange={(e) => setStructureSelector(e.target.value)}
              />
            </Tooltip>
            <Tooltip title="Fetch timeout per URL in seconds. Default 60." arrow placement="top">
              <TextField
                label="Timeout (seconds)"
                type="number"
                value={structureTimeout}
                onChange={(e) => setStructureTimeout(Number(e.target.value))}
                inputProps={{ min: 1, max: 300, step: 1 }}
              />
            </Tooltip>
          </Box>

          <Box display="flex" flexWrap="wrap" gap={2}>
            <FormControlLabel
              control={<Switch checked={includeNav} onChange={(e) => setIncludeNav(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">Navigation<FieldTip tip="Detect nav bars, menus, and sidebar navigation elements." /></Box>}
            />
            <FormControlLabel
              control={<Switch checked={includeInternalLinks} onChange={(e) => setIncludeInternalLinks(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">Internal links<FieldTip tip="Links pointing to the same domain — useful for discovering crawlable pages." /></Box>}
            />
            <FormControlLabel
              control={<Switch checked={includeExternalLinks} onChange={(e) => setIncludeExternalLinks(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">External links<FieldTip tip="Links pointing to other domains (outbound references)." /></Box>}
            />
            <FormControlLabel
              control={<Switch checked={includeForms} onChange={(e) => setIncludeForms(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">Forms<FieldTip tip="Extract form fields, actions, and methods — useful for understanding interactive elements." /></Box>}
            />
            <FormControlLabel
              control={<Switch checked={includeOutline} onChange={(e) => setIncludeOutline(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">Outline<FieldTip tip="Heading hierarchy (h1–h6) showing the document's logical structure." /></Box>}
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

          {structureResponse?.language && (
            <Chip label={`Language: ${structureResponse.language}`} size="small" sx={{ mt: 2, ml: 1 }} />
          )}

          <JsonBlock data={structureResponse} />
        </CardContent>
      </Card>

      {/* ④ Content Extraction */}
      <Card sx={{ mt: 3, overflow: 'hidden', opacity: selectedToken ? 1 : 0.5, pointerEvents: selectedToken ? 'auto' : 'none' }}>
        <CardContent sx={{ minWidth: 0 }}>
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
            <Tooltip title='Narrow extraction to a CSS selector, e.g. "#content", "article", ".main-text". Leave blank to extract full page.' arrow placement="top">
              <TextField
                label="CSS selector (optional)"
                value={contentSelector}
                onChange={(e) => setContentSelector(e.target.value)}
              />
            </Tooltip>
            <Tooltip title="1 = single page only. 2 = follow links one level (great for docs sites). 3 = two levels deep (slow, use sparingly)." arrow placement="top">
              <TextField
                label="Depth"
                type="number"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                inputProps={{ min: 1, max: 3, step: 1 }}
              />
            </Tooltip>
            <Tooltip title="How many linked pages to follow at each depth level. Total pages ≈ max_pages ^ depth. Lower = faster." arrow placement="top">
              <TextField
                label="Max pages per level"
                type="number"
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                inputProps={{ min: 1, max: 20, step: 1 }}
              />
            </Tooltip>
            <Tooltip title="Characters per chunk when session mode is on. Smaller chunks = more granular retrieval. Recommended: 3000–8000. Only used with Session mode enabled." arrow placement="top">
              <TextField
                label="Chunk size"
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                inputProps={{ min: 500, max: 10000, step: 100 }}
                disabled={!sessionMode && depth <= 1}
              />
            </Tooltip>
            <Tooltip title="Fetch timeout per URL in seconds. Default 60." arrow placement="top">
              <TextField
                label="Timeout (seconds)"
                type="number"
                value={contentTimeout}
                onChange={(e) => setContentTimeout(Number(e.target.value))}
                inputProps={{ min: 1, max: 300, step: 1 }}
              />
            </Tooltip>
            <Tooltip title="Max inline response size in bytes. Default 5 MB (5242880). Returns CONTENT_TOO_LARGE if exceeded." arrow placement="top">
              <TextField
                label="Max bytes"
                type="number"
                value={maxBytes}
                onChange={(e) => setMaxBytes(Number(e.target.value))}
                inputProps={{ min: 1024, step: 1024 }}
              />
            </Tooltip>
          </Box>

          <Box display="flex" flexWrap="wrap" gap={2} mt={2}>
            <FormControlLabel
              control={<Switch checked={includeLinks} onChange={(e) => setIncludeLinks(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">Include links<FieldTip tip="Extract hyperlinks from the page. Disable for text-only extraction." /></Box>}
            />
            <FormControlLabel
              control={<Switch checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">Include images<FieldTip tip="Extract image URLs and alt text. Enable for image-heavy pages." /></Box>}
            />
            <FormControlLabel
              control={<Switch checked={includeMeta} onChange={(e) => setIncludeMeta(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">Include meta<FieldTip tip="Extract page metadata: description, keywords, Open Graph tags, etc." /></Box>}
            />
            <FormControlLabel
              control={<Switch checked={filterNoise} onChange={(e) => setFilterNoise(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">Filter noise<FieldTip tip="Remove boilerplate (nav, footer, ads) and keep only main content. Enabled by default." /></Box>}
            />
            <FormControlLabel
              control={<Switch checked={parseResults} onChange={(e) => setParseResults(e.target.checked)} />}
              label={<Box display="inline-flex" alignItems="center">Parse results<FieldTip tip="Run the deterministic news parser on crawl results. Returns structured stories with dedup, classification, and quality signals. Disable for raw crawl output." /></Box>}
            />
            <FormControlLabel
              control={<Switch checked={sessionMode} onChange={(e) => setSessionMode(e.target.checked)} />}
              label={
                <Box display="inline-flex" alignItems="center">
                  Session mode
                  <FieldTip tip={depth > 1
                    ? "Session mode flag is sent exactly as selected. Note: server may still enforce session behavior for depth > 1."
                    : "Store content server-side in chunks instead of returning it all at once. Use for large pages — retrieve chunks later on the Sessions page."
                  } />
                </Box>
              }
            />
          </Box>

          {parseResults && (
            <Box mt={2}>
              <Autocomplete
                freeSolo
                options={['scmp', 'generic']}
                value={sourceProfileName}
                onInputChange={(_, value) => setSourceProfileName(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Source profile name (optional)"
                    helperText='Parser profile for site-specific rules (e.g. "scmp"). Leave blank for generic fallback.'
                    size="small"
                  />
                )}
                sx={{ maxWidth: 400 }}
              />
            </Box>
          )}

          {contentError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {contentError}
            </Alert>
          )}

          <Box display="flex" alignItems="center" gap={2} mt={2}>
            <Button variant="contained" onClick={handleFetchContent} disabled={contentLoading}>
              Fetch Content
            </Button>
            <Tooltip
              title={
                <Box component="pre" sx={{ m: 0, fontSize: '0.75rem', maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(
                    {
                      tool: 'get_content',
                      arguments: {
                        url: targetUrl || '(empty)',
                        selector: contentSelector,
                        depth,
                        max_pages_per_level: maxPages,
                        include_links: includeLinks,
                        include_images: includeImages,
                        include_meta: includeMeta,
                        filter_noise: filterNoise,
                        session: sessionMode,
                        chunk_size: chunkSize,
                        max_bytes: maxBytes,
                        timeout_seconds: contentTimeout,
                        parse_results: parseResults,
                        source_profile_name: sourceProfileName || undefined,
                      },
                    },
                    null,
                    2
                  )}
                </Box>
              }
              placement="right"
              arrow
              slotProps={{
                tooltip: {
                  sx: { maxWidth: 480, bgcolor: 'grey.900', p: 1.5 },
                },
              }}
            >
              <IconButton size="small" color="info">
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {contentResponse && (contentResponse.session_id || contentResponse.response_type === 'session') ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Session created</Typography>
              <Typography variant="body2">
                <strong>Session ID:</strong> {contentResponse.session_id}
              </Typography>
              <Typography variant="body2">
                <strong>Chunks:</strong> {contentResponse.total_chunks ?? '?'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Go to the <strong>Sessions</strong> page to browse the stored content.
              </Typography>
            </Alert>
          ) : contentResponse ? (
            <Box mt={2} sx={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
              {(contentResponse.crawl_depth != null || contentResponse.response_type) && (
                <Box display="flex" gap={1} mb={1} flexWrap="wrap">
                  {contentResponse.response_type && <Chip label={`Type: ${contentResponse.response_type}`} size="small" />}
                  {contentResponse.crawl_depth != null && <Chip label={`Crawl depth: ${contentResponse.crawl_depth}`} size="small" />}
                  {contentResponse.raw_summary && <Chip label={`Pages: ${contentResponse.raw_summary.total_pages} | Text: ${(contentResponse.raw_summary.total_text_length / 1024).toFixed(1)} KB`} size="small" />}
                </Box>
              )}
              <Tabs value={contentTab} onChange={(_, value) => setContentTab(value)} variant="scrollable" scrollButtons="auto">
                <Tab label={`Stories (${contentResponse.stories?.length ?? 0})`} disabled={!contentResponse.stories?.length} />
                <Tab label="Headings" />
                <Tab label="Links" />
                <Tab label="Meta" />
                <Tab label="Summary" />
                <Tab label="Feed Meta" disabled={!contentResponse.feed_meta} />
                <Tab label="Text" />
                <Tab label="Images" />
              </Tabs>
              <Divider sx={{ mb: 2 }} />
              {contentTab === 0 && contentResponse.stories && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {contentResponse.stories.length} stories extracted
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Headline</TableCell>
                          <TableCell>Section</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Published</TableCell>
                          <TableCell>Author</TableCell>
                          <TableCell>Confidence</TableCell>
                          <TableCell>Snippet</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {contentResponse.stories.map((story) => (
                          <TableRow key={story.story_id}>
                            <TableCell sx={{ maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                              {story.headline}
                              {story.subheadline && (
                                <Typography variant="caption" display="block" color="text.secondary">
                                  {story.subheadline}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>{story.section ?? '—'}</TableCell>
                            <TableCell>
                              <Chip label={story.content_type ?? 'news'} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{story.published ?? story.published_raw ?? '—'}</TableCell>
                            <TableCell>{story.author ?? '—'}</TableCell>
                            <TableCell>
                              {story.parse_quality ? (
                                <Tooltip title={`Missing: ${story.parse_quality.missing_fields.join(', ') || 'none'}\nSegmentation: ${story.parse_quality.segmentation_reason}`} arrow>
                                  <Chip
                                    label={story.parse_quality.parse_confidence.toFixed(2)}
                                    size="small"
                                    color={story.parse_quality.parse_confidence >= 0.8 ? 'success' : story.parse_quality.parse_confidence >= 0.5 ? 'warning' : 'error'}
                                    variant="outlined"
                                  />
                                </Tooltip>
                              ) : '—'}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 250, whiteSpace: 'normal', wordBreak: 'break-word', fontSize: '0.75rem' }}>
                              {story.body_snippet ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
              {contentTab === 1 && <JsonBlock data={contentResponse.headings} />}
              {contentTab === 2 && <JsonBlock data={contentResponse.links} />}
              {contentTab === 3 && <JsonBlock data={contentResponse.meta} />}
              {contentTab === 4 && <JsonBlock data={contentResponse.raw_summary || contentResponse.summary || contentResponse.pages} />}
              {contentTab === 5 && contentResponse.feed_meta && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>Feed Metadata</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%' }}>
                    <Table size="small">
                      <TableBody>
                        {Object.entries(contentResponse.feed_meta).map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', width: 200 }}>{key}</TableCell>
                            <TableCell>{String(value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {contentResponse.warnings && contentResponse.warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Parse Warnings ({contentResponse.warnings.length})</Typography>
                      {contentResponse.warnings.map((w, i) => (
                        <Typography key={i} variant="body2">{w}</Typography>
                      ))}
                    </Alert>
                  )}
                </Box>
              )}
              {contentTab === 6 && (
                <Box
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    overflowY: 'auto',
                    maxHeight: 600,
                    maxWidth: '100%',
                    m: 0,
                    p: 2,
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    bgcolor: 'background.default',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  {contentResponse.text || 'No text returned.'}
                </Box>
              )}
              {contentTab === 7 && <JsonBlock data={contentResponse.images} />}
            </Box>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
