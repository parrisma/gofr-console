import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  TextField,
  Typography,
} from '@mui/material';

import { api } from '../services/api';
import { logger } from '../services/logging';
import { useConfig } from '../hooks/useConfig';
import { useGofrDocUi } from '../hooks/useGofrDocUi';
import type { JwtToken } from '../stores/configStore';
import RequestPreview from '../components/common/RequestPreview';
import JsonBlock from '../components/common/JsonBlock';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import PdfPreview from '../components/common/PdfPreview';
import TokenSelect from '../components/common/TokenSelect';
import GofrDocContextStrip from '../components/common/GofrDocContextStrip';
import RawResponsePopupIcon from '../components/common/RawResponsePopupIcon';
import type { DocGetDocumentResponse, DocListStylesResponse, DocRenderFormat } from '../types/gofrDoc';

function base64ToBytes(b64: string): Uint8Array {
  const normalized = b64.replace(/^data:.*?;base64,/, '');
  const raw = atob(normalized);
  // Avoid bracket-index writes (security/detect-object-injection) and ensure ArrayBuffer-backed bytes.
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function downloadBlob(bytes: Uint8Array, filename: string, contentType: string): void {
  // Typed arrays are valid BufferSource/BlobPart, but TS lib.dom typings can get overly strict
  // due to ArrayBufferLike/SharedArrayBuffer generics. Cast explicitly.
  const part = bytes as unknown as BlobPart;
  const blob = new Blob([part], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GofrDocRenderProxy() {
  const { tokens } = useConfig();
  const { state: uiState, setState: setUiState } = useGofrDocUi();

  const selectedToken: JwtToken | null = useMemo(() => {
    const idx = uiState.selectedTokenIndex;
    return idx >= 0 && idx < tokens.length ? tokens.at(idx) ?? null : null;
  }, [tokens, uiState.selectedTokenIndex]);

  const requireToken = (): string => {
    if (!selectedToken?.token) throw new Error('Auth required: select a token');
    return selectedToken.token;
  };

  const tokenMissing = uiState.selectedTokenIndex < 0;

  const [sessionId, setSessionId] = useState(uiState.sessionId || '');
  const [format, setFormat] = useState<DocRenderFormat>('html');
  const [styleId, setStyleId] = useState(uiState.styleId || '');
  const [proxy, setProxy] = useState(false);

  const [stylesLoading, setStylesLoading] = useState(false);
  const [stylesErr, setStylesErr] = useState<unknown>(null);
  const [stylesRes, setStylesRes] = useState<DocListStylesResponse | null>(null);

  const [renderLoading, setRenderLoading] = useState(false);
  const [renderErr, setRenderErr] = useState<unknown>(null);
  const [renderRes, setRenderRes] = useState<DocGetDocumentResponse | null>(null);

  const [proxyGuid, setProxyGuid] = useState('');
  const [proxyFetchLoading, setProxyFetchLoading] = useState(false);
  const [proxyFetchErr, setProxyFetchErr] = useState<unknown>(null);
  const [proxyFetchMeta, setProxyFetchMeta] = useState<{ status: number; contentType: string; size: number } | null>(null);
  const [proxyFetchBodyPreview, setProxyFetchBodyPreview] = useState<string>('');

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-DOC Render page viewed',
      component: 'GofrDocRenderProxy',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

  useEffect(() => {
    if (uiState.sessionId && uiState.sessionId !== sessionId) setSessionId(uiState.sessionId);
  }, [uiState.sessionId, sessionId]);

  const loadStyles = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setStylesLoading(true);
    setStylesErr(null);
    setStylesRes(null);
    try {
      const res = await api.docListStyles();
      setStylesRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'list_styles succeeded',
        request_id: requestId,
        component: 'GofrDocRenderProxy',
        operation: 'list_styles',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setStylesErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_styles failed',
        request_id: requestId,
        component: 'GofrDocRenderProxy',
        operation: 'list_styles',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setStylesLoading(false);
    }
  };

  const runRender = async () => {
    const token = requireToken();
    const sId = sessionId.trim();
    if (!sId) {
      setRenderErr(new Error('session_id is required'));
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setRenderLoading(true);
    setRenderErr(null);
    setRenderRes(null);
    setProxyGuid('');
    try {
      const res = await api.docGetDocument(token, {
        sessionId: sId,
        format,
        styleId: styleId.trim() || undefined,
        proxy,
      });
      setRenderRes(res);
      setUiState({ sessionId: sId, styleId: styleId.trim() });
      if (res.proxy_guid) setProxyGuid(String(res.proxy_guid));
      logger.info({
        event: 'ui_form_submitted',
        message: 'get_document succeeded',
        request_id: requestId,
        component: 'GofrDocRenderProxy',
        operation: 'get_document',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setRenderErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'get_document failed',
        request_id: requestId,
        component: 'GofrDocRenderProxy',
        operation: 'get_document',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setRenderLoading(false);
    }
  };

  const inlineContent = typeof renderRes?.content === 'string' ? renderRes?.content : '';

  let pdfBytes: Uint8Array | null = null;
  if (format === 'pdf' && inlineContent && !proxy) {
    try {
      pdfBytes = base64ToBytes(inlineContent);
    } catch {
      pdfBytes = null;
    }
  }

  const renderPreview = () => {
    if (!renderRes) return null;
    if (proxy) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Proxy mode enabled. Use proxy_guid for downloads.
        </Alert>
      );
    }

    if (format === 'html') {
      // Safe HTML preview: use sandboxed iframe with srcDoc.
      return (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            HTML preview (sandboxed)
          </Typography>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <iframe
              title="gofr-doc-html-preview"
              sandbox=""
              srcDoc={inlineContent}
              style={{ width: '100%', height: 560, border: 0 }}
            />
          </Box>
        </Box>
      );
    }

    if (format === 'md') {
      return (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Markdown
          </Typography>
          <JsonBlock data={inlineContent || null} copyLabel="Copy markdown" maxHeight={420} />
        </Box>
      );
    }

    if (format === 'pdf') {
      return (
        <Box sx={{ mt: 2 }}>
          {pdfBytes ? <PdfPreview pdfData={pdfBytes} /> : (
            <Alert severity="warning" sx={{ mt: 1 }}>
              PDF content was not valid base64 or could not be decoded. Raw response is still available below.
            </Alert>
          )}
          {pdfBytes ? (
            <Button
              sx={{ mt: 2 }}
              variant="outlined"
              onClick={() => downloadBlob(pdfBytes as Uint8Array, 'document.pdf', 'application/pdf')}
            >
              Download PDF
            </Button>
          ) : null}
        </Box>
      );
    }

    return null;
  };

  const fetchProxy = async () => {
    const token = requireToken();
    const guid = proxyGuid.trim();
    if (!guid) {
      setProxyFetchErr(new Error('proxy_guid is required'));
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setProxyFetchLoading(true);
    setProxyFetchErr(null);
    setProxyFetchMeta(null);
    setProxyFetchBodyPreview('');

    try {
      // Best-effort: support either /proxy/<guid> or /proxy?proxy_guid=<guid> depending on server.
      // Try path form first.
      const tryUrls = [
        `/api/gofr-doc/proxy/${encodeURIComponent(guid)}`,
        `/api/gofr-doc/proxy?proxy_guid=${encodeURIComponent(guid)}`,
      ];

      let response: Response | null = null;
      let lastErr: unknown = null;

      for (const url of tryUrls) {
        try {
          // Do NOT log token. Send as Authorization header only.
          const r = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          response = r;
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!response) throw (lastErr instanceof Error ? lastErr : new Error('Proxy fetch failed'));

      const contentType = response.headers.get('content-type') || 'unknown';
      const buf = new Uint8Array(await response.arrayBuffer());
      setProxyFetchMeta({ status: response.status, contentType, size: buf.byteLength });

      const previewBytes = buf.slice(0, Math.min(buf.byteLength, 4096));
      try {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(previewBytes);
        setProxyFetchBodyPreview(text);
      } catch {
        setProxyFetchBodyPreview('');
      }

      logger.info({
        event: 'ui_form_submitted',
        message: 'proxy download test completed',
        request_id: requestId,
        component: 'GofrDocRenderProxy',
        operation: 'proxy_download',
        result: response.ok ? 'success' : 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { status: response.status, content_type: contentType, size: buf.byteLength },
      });

      if (response.ok) {
        const ext = contentType.includes('pdf') ? 'pdf' : (contentType.includes('html') ? 'html' : 'bin');
        downloadBlob(buf, `proxy-${guid}.${ext}`, contentType);
      }
    } catch (e) {
      setProxyFetchErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'proxy download test failed',
        request_id: requestId,
        component: 'GofrDocRenderProxy',
        operation: 'proxy_download',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setProxyFetchLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GOFR-DOC Render & Proxy
      </Typography>
      <GofrDocContextStrip />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Render a session as HTML/Markdown/PDF and optionally test proxy downloads. HTML preview runs in a sandboxed iframe.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Token (required)
          </Typography>
          <TokenSelect
            label="Token"
            tokens={tokens}
            value={uiState.selectedTokenIndex}
            onChange={(idx) => setUiState({ selectedTokenIndex: idx })}
            allowNone={false}
            noneLabel="Select token"
            fullWidth
          />
          {tokenMissing ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Auth required: select a token.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              Using token: {selectedToken?.name}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6">Choose styling</Typography>
            <RawResponsePopupIcon title="Raw list_styles response" data={stylesRes} />
          </Box>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={loadStyles}
              disabled={stylesLoading}
              startIcon={stylesLoading ? <CircularProgress size={16} /> : undefined}
            >
              {stylesLoading ? 'Loading…' : 'Browse styles'}
            </Button>
            <RequestPreview tool="list_styles" args={{}} />
          </Box>
          {stylesErr ? <ToolErrorAlert err={stylesErr} fallback="list_styles failed" /> : null}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6">Generate output</Typography>
            <RawResponsePopupIcon title="Raw get_document response" data={renderRes} />
          </Box>
          <TextField
            label="session_id"
            value={sessionId}
            onChange={(e) => {
              const v = e.target.value;
              setSessionId(v);
              setUiState({ sessionId: v });
            }}
            fullWidth
            sx={{ mt: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            <TextField
              select
              label="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as DocRenderFormat)}
              sx={{ minWidth: 200 }}
              SelectProps={{ native: true }}
            >
              <option value="html">html</option>
              <option value="md">md</option>
              <option value="pdf">pdf</option>
            </TextField>
            <TextField
              label="style_id (optional)"
              value={styleId}
              onChange={(e) => {
                const v = e.target.value;
                setStyleId(v);
                setUiState({ styleId: v });
              }}
              sx={{ minWidth: 260 }}
            />
            <TextField
              select
              label="proxy"
              value={proxy ? 'true' : 'false'}
              onChange={(e) => setProxy(e.target.value === 'true')}
              sx={{ minWidth: 160 }}
              SelectProps={{ native: true }}
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </TextField>
          </Box>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={runRender}
              disabled={renderLoading}
              startIcon={renderLoading ? <CircularProgress size={16} /> : undefined}
            >
              {renderLoading ? 'Generating…' : 'Generate output'}
            </Button>
            <RequestPreview tool="get_document" args={{ session_id: sessionId, format, style_id: styleId, proxy }} />
          </Box>
          {renderErr ? <ToolErrorAlert err={renderErr} fallback="get_document failed" /> : null}
          {renderPreview()}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Typography variant="h6">Download proxy output</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            When proxy=true, the server returns proxy_guid and download_url. Use proxy_guid here.
          </Typography>
          <TextField
            label="proxy_guid"
            value={proxyGuid}
            onChange={(e) => setProxyGuid(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={fetchProxy}
              disabled={proxyFetchLoading}
              startIcon={proxyFetchLoading ? <CircularProgress size={16} /> : undefined}
            >
              {proxyFetchLoading ? 'Downloading…' : 'Download proxy output'}
            </Button>
            <RequestPreview tool="proxy_download" args={{ proxy_guid: proxyGuid }} />
          </Box>
          {proxyFetchErr ? <ToolErrorAlert err={proxyFetchErr} fallback="proxy download failed" /> : null}

          {proxyFetchMeta ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">Status: {proxyFetchMeta.status}</Typography>
              <Typography variant="body2">Content-Type: {proxyFetchMeta.contentType}</Typography>
              <Typography variant="body2">Size: {proxyFetchMeta.size} bytes</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" gutterBottom>
                Body preview (first 4KB)
              </Typography>
              <RawResponsePopupIcon title="Raw proxy body preview" data={proxyFetchBodyPreview || null} maxHeight={240} />
            </Box>
          ) : null}
        </CardContent>
      </Card>

      <Alert severity="warning">
        HTML is rendered in an iframe sandbox with scripts disabled. Raw HTML is still visible in the response JSON.
      </Alert>
    </Box>
  );
}
