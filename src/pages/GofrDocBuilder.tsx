import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { api } from '../services/api';
import { logger } from '../services/logging';
import { useConfig } from '../hooks/useConfig';
import { useGofrDocUi } from '../hooks/useGofrDocUi';
import type { JwtToken } from '../stores/configStore';
import RequestPreview from '../components/common/RequestPreview';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import TokenSelect from '../components/common/TokenSelect';
import GofrDocContextStrip from '../components/common/GofrDocContextStrip';
import RawResponsePopupIcon from '../components/common/RawResponsePopupIcon';
import ExamplesPopupIcon from '../components/common/ExamplesPopupIcon';
import JsonBlock from '../components/common/JsonBlock';
import { buildParamsFromSchema } from '../utils/buildParamsFromSchema';
import type {
  DocAddFragmentResponse,
  DocAddImageFragmentResponse,
  DocFragmentDetailsResponse,
  DocListSessionFragmentsResponse,
  DocRemoveFragmentResponse,
  DocSetGlobalParametersResponse,
  DocTemplateDetailsResponse,
  DocTemplateFragmentSummary,
} from '../types/gofrDoc';

const TEMPLATE_PARAMETERS_EXAMPLES: Array<string> = [
  JSON.stringify({}, null, 2),
  JSON.stringify(
    {
      as_of: '2026-02-17',
      client_name: 'Example Client',
      analyst: 'Example Analyst',
    },
    null,
    2,
  ),
];

const FRAGMENT_PARAMETERS_EXAMPLES: Array<string> = [
  JSON.stringify(
    {
      text: 'Key points for the client meeting go here.',
    },
    null,
    2,
  ),
  JSON.stringify(
    {
      title: 'Table example',
      columns: ['Item', 'Value'],
      rows: [
        ['Revenue', '123'],
        ['EBITDA', '45'],
      ],
    },
    null,
    2,
  ),
];

function safeJsonParse(input: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
}

function isValidPosition(input: string): boolean {
  const v = input.trim();
  if (!v) return true;
  if (v === 'start' || v === 'end') return true;
  if (v.startsWith('before:') && v.length > 'before:'.length) return true;
  if (v.startsWith('after:') && v.length > 'after:'.length) return true;
  return false;
}

type JsonValidationResult = {
  is_valid: boolean;
  errors?: string[];
};

type StockImagesListResponse = {
  status?: string;
  data?: {
    images?: unknown;
    count?: unknown;
  };
};

function encodePathSegments(input: string): string {
  const trimmed = input.replace(/^\/+/, '');
  const parts = trimmed.split('/').filter(Boolean);
  return parts.map((p) => encodeURIComponent(p)).join('/');
}

function isSafeRelativeImagePath(path: string): boolean {
  if (!path) return false;
  if (path.startsWith('/') || path.startsWith('\\')) return false;
  if (path.includes('..') || path.includes('\\')) return false;
  return true;
}

export default function GofrDocBuilder() {
  const { tokens, environment, mcpServices } = useConfig();
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

  const [templateId, setTemplateId] = useState(uiState.templateId || '');
  const [sessionId, setSessionId] = useState(uiState.sessionId || '');

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-DOC Builder page viewed',
      component: 'GofrDocBuilder',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

  useEffect(() => {
    if (uiState.templateId && uiState.templateId !== templateId) setTemplateId(uiState.templateId);
    if (uiState.sessionId && uiState.sessionId !== sessionId) setSessionId(uiState.sessionId);
  }, [uiState.sessionId, uiState.templateId, sessionId, templateId]);

  // ── Template details (auto-fetch for pre-population) ──
  const [, setTemplateDetails] = useState<DocTemplateDetailsResponse | null>(null);
  const [parametersJson, setParametersJson] = useState('{}');

  useEffect(() => {
    const tId = templateId.trim();
    if (!tId) {
      setTemplateDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.docGetTemplateDetails(tId, selectedToken?.token ?? undefined);
        if (cancelled) return;
        setTemplateDetails(res);
        const schema = buildParamsFromSchema(res.global_parameters);
        setParametersJson(JSON.stringify(schema, null, 2));
        logger.info({
          event: 'ui_auto_fetch',
          message: 'template details fetched for builder',
          component: 'GofrDocBuilder',
          operation: 'get_template_details',
          result: 'success',
        });
      } catch (e) {
        if (cancelled) return;
        logger.warn({
          event: 'ui_auto_fetch',
          message: 'template details fetch failed (non-blocking)',
          component: 'GofrDocBuilder',
          operation: 'get_template_details',
          result: 'failure',
          data: { cause: e instanceof Error ? e.message : 'unknown' },
        });
      }
    })();
    return () => { cancelled = true; };
  }, [templateId, selectedToken?.token]);

  // ── Validate parameters ──
  const [validateErr, setValidateErr] = useState<unknown>(null);
  const [validateRes, setValidateRes] = useState<JsonValidationResult | null>(null);

  const runValidate = () => {
    setValidateErr(null);
    setValidateRes(null);
    const parsed = safeJsonParse(parametersJson);
    if (!parsed.ok) {
      setValidateErr(new Error(`Invalid JSON: ${parsed.error}`));
      return;
    }

    setValidateRes({ is_valid: true });
  };

  // ── Set global parameters ──
  const [globalsLoading, setGlobalsLoading] = useState(false);
  const [globalsErr, setGlobalsErr] = useState<unknown>(null);
  const [globalsRes, setGlobalsRes] = useState<DocSetGlobalParametersResponse | null>(null);

  const runSetGlobals = async () => {
    const token = requireToken();
    const sId = sessionId.trim();
    if (!sId) {
      setGlobalsErr(new Error('session_id is required'));
      return;
    }
    const parsed = safeJsonParse(parametersJson);
    if (!parsed.ok) {
      setGlobalsErr(new Error(`Invalid JSON: ${parsed.error}`));
      return;
    }
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setGlobalsLoading(true);
    setGlobalsErr(null);
    setGlobalsRes(null);
    try {
      const res = await api.docSetGlobalParameters(token, sId, parsed.value);
      setGlobalsRes(res);
      setUiState({ sessionId: sId });
      logger.info({
        event: 'ui_form_submitted',
        message: 'set_global_parameters succeeded',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'set_global_parameters',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setGlobalsErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'set_global_parameters failed',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'set_global_parameters',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setGlobalsLoading(false);
    }
  };

  // ── Available fragment types (from template) ──
  const [availableFragments, setAvailableFragments] = useState<DocTemplateFragmentSummary[]>([]);

  useEffect(() => {
    const tId = templateId.trim();
    if (!tId) {
      setAvailableFragments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.docListTemplateFragments(tId, selectedToken?.token ?? undefined);
        if (cancelled) return;
        setAvailableFragments(res.fragments ?? []);
      } catch {
        if (cancelled) return;
        setAvailableFragments([]);
      }
    })();
    return () => { cancelled = true; };
  }, [templateId, selectedToken?.token]);

  // ── Session fragments (list, add, remove) ──
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState<unknown>(null);
  const [listRes, setListRes] = useState<DocListSessionFragmentsResponse | null>(null);
  const [expandedGuid, setExpandedGuid] = useState<string | null>(null);

  const refreshSessionFragments = useCallback(async () => {
    const sId = sessionId.trim();
    if (!sId || tokenMissing) return;
    const token = requireToken();
    setListLoading(true);
    setListErr(null);
    try {
      const res = await api.docListSessionFragments(token, sId);
      setListRes(res);
    } catch (e) {
      setListErr(e);
    } finally {
      setListLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, tokenMissing, selectedToken?.token]);

  useEffect(() => {
    if (sessionId.trim() && !tokenMissing) {
      refreshSessionFragments();
    }
  }, [sessionId, tokenMissing, refreshSessionFragments]);

  // ── Add fragment ──
  const [selectedFragmentType, setSelectedFragmentType] = useState('');
  const [fragmentParamsJson, setFragmentParamsJson] = useState('{}');
  const [fragmentDetailsLoading, setFragmentDetailsLoading] = useState(false);
  const [addFragmentPosition, setAddFragmentPosition] = useState('end');
  const [addFragmentLoading, setAddFragmentLoading] = useState(false);
  const [addFragmentErr, setAddFragmentErr] = useState<unknown>(null);
  const [addFragmentRes, setAddFragmentRes] = useState<DocAddFragmentResponse | null>(null);

  // Fetch fragment details when type changes (for pre-population)
  useEffect(() => {
    const fId = selectedFragmentType;
    if (!fId || fId === '__image__') {
      setFragmentParamsJson('{}');
      return;
    }
    const tId = templateId.trim();
    if (!tId) return;
    let cancelled = false;
    (async () => {
      setFragmentDetailsLoading(true);
      try {
        const res: DocFragmentDetailsResponse = await api.docGetFragmentDetails(tId, fId, selectedToken?.token ?? undefined);
        if (cancelled) return;
        const schema = buildParamsFromSchema(res.parameters);
        setFragmentParamsJson(JSON.stringify(schema, null, 2));
      } catch {
        if (cancelled) return;
        setFragmentParamsJson('{}');
      } finally {
        if (!cancelled) setFragmentDetailsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedFragmentType, templateId, selectedToken?.token]);

  const runAddFragment = async () => {
    const token = requireToken();
    const sId = sessionId.trim();
    if (!sId) {
      setAddFragmentErr(new Error('session_id is required'));
      return;
    }
    const fId = selectedFragmentType;
    if (!fId || fId === '__image__') {
      setAddFragmentErr(new Error('Select a fragment type'));
      return;
    }
    if (!isValidPosition(addFragmentPosition)) {
      setAddFragmentErr(new Error('Invalid position. Use start/end/before:<guid>/after:<guid>.'));
      return;
    }
    const parsed = safeJsonParse(fragmentParamsJson);
    if (!parsed.ok) {
      setAddFragmentErr(new Error(`Invalid JSON: ${parsed.error}`));
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setAddFragmentLoading(true);
    setAddFragmentErr(null);
    setAddFragmentRes(null);
    try {
      const res = await api.docAddFragment(token, {
        sessionId: sId,
        fragmentId: fId,
        parameters: parsed.value,
        position: addFragmentPosition.trim() || undefined,
      });
      setAddFragmentRes(res);
      setUiState({ sessionId: sId });
      logger.info({
        event: 'ui_form_submitted',
        message: 'add_fragment succeeded',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'add_fragment',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
      // Reset form & refresh table
      setSelectedFragmentType('');
      setFragmentParamsJson('{}');
      setAddFragmentPosition('end');
      await refreshSessionFragments();
    } catch (e) {
      setAddFragmentErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'add_fragment failed',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'add_fragment',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setAddFragmentLoading(false);
    }
  };

  // ── Add image fragment ──
  const [imgUrl, setImgUrl] = useState('');
  const [imgTitle, setImgTitle] = useState('');
  const [imgAlt, setImgAlt] = useState('');
  const [imgAlignment, setImgAlignment] = useState('');
  const [imgRequireHttps, setImgRequireHttps] = useState(true);
  const [imgWidth, setImgWidth] = useState<string>('');
  const [imgHeight, setImgHeight] = useState<string>('');
  const [imgPosition, setImgPosition] = useState('end');
  const [imgLoading, setImgLoading] = useState(false);
  const [imgErr, setImgErr] = useState<unknown>(null);
  const [imgRes, setImgRes] = useState<DocAddImageFragmentResponse | null>(null);

  // ── Stock images picker (gofr-doc GET /images) ──
  const [stockImagesLoading, setStockImagesLoading] = useState(false);
  const [stockImagesErr, setStockImagesErr] = useState<unknown>(null);
  const [stockImages, setStockImages] = useState<string[]>([]);
  const [stockUrlSource, setStockUrlSource] = useState<'internal' | 'proxy'>('internal');

  const computeStockImageUrl = (relativePath: string): string => {
    const encoded = encodePathSegments(relativePath);
    if (stockUrlSource === 'proxy') {
      return new URL(`/api/gofr-doc/images/${encoded}`, window.location.origin).toString();
    }

    const docService = mcpServices.find((s) => s.name === 'gofr-doc');
    const host = (docService?.containerHostname ?? 'gofr-doc-mcp').replace(/-mcp$/, '-web');
    const webPort = environment === 'prod' ? docService?.ports?.prod?.web : docService?.ports?.dev?.web;
    const mcpPort = environment === 'prod' ? docService?.ports?.prod?.mcp : docService?.ports?.dev?.mcp;
    const port = typeof webPort === 'number' ? webPort : (typeof mcpPort === 'number' ? mcpPort : 8040);
    return `http://${host}:${port}/images/${encoded}`;
  };

  const loadStockImages = async (): Promise<void> => {
    setStockImagesLoading(true);
    setStockImagesErr(null);
    try {
      const res = await fetch('/api/gofr-doc/images', { method: 'GET' });
      if (!res.ok) throw new Error(`stock images request failed (HTTP ${res.status})`);
      const json = (await res.json()) as StockImagesListResponse;
      const imagesUnknown = json?.data?.images;
      const list = Array.isArray(imagesUnknown) ? imagesUnknown : [];
      const paths: string[] = [];
      for (const entry of list) {
        if (typeof entry !== 'string') continue;
        if (!isSafeRelativeImagePath(entry)) continue;
        paths.push(entry);
      }
      setStockImages(paths);
    } catch (e) {
      setStockImagesErr(e);
      setStockImages([]);
    } finally {
      setStockImagesLoading(false);
    }
  };

  const runAddImage = async () => {
    const token = requireToken();
    const sId = sessionId.trim();
    if (!sId) {
      setImgErr(new Error('session_id is required'));
      return;
    }
    const u = imgUrl.trim();
    if (!u) {
      setImgErr(new Error('image_url is required'));
      return;
    }
    if (!isValidPosition(imgPosition)) {
      setImgErr(new Error('Invalid position. Use start/end/before:<guid>/after:<guid>.'));
      return;
    }

    const width = imgWidth.trim() ? Number(imgWidth.trim()) : undefined;
    const height = imgHeight.trim() ? Number(imgHeight.trim()) : undefined;
    if (width != null && Number.isNaN(width)) {
      setImgErr(new Error('width must be a number'));
      return;
    }
    if (height != null && Number.isNaN(height)) {
      setImgErr(new Error('height must be a number'));
      return;
    }
    if (width != null && height != null) {
      setImgErr(new Error('Specify width OR height (or neither), not both'));
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setImgLoading(true);
    setImgErr(null);
    setImgRes(null);
    try {
      const res = await api.docAddImageFragment(token, {
        sessionId: sId,
        imageUrl: u,
        title: imgTitle.trim() || undefined,
        altText: imgAlt.trim() || undefined,
        alignment: imgAlignment.trim() || undefined,
        requireHttps: imgRequireHttps,
        width,
        height,
        position: imgPosition.trim() || undefined,
      });
      setImgRes(res);
      setUiState({ sessionId: sId });
      logger.info({
        event: 'ui_form_submitted',
        message: 'add_image_fragment succeeded',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'add_image_fragment',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
      // Reset image form & refresh table
      setImgUrl('');
      setImgTitle('');
      setImgAlt('');
      setImgAlignment('');
      setImgWidth('');
      setImgHeight('');
      setImgPosition('end');
      setSelectedFragmentType('');
      await refreshSessionFragments();
    } catch (e) {
      setImgErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'add_image_fragment failed',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'add_image_fragment',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setImgLoading(false);
    }
  };

  // ── Remove fragment ──
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeErr, setRemoveErr] = useState<unknown>(null);
  const [removeRes, setRemoveRes] = useState<DocRemoveFragmentResponse | null>(null);

  const runRemove = async (guid: string) => {
    const token = requireToken();
    const sId = sessionId.trim();
    if (!sId) {
      setRemoveErr(new Error('session_id is required'));
      return;
    }
    if (!guid) {
      setRemoveErr(new Error('fragment_instance_guid is required'));
      return;
    }
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setRemoveLoading(true);
    setRemoveErr(null);
    setRemoveRes(null);
    try {
      const res = await api.docRemoveFragment(token, sId, guid);
      setRemoveRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'remove_fragment succeeded',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'remove_fragment',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
      await refreshSessionFragments();
    } catch (e) {
      setRemoveErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'remove_fragment failed',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'remove_fragment',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GOFR-DOC Builder
      </Typography>
      <GofrDocContextStrip />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Build a document session by setting globals and adding/removing fragments. All requests are shown for copy/paste.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Context
          </Typography>
          <TokenSelect
            label="Token"
            tokens={tokens}
            value={uiState.selectedTokenIndex}
            onChange={(idx) => setUiState({ selectedTokenIndex: idx })}
            allowNone={false}
            noneLabel="Select token"
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="template_id"
            value={templateId}
            onChange={(e) => {
              const v = e.target.value;
              setTemplateId(v);
              setUiState({ templateId: v });
            }}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="session_id"
            value={sessionId}
            onChange={(e) => {
              const v = e.target.value;
              setSessionId(v);
              setUiState({ sessionId: v });
            }}
            fullWidth
          />
          {tokenMissing ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Auth required: select a token in Sessions.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6">Template parameters</Typography>
            <ExamplesPopupIcon
              title="Examples (shape varies by template)"
              examples={TEMPLATE_PARAMETERS_EXAMPLES}
            />
            <RawResponsePopupIcon title="Raw JSON validation result" data={validateRes} />
            <RawResponsePopupIcon title="Raw set_global_parameters response" data={globalsRes} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Enter the parameter details required to set the template level detail.
          </Typography>
          <TextField
            label="parameters (JSON)"
            value={parametersJson}
            onChange={(e) => setParametersJson(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              onClick={runValidate}
            >
              Validate
            </Button>
            <Button
              variant="contained"
              onClick={runSetGlobals}
              disabled={globalsLoading}
              startIcon={globalsLoading ? <CircularProgress size={16} /> : undefined}
            >
              {globalsLoading ? 'Saving…' : 'Set parameters'}
            </Button>
            <RequestPreview
              tool="set_global_parameters"
              args={{ session_id: sessionId, parameters: '(JSON omitted here)' }}
            />
          </Box>
          {validateErr ? <ToolErrorAlert err={validateErr} fallback="invalid JSON" /> : null}
          {validateRes ? (
            validateRes.is_valid ? (
              <Alert severity="success" sx={{ mt: 2 }}>
                JSON is valid.
              </Alert>
            ) : (
              <Alert severity="warning" sx={{ mt: 2 }}>
                JSON is invalid. {validateRes.errors?.length ? `Errors: ${validateRes.errors.length}` : ''}
              </Alert>
            )
          ) : null}
          {globalsErr ? <ToolErrorAlert err={globalsErr} fallback="set_global_parameters failed" /> : null}
          {globalsRes ? (
            <Alert severity={globalsRes.success ? 'success' : 'warning'} sx={{ mt: 2 }}>
              {globalsRes.message ?? (globalsRes.success ? 'Global parameters saved.' : 'Global parameters not saved.')}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {/* ── Fragments (unified card) ── */}
      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6">Fragments</Typography>
            <RawResponsePopupIcon title="Raw list_session_fragments response" data={listRes} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
            Add, review and remove fragments in the current session.
          </Typography>

          {/* Section A: Current fragments table */}
          {listLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
              <CircularProgress size={18} />
              <Typography variant="body2">Loading fragments…</Typography>
            </Box>
          ) : null}
          {listErr ? <ToolErrorAlert err={listErr} fallback="list_session_fragments failed" /> : null}
          {removeErr ? <ToolErrorAlert err={removeErr} fallback="remove_fragment failed" /> : null}
          {removeRes ? (
            <Alert severity={(removeRes as { success?: unknown }).success ? 'success' : 'info'} sx={{ mt: 1 }}>
              {String((removeRes as { message?: unknown }).message ?? 'Remove completed.')}
            </Alert>
          ) : null}

          {listRes?.fragments?.length ? (
            <Table size="small" sx={{ mt: 1, mb: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>fragment_id</TableCell>
                  <TableCell>type</TableCell>
                  <TableCell>instance guid</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listRes.fragments.map((f, idx) => (
                  <>
                    <TableRow key={f.fragment_instance_guid} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{f.fragment_id ?? '—'}</TableCell>
                      <TableCell>{f.type ?? '—'}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {f.fragment_instance_guid.length > 12
                          ? `${f.fragment_instance_guid.slice(0, 12)}…`
                          : f.fragment_instance_guid}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View parameters">
                          <IconButton
                            size="small"
                            onClick={() =>
                              setExpandedGuid(
                                expandedGuid === f.fragment_instance_guid ? null : f.fragment_instance_guid,
                              )
                            }
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove fragment">
                          <IconButton
                            size="small"
                            color="error"
                            disabled={removeLoading}
                            onClick={() => runRemove(f.fragment_instance_guid)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    <TableRow key={`${f.fragment_instance_guid}-detail`}>
                      <TableCell colSpan={5} sx={{ p: 0, borderBottom: expandedGuid === f.fragment_instance_guid ? undefined : 'none' }}>
                        <Collapse in={expandedGuid === f.fragment_instance_guid} unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                            <Typography variant="caption" color="text.secondary" gutterBottom>
                              guid: {f.fragment_instance_guid}
                            </Typography>
                            <JsonBlock data={f.parameters ?? {}} copyLabel="Copy parameters" />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>
          ) : listRes && !listLoading ? (
            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
              No fragments in this session yet.
            </Alert>
          ) : null}

          <Divider sx={{ my: 2 }} />

          {/* Section B: Add fragment */}
          <Typography variant="subtitle2" gutterBottom>
            Add fragment
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              select
              label="Fragment type"
              value={selectedFragmentType}
              onChange={(e) => setSelectedFragmentType(e.target.value)}
              sx={{ minWidth: 260 }}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              helperText="Select fragment type"
            >
              <option value="" />
              {availableFragments.map((f) => (
                <option key={f.fragment_id} value={f.fragment_id}>
                  {f.name ? `${f.name} (${f.fragment_id})` : f.fragment_id}
                </option>
              ))}
              <option value="__image__">Image</option>
            </TextField>
            <TextField
              select
              label="position"
              value={selectedFragmentType === '__image__' ? imgPosition : addFragmentPosition}
              onChange={(e) => {
                if (selectedFragmentType === '__image__') {
                  setImgPosition(e.target.value);
                } else {
                  setAddFragmentPosition(e.target.value);
                }
              }}
              sx={{ width: 260 }}
              size="small"
              SelectProps={{ native: true }}
            >
              <option value="end">end</option>
              <option value="start">start</option>
              {(listRes?.fragments ?? []).map((f) => (
                <option key={`before:${f.fragment_instance_guid}`} value={`before:${f.fragment_instance_guid}`}>
                  before: {f.fragment_id ?? f.fragment_instance_guid}
                </option>
              ))}
              {(listRes?.fragments ?? []).map((f) => (
                <option key={`after:${f.fragment_instance_guid}`} value={`after:${f.fragment_instance_guid}`}>
                  after: {f.fragment_id ?? f.fragment_instance_guid}
                </option>
              ))}
            </TextField>
          </Box>

          {/* Regular fragment form */}
          {selectedFragmentType && selectedFragmentType !== '__image__' ? (
            <Box sx={{ mt: 2 }}>
              {fragmentDetailsLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2">Loading fragment schema…</Typography>
                </Box>
              ) : null}
              <ExamplesPopupIcon
                title="Examples (shape depends on the fragment)"
                examples={FRAGMENT_PARAMETERS_EXAMPLES}
              />
              <TextField
                label="parameters (JSON)"
                value={fragmentParamsJson}
                onChange={(e) => setFragmentParamsJson(e.target.value)}
                fullWidth
                multiline
                minRows={4}
                sx={{ mt: 1 }}
              />
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={runAddFragment}
                  disabled={addFragmentLoading}
                  startIcon={addFragmentLoading ? <CircularProgress size={16} /> : undefined}
                >
                  {addFragmentLoading ? 'Adding…' : 'Add Fragment'}
                </Button>
                <RequestPreview
                  tool="add_fragment"
                  args={{
                    session_id: sessionId,
                    fragment_id: selectedFragmentType,
                    position: addFragmentPosition,
                    parameters: '(JSON omitted here)',
                  }}
                />
              </Box>
              {addFragmentErr ? <ToolErrorAlert err={addFragmentErr} fallback="add_fragment failed" /> : null}
              {addFragmentRes?.fragment_instance_guid ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Added fragment_instance_guid: {addFragmentRes.fragment_instance_guid}
                </Alert>
              ) : null}
            </Box>
          ) : null}

          {/* Image fragment form */}
          {selectedFragmentType === '__image__' ? (
            <Box sx={{ mt: 2 }}>
              <RawResponsePopupIcon title="Raw add_image_fragment response" data={imgRes} />
              <TextField label="image_url" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} fullWidth sx={{ mt: 1 }} />
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <TextField
                  select
                  label="URL source"
                  value={stockUrlSource}
                  onChange={(e) => setStockUrlSource(e.target.value as 'internal' | 'proxy')}
                  size="small"
                  sx={{ minWidth: 220 }}
                  SelectProps={{ native: true }}
                  InputLabelProps={{ shrink: true }}
                >
                  <option value="internal">Internal (container)</option>
                  <option value="proxy">Console-proxied</option>
                </TextField>
                <Button
                  variant="outlined"
                  onClick={loadStockImages}
                  disabled={stockImagesLoading}
                  startIcon={stockImagesLoading ? <CircularProgress size={16} /> : undefined}
                >
                  {stockImagesLoading ? 'Loading…' : 'Browse stock images'}
                </Button>
                <Tooltip
                  placement="right"
                  title={
                    <Box sx={{ maxWidth: 560 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Stock images endpoint
                      </Typography>
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          p: 1,
                          fontSize: 12,
                          bgcolor: 'background.paper',
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'divider',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        GET /api/gofr-doc/images
                        {'\n'}
                        {new URL('/api/gofr-doc/images', window.location.origin).toString()}
                      </Box>
                    </Box>
                  }
                >
                  <IconButton size="small" aria-label="Stock images URL">
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              {stockImagesErr ? <ToolErrorAlert err={stockImagesErr} fallback="stock images list failed" /> : null}

              {stockImages.length ? (
                <Box sx={{ mt: 2 }}>
                  <Table size="small" sx={{ mb: 1 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>path</TableCell>
                        <TableCell>url</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stockImages.map((p) => {
                        const url = computeStockImageUrl(p);
                        const selected = imgUrl.trim() === url;
                        return (
                          <TableRow
                            key={p}
                            hover
                            selected={selected}
                            role="button"
                            tabIndex={0}
                            sx={{ cursor: 'pointer' }}
                            onClick={() => {
                              setImgUrl(url);
                              setImgErr(null);
                              if (stockUrlSource === 'internal') setImgRequireHttps(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setImgUrl(url);
                                setImgErr(null);
                                if (stockUrlSource === 'internal') setImgRequireHttps(false);
                              }
                            }}
                          >
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{p}</TableCell>
                            <TableCell sx={{ fontFamily: 'monospace' }}>{url}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Typography variant="caption" color="text.secondary">
                    Click a row to set image_url. Internal URLs auto-set require_https=false.
                  </Typography>
                </Box>
              ) : null}
              <TextField label="title" value={imgTitle} onChange={(e) => setImgTitle(e.target.value)} fullWidth sx={{ mt: 2 }} />
              <TextField label="alt_text" value={imgAlt} onChange={(e) => setImgAlt(e.target.value)} fullWidth sx={{ mt: 2 }} />
              <TextField
                select
                label="alignment"
                value={imgAlignment}
                onChange={(e) => setImgAlignment(e.target.value)}
                fullWidth
                sx={{ mt: 2 }}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                helperText="Optional: left, center, or right"
              >
                <option value="" />
                <option value="left">left</option>
                <option value="center">center</option>
                <option value="right">right</option>
              </TextField>
              <TextField
                select
                label="require_https"
                value={imgRequireHttps ? 'true' : 'false'}
                onChange={(e) => setImgRequireHttps(e.target.value === 'true')}
                sx={{ mt: 2, minWidth: 240 }}
                SelectProps={{ native: true }}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </TextField>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Size: specify width OR height (or neither)
              </Typography>
              <TextField label="width" value={imgWidth} onChange={(e) => setImgWidth(e.target.value)} sx={{ mt: 2, mr: 2, width: 180 }} />
              <TextField label="height" value={imgHeight} onChange={(e) => setImgHeight(e.target.value)} sx={{ mt: 2, width: 180 }} />
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  variant="contained"
                  onClick={runAddImage}
                  disabled={imgLoading}
                  startIcon={imgLoading ? <CircularProgress size={16} /> : undefined}
                >
                  {imgLoading ? 'Adding…' : 'Add Image'}
                </Button>
                <RequestPreview
                  tool="add_image_fragment"
                  args={{
                    session_id: sessionId,
                    image_url: imgUrl,
                    title: imgTitle,
                    alt_text: imgAlt,
                    alignment: imgAlignment,
                    require_https: imgRequireHttps,
                    width: imgWidth || undefined,
                    height: imgHeight || undefined,
                    position: imgPosition,
                  }}
                />
              </Box>
              {imgErr ? <ToolErrorAlert err={imgErr} fallback="add_image_fragment failed" /> : null}
              {imgRes?.fragment_instance_guid ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Added image fragment_instance_guid: {imgRes.fragment_instance_guid}
                </Alert>
              ) : null}
            </Box>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
