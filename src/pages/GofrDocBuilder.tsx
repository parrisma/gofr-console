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
import TokenSelect from '../components/common/TokenSelect';
import type {
  DocAddFragmentResponse,
  DocAddImageFragmentResponse,
  DocListSessionFragmentsResponse,
  DocParameterType,
  DocRemoveFragmentResponse,
  DocSetGlobalParametersResponse,
  DocValidateParametersResponse,
} from '../types/gofrDoc';

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

export default function GofrDocBuilder() {
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

  // 1) Validate parameters
  const [validateType, setValidateType] = useState<DocParameterType>('global');
  const [validateFragmentId, setValidateFragmentId] = useState('');
  const [validateJson, setValidateJson] = useState('{}');
  const [validateLoading, setValidateLoading] = useState(false);
  const [validateErr, setValidateErr] = useState<unknown>(null);
  const [validateRes, setValidateRes] = useState<DocValidateParametersResponse | null>(null);

  const runValidate = async () => {
    const token = requireToken();
    const tId = templateId.trim();
    if (!tId) {
      setValidateErr(new Error('template_id is required'));
      return;
    }
    if (validateType === 'fragment' && !validateFragmentId.trim()) {
      setValidateErr(new Error('fragment_id is required when parameter_type=fragment'));
      return;
    }
    const parsed = safeJsonParse(validateJson);
    if (!parsed.ok) {
      setValidateErr(new Error(`Invalid JSON: ${parsed.error}`));
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setValidateLoading(true);
    setValidateErr(null);
    setValidateRes(null);
    try {
      const res = await api.docValidateParameters({
        templateId: tId,
        parameterType: validateType,
        parameters: parsed.value,
        fragmentId: validateType === 'fragment' ? validateFragmentId.trim() : undefined,
        authToken: token,
      });
      setValidateRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'validate_parameters succeeded',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'validate_parameters',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setValidateErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'validate_parameters failed',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'validate_parameters',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setValidateLoading(false);
    }
  };

  // 2) Set global parameters
  const [globalsJson, setGlobalsJson] = useState('{}');
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
    const parsed = safeJsonParse(globalsJson);
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

  // 3) Add fragment
  const [addFragmentId, setAddFragmentId] = useState('');
  const [addFragmentPosition, setAddFragmentPosition] = useState('end');
  const [addFragmentJson, setAddFragmentJson] = useState('{}');
  const [addFragmentLoading, setAddFragmentLoading] = useState(false);
  const [addFragmentErr, setAddFragmentErr] = useState<unknown>(null);
  const [addFragmentRes, setAddFragmentRes] = useState<DocAddFragmentResponse | null>(null);

  const runAddFragment = async () => {
    const token = requireToken();
    const sId = sessionId.trim();
    if (!sId) {
      setAddFragmentErr(new Error('session_id is required'));
      return;
    }
    const fId = addFragmentId.trim();
    if (!fId) {
      setAddFragmentErr(new Error('fragment_id is required'));
      return;
    }
    if (!isValidPosition(addFragmentPosition)) {
      setAddFragmentErr(new Error('Invalid position. Use start/end/before:<guid>/after:<guid>.'));
      return;
    }
    const parsed = safeJsonParse(addFragmentJson);
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

  // 4) Add image fragment
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

  // 5) List fragments + remove
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState<unknown>(null);
  const [listRes, setListRes] = useState<DocListSessionFragmentsResponse | null>(null);

  const [removeGuid, setRemoveGuid] = useState('');
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeErr, setRemoveErr] = useState<unknown>(null);
  const [removeRes, setRemoveRes] = useState<DocRemoveFragmentResponse | null>(null);

  const runList = async () => {
    const token = requireToken();
    const sId = sessionId.trim();
    if (!sId) {
      setListErr(new Error('session_id is required'));
      return;
    }
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setListLoading(true);
    setListErr(null);
    setListRes(null);
    try {
      const res = await api.docListSessionFragments(token, sId);
      setListRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'list_session_fragments succeeded',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'list_session_fragments',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setListErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_session_fragments failed',
        request_id: requestId,
        component: 'GofrDocBuilder',
        operation: 'list_session_fragments',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setListLoading(false);
    }
  };

  const runRemove = async () => {
    const token = requireToken();
    const sId = sessionId.trim();
    if (!sId) {
      setRemoveErr(new Error('session_id is required'));
      return;
    }
    const guid = removeGuid.trim();
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
      // Refresh list after removal.
      try {
        const refreshed = await api.docListSessionFragments(token, sId);
        setListRes(refreshed);
      } catch {
        // ignore refresh failures
      }
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
          <Typography variant="h6">Validate parameters</Typography>
          <TextField
            select
            label="parameter_type"
            value={validateType}
            onChange={(e) => setValidateType(e.target.value as DocParameterType)}
            sx={{ mt: 2, minWidth: 240 }}
            SelectProps={{ native: true }}
          >
            <option value="global">global</option>
            <option value="fragment">fragment</option>
          </TextField>
          {validateType === 'fragment' ? (
            <TextField
              label="fragment_id"
              value={validateFragmentId}
              onChange={(e) => setValidateFragmentId(e.target.value)}
              fullWidth
              sx={{ mt: 2 }}
            />
          ) : null}
          <TextField
            label="parameters (JSON)"
            value={validateJson}
            onChange={(e) => setValidateJson(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={runValidate}
              disabled={validateLoading}
              startIcon={validateLoading ? <CircularProgress size={16} /> : undefined}
            >
              {validateLoading ? 'Validating…' : 'Validate'}
            </Button>
            <RequestPreview
              tool="validate_parameters"
              args={{
                template_id: templateId,
                parameter_type: validateType,
                fragment_id: validateType === 'fragment' ? validateFragmentId : undefined,
                parameters: '(JSON omitted here)',
              }}
            />
          </Box>
          {validateErr ? <ToolErrorAlert err={validateErr} fallback="validate_parameters failed" /> : null}
          <JsonBlock data={validateRes} copyLabel="Copy validate response" />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Typography variant="h6">Global parameters</Typography>
          <TextField
            label="parameters (JSON)"
            value={globalsJson}
            onChange={(e) => setGlobalsJson(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={runSetGlobals}
              disabled={globalsLoading}
              startIcon={globalsLoading ? <CircularProgress size={16} /> : undefined}
            >
              {globalsLoading ? 'Saving…' : 'Set Global Parameters'}
            </Button>
            <RequestPreview
              tool="set_global_parameters"
              args={{ session_id: sessionId, parameters: '(JSON omitted here)' }}
            />
          </Box>
          {globalsErr ? <ToolErrorAlert err={globalsErr} fallback="set_global_parameters failed" /> : null}
          <JsonBlock data={globalsRes} copyLabel="Copy globals response" />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Typography variant="h6">Add fragment</Typography>
          <TextField label="fragment_id" value={addFragmentId} onChange={(e) => setAddFragmentId(e.target.value)} fullWidth sx={{ mt: 2 }} />
          <TextField label="position" value={addFragmentPosition} onChange={(e) => setAddFragmentPosition(e.target.value)} fullWidth sx={{ mt: 2 }} />
          {!isValidPosition(addFragmentPosition) ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Position must be start/end/before:&lt;guid&gt;/after:&lt;guid&gt;
            </Alert>
          ) : null}
          <TextField
            label="parameters (JSON)"
            value={addFragmentJson}
            onChange={(e) => setAddFragmentJson(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            sx={{ mt: 2 }}
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
                fragment_id: addFragmentId,
                position: addFragmentPosition,
                parameters: '(JSON omitted here)',
              }}
            />
          </Box>
          {addFragmentErr ? <ToolErrorAlert err={addFragmentErr} fallback="add_fragment failed" /> : null}
          <JsonBlock data={addFragmentRes} copyLabel="Copy add fragment response" />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Typography variant="h6">Add image fragment</Typography>
          <TextField label="image_url" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} fullWidth sx={{ mt: 2 }} />
          <TextField label="title" value={imgTitle} onChange={(e) => setImgTitle(e.target.value)} fullWidth sx={{ mt: 2 }} />
          <TextField label="alt_text" value={imgAlt} onChange={(e) => setImgAlt(e.target.value)} fullWidth sx={{ mt: 2 }} />
          <TextField label="alignment" value={imgAlignment} onChange={(e) => setImgAlignment(e.target.value)} fullWidth sx={{ mt: 2 }} />
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
          <TextField label="position" value={imgPosition} onChange={(e) => setImgPosition(e.target.value)} fullWidth sx={{ mt: 2 }} />
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
          <JsonBlock data={imgRes} copyLabel="Copy add image response" />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Typography variant="h6">Fragments (review & remove)</Typography>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={runList}
              disabled={listLoading}
              startIcon={listLoading ? <CircularProgress size={16} /> : undefined}
            >
              {listLoading ? 'Loading…' : 'List Session Fragments'}
            </Button>
            <RequestPreview tool="list_session_fragments" args={{ session_id: sessionId }} />
          </Box>
          {listErr ? <ToolErrorAlert err={listErr} fallback="list_session_fragments failed" /> : null}
          {listRes?.fragments?.length ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Returned fragments
              </Typography>
              {listRes.fragments.map((f) => (
                <Box key={f.fragment_instance_guid} display="flex" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ mr: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.fragment_instance_guid} {f.fragment_id ? `(${f.fragment_id})` : ''}
                  </Typography>
                  <Button size="small" variant="outlined" onClick={() => setRemoveGuid(f.fragment_instance_guid)}>
                    Remove
                  </Button>
                </Box>
              ))}
            </Box>
          ) : null}
          <JsonBlock data={listRes} copyLabel="Copy fragments" />

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2">Remove fragment</Typography>
          <TextField
            label="fragment_instance_guid"
            value={removeGuid}
            onChange={(e) => setRemoveGuid(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              color="error"
              variant="contained"
              onClick={runRemove}
              disabled={removeLoading || !removeGuid.trim()}
              startIcon={removeLoading ? <CircularProgress size={16} /> : undefined}
            >
              {removeLoading ? 'Removing…' : 'Remove Fragment'}
            </Button>
            <RequestPreview tool="remove_fragment" args={{ session_id: sessionId, fragment_instance_guid: removeGuid }} />
          </Box>
          {removeErr ? <ToolErrorAlert err={removeErr} fallback="remove_fragment failed" /> : null}
          <JsonBlock data={removeRes} copyLabel="Copy remove response" />
        </CardContent>
      </Card>
    </Box>
  );
}
