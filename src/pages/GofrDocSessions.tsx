import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  ClickAwayListener,
  CircularProgress,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import { api } from '../services/api';
import { logger } from '../services/logging';
import { useConfig } from '../hooks/useConfig';
import { useGofrDocUi } from '../hooks/useGofrDocUi';
import { useNavigate } from 'react-router-dom';
import type { JwtToken } from '../stores/configStore';
import type {
  DocCreateSessionResponse,
  DocListActiveSessionsResponse,
  DocListTemplatesResponse,
  DocSessionStatusResponse,
} from '../types/gofrDoc';
import RequestPreview from '../components/common/RequestPreview';
import JsonBlock from '../components/common/JsonBlock';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import TokenSelect from '../components/common/TokenSelect';
import GofrDocContextStrip from '../components/common/GofrDocContextStrip';

const ALIAS_RE = /^[A-Za-z0-9_-]{3,64}$/;

function HelpPopup({
  title,
  text,
  loading,
  err,
}: {
  title: string;
  text: string;
  loading: boolean;
  err: unknown;
}) {
  const [pinned, setPinned] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);

  const open = pinned || hoverOpen;
  const errText = err instanceof Error ? err.message : err ? String(err) : '';
  const bodyText = loading
    ? 'Loading authoring guide…'
    : errText
      ? `Authoring guide not available.\n\n${errText}`
      : text || 'Authoring guide not available.';

  return (
    <ClickAwayListener
      onClickAway={() => {
        if (pinned) setPinned(false);
      }}
    >
      <Box sx={{ display: 'inline-flex' }}>
        <Tooltip
          open={open}
          onOpen={() => {
            if (!pinned) setHoverOpen(true);
          }}
          onClose={() => {
            if (!pinned) setHoverOpen(false);
          }}
          disableHoverListener={pinned}
          disableFocusListener={pinned}
          disableTouchListener={pinned}
          enterDelay={120}
          leaveDelay={240}
          placement="right"
          title={
            <Box sx={{ maxWidth: 720 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {title}
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  fontSize: 12,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  maxHeight: 380,
                  overflow: 'auto',
                  whiteSpace: 'pre',
                  wordBreak: 'keep-all',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {bodyText}
              </Box>
            </Box>
          }
        >
          <IconButton
            size="small"
            aria-label={title}
            onClick={() => {
              setPinned((v) => !v);
              setHoverOpen(false);
            }}
          >
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}

export default function GofrDocSessions() {
  const { tokens } = useConfig();
  const { state: uiState, setState: setUiState } = useGofrDocUi();
  const navigate = useNavigate();

  const selectedToken: JwtToken | null = useMemo(() => {
    const idx = uiState.selectedTokenIndex;
    return idx >= 0 && idx < tokens.length ? tokens.at(idx) ?? null : null;
  }, [tokens, uiState.selectedTokenIndex]);

  const requireToken = (): string => {
    if (!selectedToken?.token) {
      throw new Error('Auth required: select a token');
    }
    return selectedToken.token;
  };

  const [templateId, setTemplateId] = useState(uiState.templateId || '');
  const [alias, setAlias] = useState('');

  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesErr, setTemplatesErr] = useState<unknown>(null);
  const [templatesRes, setTemplatesRes] = useState<DocListTemplatesResponse | null>(null);

  const [helpLoading, setHelpLoading] = useState(false);
  const [helpErr, setHelpErr] = useState<unknown>(null);
  const [authoringGuide, setAuthoringGuide] = useState<string>('');

  const [createLoading, setCreateLoading] = useState(false);
  const [createErr, setCreateErr] = useState<unknown>(null);
  const [createRes, setCreateRes] = useState<DocCreateSessionResponse | null>(null);

  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState<unknown>(null);
  const [listRes, setListRes] = useState<DocListActiveSessionsResponse | null>(null);

  const [statusSessionId, setStatusSessionId] = useState(uiState.sessionId || '');
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusErr, setStatusErr] = useState<unknown>(null);
  const [statusRes, setStatusRes] = useState<DocSessionStatusResponse | null>(null);

  const [abortSessionId, setAbortSessionId] = useState(uiState.sessionId || '');
  const [abortConfirm, setAbortConfirm] = useState('');
  const [abortLoading, setAbortLoading] = useState(false);
  const [abortErr, setAbortErr] = useState<unknown>(null);
  const [abortRes, setAbortRes] = useState<unknown>(null);

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-DOC Sessions page viewed',
      component: 'GofrDocSessions',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

  useEffect(() => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    let cancelled = false;

    setHelpLoading(true);
    setHelpErr(null);
    setAuthoringGuide('');

    api
      .docHelpText()
      .then((text) => {
        if (cancelled) return;

        type HelpShape = {
          data?: {
            authoring_guide?: unknown;
          };
          authoring_guide?: unknown;
        };

        const normaliseGuide = (value: unknown): string | null => {
          if (typeof value === 'string') return value;
          if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
            return (value as string[]).join('\n\n');
          }
          return null;
        };

        let guide: string | null = null;
        try {
          const parsed = JSON.parse(text) as HelpShape;
          guide =
            normaliseGuide(parsed?.data?.authoring_guide) ??
            normaliseGuide(parsed?.authoring_guide);
        } catch {
          // Some servers may return plain text; if it's obviously the guide, show it.
          if (/HOW TO CREATE TEMPLATES/i.test(text) || /AUTHORING[_ -]?GUIDE/i.test(text)) {
            guide = text;
          }
        }

        if (!guide) {
          throw new Error('Help payload did not include data.authoring_guide');
        }

        setAuthoringGuide(guide);
        logger.info({
          event: 'ui_form_submitted',
          message: 'help succeeded (authoring_guide extracted)',
          request_id: requestId,
          component: 'GofrDocSessions',
          operation: 'help',
          result: 'success',
          duration_ms: Math.round(performance.now() - startedAt),
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setHelpErr(e);
        logger.error({
          event: 'ui_form_submitted',
          message: 'help failed (authoring_guide)',
          request_id: requestId,
          component: 'GofrDocSessions',
          operation: 'help',
          result: 'failure',
          duration_ms: Math.round(performance.now() - startedAt),
          data: { cause: e instanceof Error ? e.message : 'unknown' },
        });
      })
      .finally(() => {
        if (cancelled) return;
        setHelpLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    let cancelled = false;

    setTemplatesLoading(true);
    setTemplatesErr(null);
    setTemplatesRes(null);

    api
      .docListTemplates()
      .then((res) => {
        if (cancelled) return;
        setTemplatesRes(res);
        logger.info({
          event: 'ui_form_submitted',
          message: 'list_templates succeeded (prefetch)',
          request_id: requestId,
          component: 'GofrDocSessions',
          operation: 'list_templates',
          result: 'success',
          duration_ms: Math.round(performance.now() - startedAt),
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setTemplatesErr(e);
        logger.error({
          event: 'ui_form_submitted',
          message: 'list_templates failed (prefetch)',
          request_id: requestId,
          component: 'GofrDocSessions',
          operation: 'list_templates',
          result: 'failure',
          duration_ms: Math.round(performance.now() - startedAt),
          data: { cause: e instanceof Error ? e.message : 'unknown' },
        });
      })
      .finally(() => {
        if (cancelled) return;
        setTemplatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (uiState.templateId && uiState.templateId !== templateId) setTemplateId(uiState.templateId);
    if (uiState.sessionId && uiState.sessionId !== statusSessionId) setStatusSessionId(uiState.sessionId);
    if (uiState.sessionId && uiState.sessionId !== abortSessionId) setAbortSessionId(uiState.sessionId);
  }, [abortSessionId, statusSessionId, templateId, uiState.sessionId, uiState.templateId]);

  const createSession = async () => {
    const token = requireToken();
    const tId = templateId.trim();
    const a = alias.trim();
    if (!tId) {
      setCreateErr(new Error('template_id is required'));
      return;
    }
    if (!ALIAS_RE.test(a)) {
      setCreateErr(new Error('Invalid alias. Use 3–64 chars: letters, numbers, hyphen, underscore.'));
      return;
    }

    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setCreateLoading(true);
    setCreateErr(null);
    setCreateRes(null);
    try {
      const res = await api.docCreateDocumentSession(token, tId, a);
      setCreateRes(res);
      setUiState({ sessionId: res.session_id, templateId: tId });
      setStatusSessionId(res.session_id);
      setAbortSessionId(res.session_id);
      logger.info({
        event: 'ui_form_submitted',
        message: 'create_document_session succeeded',
        request_id: requestId,
        component: 'GofrDocSessions',
        operation: 'create_document_session',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setCreateErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'create_document_session failed',
        request_id: requestId,
        component: 'GofrDocSessions',
        operation: 'create_document_session',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const listSessions = async () => {
    const token = requireToken();
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setListLoading(true);
    setListErr(null);
    setListRes(null);
    try {
      const res = await api.docListActiveSessions(token);
      setListRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'list_active_sessions succeeded',
        request_id: requestId,
        component: 'GofrDocSessions',
        operation: 'list_active_sessions',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setListErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_active_sessions failed',
        request_id: requestId,
        component: 'GofrDocSessions',
        operation: 'list_active_sessions',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setListLoading(false);
    }
  };

  const getStatus = async () => {
    const token = requireToken();
    const sId = statusSessionId.trim();
    if (!sId) {
      setStatusErr(new Error('session_id is required'));
      return;
    }
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setStatusLoading(true);
    setStatusErr(null);
    setStatusRes(null);
    try {
      const res = await api.docGetSessionStatus(token, sId);
      setStatusRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'get_session_status succeeded',
        request_id: requestId,
        component: 'GofrDocSessions',
        operation: 'get_session_status',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setStatusErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'get_session_status failed',
        request_id: requestId,
        component: 'GofrDocSessions',
        operation: 'get_session_status',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const abortSession = async () => {
    const token = requireToken();
    const sId = abortSessionId.trim();
    if (!sId) {
      setAbortErr(new Error('session_id is required'));
      return;
    }
    if (abortConfirm.trim() !== sId) {
      setAbortErr(new Error('Confirmation does not match session_id'));
      return;
    }
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setAbortLoading(true);
    setAbortErr(null);
    setAbortRes(null);
    try {
      const res = await api.docAbortDocumentSession(token, sId);
      setAbortRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'abort_document_session succeeded',
        request_id: requestId,
        component: 'GofrDocSessions',
        operation: 'abort_document_session',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setAbortErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'abort_document_session failed',
        request_id: requestId,
        component: 'GofrDocSessions',
        operation: 'abort_document_session',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setAbortLoading(false);
    }
  };

  const tokenMissing = uiState.selectedTokenIndex < 0;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GOFR-DOC Sessions
      </Typography>

      <GofrDocContextStrip />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick start
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Typical flow: Discovery → Sessions → Builder → Render.
          </Typography>
          <Box component="ol" sx={{ mt: 0, mb: 2, pl: 2 }}>
            <li>
              <Typography variant="body2">Pick a template (and optional style) in Discovery</Typography>
            </li>
            <li>
              <Typography variant="body2">Create a session (save the session_id)</Typography>
            </li>
            <li>
              <Typography variant="body2">Set global parameters (title, author, etc.)</Typography>
            </li>
            <li>
              <Typography variant="body2">Add fragments (build your document)</Typography>
            </li>
            <li>
              <Typography variant="body2">Render to HTML/PDF/Markdown</Typography>
            </li>
          </Box>
          <Button
            variant="contained"
            onClick={() => navigate('/gofr-doc/discovery')}
          >
            Start in Discovery
          </Button>
        </CardContent>
      </Card>

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
          />
          {tokenMissing && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Auth required: select a token to use sessions and builder tools.
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1 }}>
        <CardContent>
          <Typography variant="h6">Create session</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Alias rules: 3–64 chars; letters, numbers, hyphen, underscore.
          </Typography>

          {templatesRes?.templates?.length ? (
            <TextField
              select
              label="template_id"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={tokenMissing}
              fullWidth
              sx={{ mb: 2 }}
              SelectProps={{ native: true }}
              helperText={templatesLoading ? 'Loading templates…' : 'Select a template'}
            >
              <option value="">Select template</option>
              {templatesRes.templates.map((t) => (
                <option key={t.template_id} value={t.template_id}>
                  {t.template_id}{t.name ? ` — ${t.name}` : ''}
                </option>
              ))}
            </TextField>
          ) : (
            <TextField
              label="template_id"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              disabled={tokenMissing}
              fullWidth
              sx={{ mb: 2 }}
              helperText={
                templatesLoading
                  ? 'Loading templates…'
                  : templatesErr
                    ? 'Templates list unavailable; enter template_id manually.'
                    : 'Enter template_id'
              }
            />
          )}

          {templatesErr ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Template list failed to load. You can still create a session by entering template_id manually.
            </Alert>
          ) : null}

          <TextField
            label="alias"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            disabled={tokenMissing}
            fullWidth
          />

          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="subtitle2">Authoring guide</Typography>
            <HelpPopup
              title="Authoring guide"
              text={authoringGuide}
              loading={helpLoading}
              err={helpErr}
            />
          </Box>

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={createSession}
              disabled={createLoading || tokenMissing}
              startIcon={createLoading ? <CircularProgress size={16} /> : undefined}
            >
              {createLoading ? 'Creating…' : 'Create Document Session'}
            </Button>
            <RequestPreview tool="create_document_session" args={{ template_id: templateId, alias }} />
          </Box>
          {createErr ? <ToolErrorAlert err={createErr} fallback="create_document_session failed" /> : null}
          <JsonBlock data={createRes} copyLabel="Copy create response" />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Typography variant="h6">Active sessions</Typography>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={listSessions}
              disabled={listLoading}
              startIcon={listLoading ? <CircularProgress size={16} /> : undefined}
            >
              {listLoading ? 'Loading…' : 'List Active Sessions'}
            </Button>
            <RequestPreview tool="list_active_sessions" args={{}} />
          </Box>
          {listErr ? <ToolErrorAlert err={listErr} fallback="list_active_sessions failed" /> : null}
          {listRes?.sessions?.length ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Sessions
              </Typography>
              {listRes.sessions.map((s) => (
                <Box key={s.session_id} display="flex" alignItems="center" justifyContent="space-between" sx={{ py: 0.5 }}>
                  <Typography variant="body2" sx={{ mr: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.alias || s.session_id} ({s.template_id || 'template?'})
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setUiState({ sessionId: s.session_id, templateId: s.template_id ?? uiState.templateId });
                      setStatusSessionId(s.session_id);
                      setAbortSessionId(s.session_id);
                    }}
                  >
                    Use
                  </Button>
                </Box>
              ))}
            </Box>
          ) : null}
          <JsonBlock data={listRes} copyLabel="Copy sessions" />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Typography variant="h6">Session status</Typography>
          <TextField label="session_id" value={statusSessionId} onChange={(e) => setStatusSessionId(e.target.value)} fullWidth sx={{ mt: 2 }} />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={getStatus}
              disabled={statusLoading}
              startIcon={statusLoading ? <CircularProgress size={16} /> : undefined}
            >
              {statusLoading ? 'Loading…' : 'Get Session Status'}
            </Button>
            <RequestPreview tool="get_session_status" args={{ session_id: statusSessionId }} />
          </Box>
          {statusErr ? <ToolErrorAlert err={statusErr} fallback="get_session_status failed" /> : null}
          <JsonBlock data={statusRes} copyLabel="Copy status" />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, opacity: tokenMissing ? 0.5 : 1, pointerEvents: tokenMissing ? 'none' : 'auto' }}>
        <CardContent>
          <Typography variant="h6">Abort session (destructive)</Typography>
          <TextField label="session_id" value={abortSessionId} onChange={(e) => setAbortSessionId(e.target.value)} fullWidth sx={{ mt: 2 }} />
          <Divider sx={{ my: 2 }} />
          <TextField
            label="Type the session_id to confirm"
            value={abortConfirm}
            onChange={(e) => setAbortConfirm(e.target.value)}
            fullWidth
          />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              color="error"
              variant="contained"
              onClick={abortSession}
              disabled={abortLoading || !abortSessionId.trim() || abortConfirm.trim() !== abortSessionId.trim()}
              startIcon={abortLoading ? <CircularProgress size={16} /> : undefined}
            >
              {abortLoading ? 'Aborting…' : 'Abort Document Session'}
            </Button>
            <RequestPreview tool="abort_document_session" args={{ session_id: abortSessionId }} />
          </Box>
          {abortErr ? <ToolErrorAlert err={abortErr} fallback="abort_document_session failed" /> : null}
          <JsonBlock data={abortRes} copyLabel="Copy abort response" />
        </CardContent>
      </Card>
    </Box>
  );
}
