import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Switch,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';

import { api } from '../services/api';
import { logger } from '../services/logging';
import { formatJson } from '../utils/jsonHighlight';
import { useTokens } from '../hooks/useTokens';
import { useGofrPlotUi } from '../hooks/useGofrPlotUi';
import type { JwtToken } from '../types/uiConfig';
import type {
  PlotListHandlersResponse,
  PlotListThemesResponse,
  PlotRenderGraphResponse,
  PlotGetImageResponse,
  PlotAddPlotFragmentResponse,
  PlotFormat,
  DocListActiveSessionsResponse,
  DocListSessionFragmentsResponse,
} from '../types/gofrDoc';
import TokenSelect from '../components/common/TokenSelect';
import RequestPreview from '../components/common/RequestPreview';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import RawResponsePopupIcon from '../components/common/RawResponsePopupIcon';

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; error: Error } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const normalized = b64.replace(/^data:.*?;base64,/, '');
  const raw = atob(normalized);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function downloadBlob(bytes: Uint8Array, filename: string, contentType: string): void {
  const part = bytes as unknown as BlobPart;
  const blob = new Blob([part], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const DEFAULT_SERIES_JSON = JSON.stringify(
  {
    title: 'Example plot',
    y1: [1, 2, 3, 2, 4],
  },
  null,
  2,
);

export default function GofrPlotBuilder() {
  const { tokens } = useTokens();
  const { state: uiState, setState: setUiState } = useGofrPlotUi();

  const selectedToken: JwtToken | null = useMemo(() => {
    const idx = uiState.selectedTokenIndex;
    return idx >= 0 && idx < tokens.length ? tokens.at(idx) ?? null : null;
  }, [tokens, uiState.selectedTokenIndex]);

  const requireToken = (): string => {
    if (!selectedToken?.token) throw new Error('Auth required: select a token');
    return selectedToken.token;
  };

  const [themesLoading, setThemesLoading] = useState(false);
  const [themesErr, setThemesErr] = useState<unknown>(null);
  const [themesRes, setThemesRes] = useState<PlotListThemesResponse | null>(null);

  const [handlersLoading, setHandlersLoading] = useState(false);
  const [handlersErr, setHandlersErr] = useState<unknown>(null);
  const [handlersRes, setHandlersRes] = useState<PlotListHandlersResponse | null>(null);

  const [proxy, setProxy] = useState(false);
  const [alias, setAlias] = useState('');
  const [format, setFormat] = useState<PlotFormat>('png');

  const [seriesJson, setSeriesJson] = useState(DEFAULT_SERIES_JSON);
  const [validateErr, setValidateErr] = useState<unknown>(null);

  const [renderLoading, setRenderLoading] = useState(false);
  const [renderErr, setRenderErr] = useState<unknown>(null);
  const [renderRes, setRenderRes] = useState<PlotRenderGraphResponse | null>(null);

  const [getLoading, setGetLoading] = useState(false);
  const [getErr, setGetErr] = useState<unknown>(null);
  const [getRes, setGetRes] = useState<PlotGetImageResponse | null>(null);

  // Embed (add_plot_fragment) section inside Builder (per user choice)
  const [embedSessionId, setEmbedSessionId] = useState(uiState.targetDocSessionId || '');
  const [embedMode, setEmbedMode] = useState<'guid' | 'inline'>('guid');
  const [embedPlotGuid, setEmbedPlotGuid] = useState(uiState.selectedPlotIdentifier || '');
  const [embedAltText, setEmbedAltText] = useState('');
  const [embedAlignment, setEmbedAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [embedWidth, setEmbedWidth] = useState<string>('');
  const [embedHeight, setEmbedHeight] = useState<string>('');
  const [embedPosition, setEmbedPosition] = useState('end');

  const [sessionFragmentsLoading, setSessionFragmentsLoading] = useState(false);
  const [sessionFragmentsErr, setSessionFragmentsErr] = useState<unknown>(null);
  const [sessionFragmentsRes, setSessionFragmentsRes] = useState<DocListSessionFragmentsResponse | null>(null);

  const [docSessionsLoading, setDocSessionsLoading] = useState(false);
  const [docSessionsErr, setDocSessionsErr] = useState<unknown>(null);
  const [docSessionsRes, setDocSessionsRes] = useState<DocListActiveSessionsResponse | null>(null);

  const [embedLoading, setEmbedLoading] = useState(false);
  const [embedErr, setEmbedErr] = useState<unknown>(null);
  const [embedRes, setEmbedRes] = useState<PlotAddPlotFragmentResponse | null>(null);

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-PLOT Builder page viewed',
      component: 'GofrPlotBuilder',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

  useEffect(() => {
    if (uiState.targetDocSessionId && uiState.targetDocSessionId !== embedSessionId) {
      setEmbedSessionId(uiState.targetDocSessionId);
    }
  }, [uiState.targetDocSessionId, embedSessionId]);

  useEffect(() => {
    if (uiState.selectedPlotIdentifier && uiState.selectedPlotIdentifier !== embedPlotGuid) {
      setEmbedPlotGuid(uiState.selectedPlotIdentifier);
    }
  }, [uiState.selectedPlotIdentifier, embedPlotGuid]);

  const loadThemes = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setThemesLoading(true);
    setThemesErr(null);
    setThemesRes(null);
    try {
      const res = await api.docPlotListThemes();
      setThemesRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'list_themes succeeded',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'list_themes',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setThemesErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_themes failed',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'list_themes',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setThemesLoading(false);
    }
  };

  const loadHandlers = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setHandlersLoading(true);
    setHandlersErr(null);
    setHandlersRes(null);
    try {
      const res = await api.docPlotListHandlers();
      setHandlersRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'list_handlers succeeded',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'list_handlers',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setHandlersErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_handlers failed',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'list_handlers',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setHandlersLoading(false);
    }
  };

  const validateJson = () => {
    setValidateErr(null);
    const parsed = safeJsonParse(seriesJson);
    if (!parsed.ok) {
      setValidateErr(parsed.error);
      return;
    }
    setSeriesJson(formatJson(seriesJson));
  };

  const runRender = async () => {
    const token = requireToken();

    const parsed = safeJsonParse(seriesJson);
    if (!parsed.ok) {
      setValidateErr(parsed.error);
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();

    setRenderLoading(true);
    setRenderErr(null);
    setRenderRes(null);
    setGetErr(null);
    setGetRes(null);

    try {
      const payload = {
        ...(parsed.value && typeof parsed.value === 'object' ? (parsed.value as Record<string, unknown>) : {}),
        theme: uiState.selectedTheme || undefined,
        type: uiState.selectedHandler || undefined,
        format,
        proxy,
        ...(proxy && alias.trim() ? { alias: alias.trim() } : {}),
      };

      const res = await api.docPlotRenderGraph(token, payload);
      setRenderRes(res);

      if (res.mode === 'proxy') {
        setUiState({ selectedPlotIdentifier: res.data.guid });
      }

      logger.info({
        event: 'ui_form_submitted',
        message: 'render_graph succeeded',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'render_graph',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setRenderErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'render_graph failed',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'render_graph',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setRenderLoading(false);
    }
  };

  const runGetFromProxyGuid = async (guid: string) => {
    const token = requireToken();
    const id = guid.trim();
    if (!id) return;

    const requestId = logger.createRequestId();
    const startedAt = performance.now();

    setGetLoading(true);
    setGetErr(null);
    setGetRes(null);

    try {
      const res = await api.docPlotGetImage(token, id);
      setGetRes(res);
      setUiState({ selectedPlotIdentifier: id });

      logger.info({
        event: 'ui_form_submitted',
        message: 'get_image succeeded',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'get_image',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setGetErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'get_image failed',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'get_image',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setGetLoading(false);
    }
  };

  const loadSessionFragments = async () => {
    const token = requireToken();
    const sessionId = embedSessionId.trim();
    if (!sessionId) {
      setSessionFragmentsErr(new Error('session_id is required'));
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();

    setSessionFragmentsLoading(true);
    setSessionFragmentsErr(null);
    setSessionFragmentsRes(null);

    try {
      const res = await api.docListSessionFragments(token, sessionId);
      setSessionFragmentsRes(res);

      logger.info({
        event: 'ui_form_submitted',
        message: 'list_session_fragments succeeded',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'list_session_fragments',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setSessionFragmentsErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_session_fragments failed',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'list_session_fragments',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setSessionFragmentsLoading(false);
    }
  };

  const loadDocSessions = async () => {
    const token = requireToken();
    const requestId = logger.createRequestId();
    const startedAt = performance.now();

    setDocSessionsLoading(true);
    setDocSessionsErr(null);
    setDocSessionsRes(null);

    try {
      const res = await api.docListActiveSessions(token);
      setDocSessionsRes(res);

      logger.info({
        event: 'ui_form_submitted',
        message: 'list_active_sessions succeeded (embed session dropdown)',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'list_active_sessions',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setDocSessionsErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_active_sessions failed (embed session dropdown)',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'list_active_sessions',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setDocSessionsLoading(false);
    }
  };

  const runEmbed = async () => {
    const token = requireToken();
    const sessionId = embedSessionId.trim();
    if (!sessionId) {
      setEmbedErr(new Error('session_id is required'));
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();

    setEmbedLoading(true);
    setEmbedErr(null);
    setEmbedRes(null);

    try {
      const args: Record<string, unknown> = {
        session_id: sessionId,
        alignment: embedAlignment,
        position: embedPosition,
      };

      const w = embedWidth.trim();
      if (w) args.width = Number(w);
      const h = embedHeight.trim();
      if (h) args.height = Number(h);

      if (embedAltText.trim()) args.alt_text = embedAltText.trim();

      if (embedMode === 'guid') {
        const guid = embedPlotGuid.trim();
        if (!guid) {
          setEmbedErr(new Error('plot_guid is required in GUID mode'));
          setEmbedLoading(false);
          return;
        }
        args.plot_guid = guid;
      } else {
        const parsed = safeJsonParse(seriesJson);
        if (!parsed.ok) {
          setValidateErr(parsed.error);
          setEmbedLoading(false);
          return;
        }

        Object.assign(args, parsed.value && typeof parsed.value === 'object' ? (parsed.value as Record<string, unknown>) : {});
        if (uiState.selectedTheme) args.theme = uiState.selectedTheme;
        if (uiState.selectedHandler) args.type = uiState.selectedHandler;
        args.format = format;
      }

      const res = await api.docPlotAddPlotFragment(token, args);
      setEmbedRes(res);
      setUiState({ targetDocSessionId: sessionId });

      logger.info({
        event: 'ui_form_submitted',
        message: 'add_plot_fragment succeeded',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'add_plot_fragment',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setEmbedErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'add_plot_fragment failed',
        request_id: requestId,
        component: 'GofrPlotBuilder',
        operation: 'add_plot_fragment',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setEmbedLoading(false);
    }
  };

  const themeOptions = Object.keys(themesRes?.themes ?? {});
  const handlerOptions = Object.keys(handlersRes?.handlers ?? {});

  const canPreviewInline =
    (renderRes?.mode === 'inline' && (renderRes.image.mimeType === 'image/png' || renderRes.image.mimeType === 'image/jpeg')) ||
    (getRes?.image?.mimeType === 'image/png' || getRes?.image?.mimeType === 'image/jpeg');

  const sessionFragments = sessionFragmentsRes?.fragments ?? [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GOFR-PLOT Builder
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Render a plot via GOFR-DOC plot tools. Inline preview supports png/jpg only; pdf is download-only.
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Token
          </Typography>
          <TokenSelect
            tokens={tokens}
            value={uiState.selectedTokenIndex}
            onChange={(index) => setUiState({ selectedTokenIndex: index })}
            sx={{ minWidth: 320 }}
          />
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Render graph
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              onClick={loadThemes}
              disabled={themesLoading}
              startIcon={themesLoading ? <CircularProgress size={16} /> : undefined}
            >
              {themesLoading ? 'Loading…' : 'Load themes'}
            </Button>
            <RequestPreview tool="list_themes" args={{}} />
            <RawResponsePopupIcon title="list_themes raw" data={themesRes ?? themesErr ?? null} />

            <Button
              variant="outlined"
              onClick={loadHandlers}
              disabled={handlersLoading}
              startIcon={handlersLoading ? <CircularProgress size={16} /> : undefined}
            >
              {handlersLoading ? 'Loading…' : 'Load chart types'}
            </Button>
            <RequestPreview tool="list_handlers" args={{}} />
            <RawResponsePopupIcon title="list_handlers raw" data={handlersRes ?? handlersErr ?? null} />
          </Box>

          {themesErr ? <ToolErrorAlert err={themesErr} fallback="list_themes failed" /> : null}
          {handlersErr ? <ToolErrorAlert err={handlersErr} fallback="list_handlers failed" /> : null}

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              label="theme"
              value={uiState.selectedTheme}
              onChange={(e) => setUiState({ selectedTheme: e.target.value })}
              sx={{ width: 220 }}
              size="small"
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              helperText="Defaults from Discovery"
            >
              <option value="" />
              {themeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </TextField>

            <TextField
              select
              label="type"
              value={uiState.selectedHandler}
              onChange={(e) => setUiState({ selectedHandler: e.target.value })}
              sx={{ width: 220 }}
              size="small"
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              helperText="Defaults from Discovery"
            >
              <option value="" />
              {handlerOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </TextField>

            <TextField
              select
              label="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as PlotFormat)}
              sx={{ width: 160 }}
              size="small"
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="png">png</option>
              <option value="jpg">jpg</option>
              <option value="svg">svg</option>
              <option value="pdf">pdf</option>
            </TextField>

            <FormControlLabel
              control={<Switch checked={proxy} onChange={(e) => setProxy(e.target.checked)} />}
              label="proxy"
            />

            <TextField
              label="alias (optional)"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              size="small"
              sx={{ minWidth: 240 }}
              helperText={proxy ? 'Used for list_images + get_image (optional)' : 'Only used in proxy mode'}
              disabled={!proxy}
            />
          </Box>

          <TextField
            label="render_graph params (JSON)"
            value={seriesJson}
            onChange={(e) => setSeriesJson(e.target.value)}
            fullWidth
            multiline
            minRows={6}
            sx={{ mt: 2 }}
          />

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button variant="outlined" onClick={validateJson}>
              Validate JSON
            </Button>
            <Button
              variant="contained"
              onClick={runRender}
              disabled={renderLoading || uiState.selectedTokenIndex < 0}
              startIcon={renderLoading ? <CircularProgress size={16} /> : undefined}
            >
              {renderLoading ? 'Rendering…' : 'Render'}
            </Button>
            <RequestPreview tool="render_graph" args={{ format, proxy, theme: uiState.selectedTheme, type: uiState.selectedHandler }} />
            <RawResponsePopupIcon title="render_graph raw" data={renderRes ?? renderErr ?? null} />
          </Box>

          {validateErr ? <ToolErrorAlert err={validateErr} fallback="Invalid JSON" /> : null}
          {renderErr ? <ToolErrorAlert err={renderErr} fallback="render_graph failed" /> : null}

          {renderRes ? (
            <>
              <Divider sx={{ my: 2 }} />

              {renderRes.mode === 'proxy' ? (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Proxy result
                  </Typography>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    GUID: {renderRes.data.guid}
                  </Alert>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="outlined" onClick={() => runGetFromProxyGuid(renderRes.data.guid)} disabled={getLoading}>
                      Fetch via get_image
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setEmbedMode('guid');
                        setEmbedPlotGuid(renderRes.data.guid);
                        setUiState({ selectedPlotIdentifier: renderRes.data.guid });
                      }}
                    >
                      Use for embed
                    </Button>
                  </Box>
                </>
              ) : (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Inline result
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        const bytes = base64ToBytes(renderRes.image.data);
                        const ext = renderRes.image.mimeType === 'image/jpeg' ? 'jpg' : format;
                        downloadBlob(bytes, `plot.${ext}`, renderRes.image.mimeType);
                      }}
                    >
                      Download
                    </Button>
                  </Box>

                  {renderRes.image.mimeType === 'image/png' || renderRes.image.mimeType === 'image/jpeg' ? (
                    <Box sx={{ mt: 2 }}>
                      <Box
                        component="img"
                        alt={renderRes.meta.title ?? 'plot'}
                        src={`data:${renderRes.image.mimeType};base64,${renderRes.image.data}`}
                        sx={{
                          maxWidth: '100%',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                        }}
                      />
                    </Box>
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Preview not available for this format. Use Download.
                    </Alert>
                  )}
                </>
              )}

              {getErr ? <ToolErrorAlert err={getErr} fallback="get_image failed" /> : null}

              {getRes ? (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    get_image result
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        const bytes = base64ToBytes(getRes.image.data);
                        const fmt = (getRes.meta.format || 'png').toLowerCase();
                        const ext = fmt === 'jpeg' ? 'jpg' : fmt;
                        downloadBlob(bytes, `plot.${ext}`, getRes.image.mimeType);
                      }}
                    >
                      Download
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setEmbedMode('guid');
                        setEmbedPlotGuid(getRes.meta.identifier ?? uiState.selectedPlotIdentifier);
                      }}
                    >
                      Use for embed
                    </Button>
                  </Box>

                  {canPreviewInline ? (
                    <Box sx={{ mt: 2 }}>
                      <Box
                        component="img"
                        alt={getRes.meta.alias ?? getRes.meta.identifier ?? 'plot image'}
                        src={`data:${getRes.image.mimeType};base64,${getRes.image.data}`}
                        sx={{
                          maxWidth: '100%',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                        }}
                      />
                    </Box>
                  ) : (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Preview not available for this format. Use Download.
                    </Alert>
                  )}
                </>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Embed into GOFR-DOC session
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              label="session_id"
              value={embedSessionId}
              onChange={(e) => setEmbedSessionId(e.target.value)}
              size="small"
              sx={{ minWidth: 520 }}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              helperText="Pick an active GOFR-DOC session"
            >
              <option value="" />
              {(docSessionsRes?.sessions ?? []).map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {(s.alias ? `${s.alias} — ` : '')}{s.session_id}{s.template_id ? ` (${s.template_id})` : ''}
                </option>
              ))}
            </TextField>
            <Button
              variant="outlined"
              onClick={loadDocSessions}
              disabled={docSessionsLoading || uiState.selectedTokenIndex < 0}
              startIcon={docSessionsLoading ? <CircularProgress size={16} /> : undefined}
            >
              {docSessionsLoading ? 'Loading…' : 'Load sessions'}
            </Button>
            <RequestPreview tool="list_active_sessions" args={{ auth_token: '(token omitted)', token: '(token omitted)' }} />
            <RawResponsePopupIcon title="list_active_sessions raw" data={docSessionsRes ?? docSessionsErr ?? null} />
            <Button
              variant="outlined"
              onClick={loadSessionFragments}
              disabled={sessionFragmentsLoading || uiState.selectedTokenIndex < 0}
              startIcon={sessionFragmentsLoading ? <CircularProgress size={16} /> : undefined}
            >
              {sessionFragmentsLoading ? 'Loading…' : 'Load positions'}
            </Button>
            <RequestPreview tool="list_session_fragments" args={{ session_id: embedSessionId, auth_token: '(token omitted)', token: '(token omitted)' }} />
            <RawResponsePopupIcon title="list_session_fragments raw" data={sessionFragmentsRes ?? sessionFragmentsErr ?? null} />
          </Box>

          {docSessionsErr ? <ToolErrorAlert err={docSessionsErr} fallback="list_active_sessions failed" /> : null}

          {sessionFragmentsErr ? <ToolErrorAlert err={sessionFragmentsErr} fallback="list_session_fragments failed" /> : null}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              label="mode"
              value={embedMode}
              onChange={(e) => setEmbedMode(e.target.value as 'guid' | 'inline')}
              sx={{ width: 180 }}
              size="small"
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="guid">GUID</option>
              <option value="inline">Inline</option>
            </TextField>

            <TextField
              label="plot_guid"
              value={embedPlotGuid}
              onChange={(e) => setEmbedPlotGuid(e.target.value)}
              size="small"
              sx={{ minWidth: 420 }}
              disabled={embedMode !== 'guid'}
            />

            <TextField
              select
              label="alignment"
              value={embedAlignment}
              onChange={(e) => setEmbedAlignment(e.target.value as 'left' | 'center' | 'right')}
              sx={{ width: 180 }}
              size="small"
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </TextField>

            <TextField
              label="width"
              value={embedWidth}
              onChange={(e) => setEmbedWidth(e.target.value)}
              size="small"
              sx={{ width: 120 }}
              helperText="optional"
            />
            <TextField
              label="height"
              value={embedHeight}
              onChange={(e) => setEmbedHeight(e.target.value)}
              size="small"
              sx={{ width: 120 }}
              helperText="optional"
            />

            <TextField
              label="alt_text"
              value={embedAltText}
              onChange={(e) => setEmbedAltText(e.target.value)}
              size="small"
              sx={{ minWidth: 240 }}
              helperText="optional"
            />

            <TextField
              select
              label="position"
              value={embedPosition}
              onChange={(e) => setEmbedPosition(e.target.value)}
              sx={{ width: 280 }}
              size="small"
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
            >
              <option value="end">end</option>
              <option value="start">start</option>
              {sessionFragments.map((f) => (
                <option key={`before:${f.fragment_instance_guid}`} value={`before:${f.fragment_instance_guid}`}>
                  before: {f.fragment_id ?? f.fragment_instance_guid}
                </option>
              ))}
              {sessionFragments.map((f) => (
                <option key={`after:${f.fragment_instance_guid}`} value={`after:${f.fragment_instance_guid}`}>
                  after: {f.fragment_id ?? f.fragment_instance_guid}
                </option>
              ))}
            </TextField>
          </Box>

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={runEmbed}
              disabled={embedLoading || uiState.selectedTokenIndex < 0}
              startIcon={embedLoading ? <CircularProgress size={16} /> : undefined}
            >
              {embedLoading ? 'Adding…' : 'Add plot fragment'}
            </Button>
            <RequestPreview tool="add_plot_fragment" args={{ session_id: embedSessionId, plot_guid: embedMode === 'guid' ? embedPlotGuid : undefined, position: embedPosition }} />
            <RawResponsePopupIcon title="add_plot_fragment raw" data={embedRes ?? embedErr ?? null} />
          </Box>

          {embedErr ? <ToolErrorAlert err={embedErr} fallback="add_plot_fragment failed" /> : null}

          {embedRes ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              fragment_instance_guid: {(() => {
                const v = (embedRes && typeof embedRes === 'object')
                  ? (embedRes as { fragment_instance_guid?: unknown }).fragment_instance_guid
                  : undefined;
                return typeof v === 'string' ? v : '';
              })()}
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
