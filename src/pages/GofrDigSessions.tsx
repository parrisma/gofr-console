import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Tooltip,
  IconButton,
  Paper,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { api } from '../services/api';
import { useConfig } from '../hooks/useConfig';
import type { JwtToken } from '../stores/configStore';
import type {
  SessionChunkResponse,
  SessionInfoResponse,
  SessionSummary,
  SessionUrlsResponse,
} from '../types/gofrDig';
import LinkIcon from '@mui/icons-material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

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

export default function GofrDigSessions() {
  const { tokens } = useConfig();

  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number>(-1);
  const selectedToken: JwtToken | null =
    selectedTokenIndex >= 0 && selectedTokenIndex < tokens.length
      ? tokens.at(selectedTokenIndex) ?? null
      : null;

  // Session list
  const [sessionsList, setSessionsList] = useState<SessionSummary[]>([]);
  const [sessionsListLoading, setSessionsListLoading] = useState(false);
  const [sessionsListError, setSessionsListError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Session detail
  const [sessionId, setSessionId] = useState('');
  const [chunkIndex, setChunkIndex] = useState(0);
  const [sessionInfoLoading, setSessionInfoLoading] = useState(false);
  const [sessionChunkLoading, setSessionChunkLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfoResponse | null>(null);
  const [sessionChunk, setSessionChunk] = useState<SessionChunkResponse | null>(null);

  // Merged "Get All" view
  const [allChunksJson, setAllChunksJson] = useState<string | null>(null);
  const [allChunksLoading, setAllChunksLoading] = useState(false);

  // Chunk URLs
  const [sessionUrls, setSessionUrls] = useState<SessionUrlsResponse | null>(null);

  const requireToken = (): string | undefined => selectedToken?.token;

  const handleListSessions = async () => {
    setSessionsListLoading(true);
    setSessionsListError(null);
    try {
      const response = await api.digListSessions(requireToken());
      setSessionsList(response.sessions ?? []);
      setHasLoaded(true);
    } catch (err) {
      setSessionsListError(formatToolError('list_sessions', err, 'Failed to load sessions'));
      setSessionsList([]);
      setHasLoaded(true);
    } finally {
      setSessionsListLoading(false);
    }
  };

  const handleSessionInfo = async () => {
    setSessionInfoLoading(true);
    setSessionError(null);
    try {
      if (!sessionId.trim()) throw new Error('Session ID is required');
      const response = await api.digGetSessionInfo(requireToken(), sessionId.trim());
      setSessionInfo(response);
      // Auto-load first chunk + chunk URLs
      setChunkIndex(0);
      const [chunkResult, urlsResult] = await Promise.allSettled([
        api.digGetSessionChunk(requireToken(), sessionId.trim(), 0),
        api.digGetSessionUrls(requireToken(), sessionId.trim()),
      ]);
      if (chunkResult.status === 'fulfilled') setSessionChunk(chunkResult.value);
      if (urlsResult.status === 'fulfilled') setSessionUrls(urlsResult.value);
      else setSessionUrls(null);
    } catch (err) {
      setSessionError(formatToolError('get_session_info', err, 'Failed to load session info'));
      setSessionInfo(null);
    } finally {
      setSessionInfoLoading(false);
    }
  };

  const selectSession = (id: string) => {
    setSessionId(id);
    setChunkIndex(0);
    setSessionInfo(null);
    setSessionChunk(null);
    setSessionUrls(null);
    setSessionError(null);
    setAllChunksJson(null);
  };

  const totalChunks = sessionInfo?.total_chunks ?? 0;

  // Normalize sessionChunk into a displayable JSON string.
  // The server triple-encodes chunk data (string inside string inside JSON),
  // so we unwrap up to 3 layers. If the final value is an object, pretty-print it.
  // If it's still a string after unwrapping, show it as-is (plain text chunk).
  const { chunkData, chunkJson } = (() => {
    if (!sessionChunk) return { chunkData: null as Record<string, unknown> | null, chunkJson: null as string | null };
    let data: unknown = sessionChunk;
    // Unwrap string layers until we get an object or can't parse further
    for (let i = 0; i < 3 && typeof data === 'string'; i++) {
      try { data = JSON.parse(data); } catch { break; }
    }
    if (typeof data === 'object' && data !== null) {
      return {
        chunkData: data as Record<string, unknown>,
        chunkJson: JSON.stringify(data, null, 2),
      };
    }
    // Fallback: data is a primitive (string/number) after unwrapping — show it directly
    if (typeof data === 'string') {
      return { chunkData: null, chunkJson: data };
    }
    // Last resort: stringify sessionChunk itself
    return {
      chunkData: null,
      chunkJson: typeof sessionChunk === 'string' ? sessionChunk : JSON.stringify(sessionChunk, null, 2),
    };
  })();

  const loadChunk = async (index: number) => {
    const clamped = Math.max(0, Math.min(index, totalChunks - 1));
    setChunkIndex(clamped);
    setAllChunksJson(null); // switch back to single-chunk view
    setSessionChunkLoading(true);
    setSessionError(null);
    try {
      const response = await api.digGetSessionChunk(requireToken(), sessionId.trim(), clamped);
      setSessionChunk(response);
    } catch (err) {
      setSessionError(formatToolError('get_session_chunk', err, 'Failed to load session chunk'));
      setSessionChunk(null);
    } finally {
      setSessionChunkLoading(false);
    }
  };

  /** Extract the raw string content from a chunk API response.
   *  parseToolText may return an object (single-chunk session) or a string
   *  (truncated chunk — the common case for multi-chunk sessions). */
  const chunkToString = (raw: unknown): string => {
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
    return String(raw);
  };

  /** Fetch all chunks, concatenate their raw strings, parse the result, and format it. */
  const loadAllChunks = async () => {
    if (totalChunks <= 0 || totalChunks > 5) return;
    setAllChunksLoading(true);
    setSessionError(null);
    try {
      const results = await Promise.all(
        Array.from({ length: totalChunks }, (_, i) =>
          api.digGetSessionChunk(requireToken(), sessionId.trim(), i)
        )
      );
      // Chunks are raw string fragments of the serialized page JSON.
      // Concatenate them (no separator) to reconstruct the complete JSON.
      const joined = results.map(chunkToString).join('');

      // Try to parse the reassembled JSON
      let display: string;
      try {
        // Handle embedded literal newlines that break JSON.parse
        let toParse = joined;
        try {
          JSON.parse(toParse);
        } catch {
          toParse = joined.replace(/[\n\r\t]/g, m =>
            m === '\n' ? '\\n' : m === '\r' ? '\\r' : '\\t');
        }
        const parsed = JSON.parse(toParse);
        display = JSON.stringify(parsed, null, 2);
      } catch {
        // If it still can't be parsed, show the raw concatenated text
        display = joined;
      }
      setAllChunksJson(display);
    } catch (err) {
      setSessionError(formatToolError('get_session_chunk', err, 'Failed to load all chunks'));
      setAllChunksJson(null);
    } finally {
      setAllChunksLoading(false);
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Typography variant="h4">Sessions</Typography>
        <Chip label="MCP" size="small" />
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Browse stored scraping sessions and inspect their chunked content.
      </Typography>

      {/* Token selector */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Typography variant="subtitle1">Token</Typography>
            <FieldTip tip="Select a token to authenticate with gofr-dig. Sessions are scoped to the token's access group." />
          </Box>
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              select
              label="Token"
              value={selectedTokenIndex}
              onChange={(e) => setSelectedTokenIndex(Number(e.target.value))}
              sx={{ minWidth: 240 }}
              SelectProps={{ native: true }}
            >
              <option value={-1}>Select token</option>
              {tokens.map((token, index) => (
                <option key={token.name} value={index}>
                  {token.name}
                </option>
              ))}
            </TextField>
            <Button
              variant="contained"
              onClick={handleListSessions}
              disabled={sessionsListLoading}
              startIcon={sessionsListLoading ? <CircularProgress size={16} /> : undefined}
            >
              {sessionsListLoading ? 'Loading…' : 'Load Sessions'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Session list */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">Stored Sessions</Typography>
            {sessionsListLoading && <CircularProgress size={20} />}
          </Box>

          {sessionsListError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {sessionsListError}
            </Alert>
          )}

          {sessionsList.length > 0 ? (
            <Box
              sx={{
                maxHeight: 400,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <Box component="thead">
                  <Box component="tr" sx={{ bgcolor: 'action.hover', position: 'sticky', top: 0 }}>
                    <Box component="th" sx={{ p: 1, textAlign: 'left' }}>URL</Box>
                    <Box component="th" sx={{ p: 1, textAlign: 'right' }}>Chunks</Box>
                    <Box component="th" sx={{ p: 1, textAlign: 'right' }}>Size</Box>
                    <Box component="th" sx={{ p: 1, textAlign: 'left' }}>Created</Box>
                    <Box component="th" sx={{ p: 1 }} />
                  </Box>
                </Box>
                <Box component="tbody">
                  {sessionsList.map((s) => (
                    <Box
                      component="tr"
                      key={s.session_id}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.selected' },
                        bgcolor: s.session_id === sessionId ? 'action.selected' : undefined,
                      }}
                      onClick={() => selectSession(s.session_id)}
                    >
                      <Box component="td" sx={{ p: 1, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Tooltip title={s.url} arrow placement="top"><span>{s.url}</span></Tooltip>
                      </Box>
                      <Box component="td" sx={{ p: 1, textAlign: 'right' }}>{s.total_chunks}</Box>
                      <Box component="td" sx={{ p: 1, textAlign: 'right' }}>{(s.total_size_bytes / 1024).toFixed(1)} KB</Box>
                      <Box component="td" sx={{ p: 1, whiteSpace: 'nowrap' }}>{new Date(s.created_at).toLocaleString()}</Box>
                      <Box component="td" sx={{ p: 1 }}>
                        <Button size="small" variant="text" onClick={(e) => { e.stopPropagation(); selectSession(s.session_id); }}>
                          Select
                        </Button>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          ) : hasLoaded && !sessionsListLoading ? (
            <Typography variant="body2" color="text.secondary">
              No sessions found. Use the Scraper page with Session mode enabled to create one.
            </Typography>
          ) : !hasLoaded ? (
            <Typography variant="body2" color="text.secondary">
              Click <strong>Load Sessions</strong> to fetch stored sessions from gofr-dig.
            </Typography>
          ) : null}
        </CardContent>
      </Card>

      {/* Session detail viewer */}
      <Card sx={{ mt: 3, mb: 4, opacity: sessionId ? 1 : 0.5, pointerEvents: sessionId ? 'auto' : 'none' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Session Detail</Typography>

          {/* Controls row */}
          <Box display="flex" gap={2} alignItems="flex-end" flexWrap="wrap">
            <Tooltip title="The GUID of the session to inspect. Select from the list above or paste manually." arrow placement="top">
              <TextField
                label="Session ID"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                size="small"
                sx={{ minWidth: 320, flexGrow: 1 }}
              />
            </Tooltip>
            <Button
              variant="contained"
              onClick={handleSessionInfo}
              disabled={sessionInfoLoading || !sessionId}
              startIcon={sessionInfoLoading ? <CircularProgress size={16} /> : undefined}
            >
              {sessionInfoLoading ? 'Loading…' : 'Load Session'}
            </Button>
          </Box>

          {sessionError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {sessionError}
            </Alert>
          )}

          {/* Two-pane layout: info panel (left) + content reader (right) */}
          {sessionInfo && (
            <Box
              display="grid"
              gridTemplateColumns={{ xs: '1fr', md: '280px 1fr' }}
              gap={2}
              mt={2}
            >
              {/* Left panel — session summary */}
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Session Info
                </Typography>
                <Box sx={{ fontSize: 13, '& > *': { mb: 0.75 } }}>
                  <Typography variant="body2" noWrap>
                    <strong>URL:</strong>{' '}
                    <Tooltip title={sessionInfo.source_url} arrow><span>{sessionInfo.source_url}</span></Tooltip>
                  </Typography>
                  <Typography variant="body2"><strong>Chunks:</strong> {sessionInfo.total_chunks}</Typography>
                  <Typography variant="body2"><strong>Size:</strong> {(sessionInfo.total_size_bytes / 1024).toFixed(1)} KB</Typography>
                  <Typography variant="body2"><strong>Created:</strong> {new Date(sessionInfo.created_at).toLocaleString()}</Typography>
                </Box>

                <Divider sx={{ my: 1.5 }} />

                {/* Chunk navigator */}
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Chunk Navigator
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <IconButton
                    size="small"
                    disabled={chunkIndex <= 0 || sessionChunkLoading}
                    onClick={() => loadChunk(chunkIndex - 1)}
                  >
                    <NavigateBeforeIcon />
                  </IconButton>
                  <Tooltip title="Zero-based chunk index. Type a number or use ◀ ▶ arrows." arrow>
                    <TextField
                      size="small"
                      type="number"
                      value={chunkIndex}
                      onChange={(e) => setChunkIndex(Number(e.target.value))}
                      inputProps={{ min: 0, max: Math.max(totalChunks - 1, 0), style: { textAlign: 'center', width: 48 } }}
                      sx={{ '& .MuiInputBase-root': { px: 0.5 } }}
                    />
                  </Tooltip>
                  <IconButton
                    size="small"
                    disabled={chunkIndex >= totalChunks - 1 || sessionChunkLoading}
                    onClick={() => loadChunk(chunkIndex + 1)}
                  >
                    <NavigateNextIcon />
                  </IconButton>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {totalChunks > 0 ? `Chunk ${chunkIndex} of ${totalChunks} (0-indexed)` : 'No chunks loaded'}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  onClick={() => loadChunk(chunkIndex)}
                  disabled={sessionChunkLoading || allChunksLoading || !sessionId}
                  startIcon={sessionChunkLoading ? <CircularProgress size={14} /> : undefined}
                  sx={{ mt: 1 }}
                >
                  {sessionChunkLoading ? 'Loading…' : 'Get Chunk'}
                </Button>
                {totalChunks > 0 && totalChunks <= 5 && (
                  <Button
                    variant="contained"
                    size="small"
                    fullWidth
                    onClick={loadAllChunks}
                    disabled={allChunksLoading || sessionChunkLoading || !sessionId}
                    startIcon={allChunksLoading ? <CircularProgress size={14} color="inherit" /> : undefined}
                    sx={{ mt: 1 }}
                  >
                    {allChunksLoading ? 'Merging…' : `Get All (${totalChunks} chunks)`}
                  </Button>
                )}
              </Paper>

              {/* Right panel — chunk content reader */}
              <Paper
                variant="outlined"
                sx={{
                  p: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 300,
                  maxHeight: 520,
                }}
              >
                {/* Reader header */}
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    bgcolor: 'action.hover',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    {allChunksJson
                      ? `All ${totalChunks} chunks (merged)`
                      : chunkData
                        ? `Chunk ${chunkIndex}${chunkData.is_last ? ' (last)' : totalChunks > 0 ? ` of ${totalChunks}` : ''}`
                        : 'Content Reader'}
                  </Typography>
                  {(allChunksJson || chunkJson) && (
                    <Chip
                      label={`${(allChunksJson || chunkJson || '').length.toLocaleString()} chars`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>

                {/* Content area */}
                <Box
                  component="pre"
                  sx={{
                    flexGrow: 1,
                    overflow: 'auto',
                    m: 0,
                    p: 2,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: sessionChunk ? 'text.primary' : 'text.disabled',
                  }}
                >
                  {sessionChunkLoading || allChunksLoading ? (
                    <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                      <CircularProgress size={28} />
                    </Box>
                  ) : allChunksJson ? (
                    allChunksJson
                  ) : sessionChunk ? (
                    chunkJson || '(empty chunk)'
                  ) : (
                    'Select a chunk index and click "Get Chunk", or use ◀ ▶ to navigate.'
                  )}
                </Box>
              </Paper>
            </Box>
          )}


        </CardContent>
      </Card>

      {/* Chunk URLs — automation card */}
      {sessionUrls && sessionUrls.chunk_urls?.length > 0 && (
        <Card sx={{ mt: 3, mb: 4 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <LinkIcon color="primary" />
                <Typography variant="h6">Chunk URLs</Typography>
                <Chip label={`${sessionUrls.chunk_urls.length} URLs`} size="small" />
              </Box>
              <Box display="flex" gap={1}>
                <Tooltip title="Copy all URLs to clipboard (one per line)" arrow>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => navigator.clipboard.writeText(sessionUrls.chunk_urls.join('\n'))}
                  >
                    Copy All
                  </Button>
                </Tooltip>
              </Box>
            </Box>
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              These are plain HTTP GET endpoints for each chunk — no MCP or auth required.
              Use them in <strong>N8N</strong>, <strong>Open WebUI</strong>, <strong>Make</strong>, <strong>Zapier</strong>, or any HTTP client to iterate through scraped content.
            </Alert>
            <Box
              sx={{
                maxHeight: 280,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {sessionUrls.chunk_urls.map((url, idx) => (
                <Box
                  key={idx}
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    bgcolor: idx === chunkIndex ? 'action.selected' : undefined,
                    '&:hover': { bgcolor: 'action.hover' },
                    borderBottom: idx < sessionUrls.chunk_urls.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    cursor: 'pointer',
                  }}
                  onClick={() => loadChunk(idx)}
                >
                  <Box display="flex" alignItems="center" gap={1} sx={{ overflow: 'hidden' }}>
                    <Chip label={idx} size="small" variant="outlined" sx={{ minWidth: 32, fontFamily: 'monospace', fontSize: 11 }} />
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {url}
                    </Typography>
                  </Box>
                  <Tooltip title="Copy this URL" arrow>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(url); }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
