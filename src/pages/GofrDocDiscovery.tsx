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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { api } from '../services/api';
import { logger } from '../services/logging';
import { useConfig } from '../hooks/useConfig';
import { useGofrDocUi } from '../hooks/useGofrDocUi';
import type { JwtToken } from '../stores/configStore';
import RequestPreview from '../components/common/RequestPreview';
import JsonBlock from '../components/common/JsonBlock';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import TokenSelect from '../components/common/TokenSelect';
import GofrDocContextStrip from '../components/common/GofrDocContextStrip';
import type {
  DocFragmentDetailsResponse,
  DocListStylesResponse,
  DocListTemplateFragmentsResponse,
  DocListTemplatesResponse,
  DocTemplateDetailsResponse,
} from '../types/gofrDoc';

function toDisplayText(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

function RawResponsePreview({
  title,
  data,
}: {
  title: string;
  data: unknown;
}) {
  const [pinned, setPinned] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);

  const open = pinned || hoverOpen;
  const text = data == null ? '' : toDisplayText(data);

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
            <Box sx={{ maxWidth: 520 }}>
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
                  maxHeight: 280,
                  overflow: 'auto',
                  whiteSpace: 'pre',
                  wordBreak: 'keep-all',
                }}
              >
                {text || 'No response yet.'}
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
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </ClickAwayListener>
  );
}

export default function GofrDocDiscovery() {
  const { tokens } = useConfig();
  const { state: uiState, setState: setUiState } = useGofrDocUi();

  const selectedToken: JwtToken | null = useMemo(() => {
    const idx = uiState.selectedTokenIndex;
    return idx >= 0 && idx < tokens.length ? tokens.at(idx) ?? null : null;
  }, [tokens, uiState.selectedTokenIndex]);

  const [helpLoading, setHelpLoading] = useState(false);
  const [helpErr, setHelpErr] = useState<unknown>(null);
  const [helpText, setHelpText] = useState<string>('');

  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesErr, setTemplatesErr] = useState<unknown>(null);
  const [templates, setTemplates] = useState<DocListTemplatesResponse | null>(null);

  const [templateId, setTemplateId] = useState('');
  const [templateDetailsLoading, setTemplateDetailsLoading] = useState(false);
  const [templateDetailsErr, setTemplateDetailsErr] = useState<unknown>(null);
  const [templateDetails, setTemplateDetails] = useState<DocTemplateDetailsResponse | null>(null);

  const [fragmentsLoading, setFragmentsLoading] = useState(false);
  const [fragmentsErr, setFragmentsErr] = useState<unknown>(null);
  const [fragments, setFragments] = useState<DocListTemplateFragmentsResponse | null>(null);

  const [fragmentId, setFragmentId] = useState('');
  const [fragmentDetailsLoading, setFragmentDetailsLoading] = useState(false);
  const [fragmentDetailsErr, setFragmentDetailsErr] = useState<unknown>(null);
  const [fragmentDetails, setFragmentDetails] = useState<DocFragmentDetailsResponse | null>(null);

  const [stylesLoading, setStylesLoading] = useState(false);
  const [stylesErr, setStylesErr] = useState<unknown>(null);
  const [styles, setStyles] = useState<DocListStylesResponse | null>(null);

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-DOC Discovery page viewed',
      component: 'GofrDocDiscovery',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

  const loadHelp = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setHelpLoading(true);
    setHelpErr(null);
    setHelpText('');
    try {
      const text = await api.docHelpText();
      setHelpText(text);
      logger.info({
        event: 'ui_form_submitted',
        message: 'help succeeded',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'help',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setHelpErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'help failed',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'help',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setHelpLoading(false);
    }
  };

  const loadTemplates = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setTemplatesLoading(true);
    setTemplatesErr(null);
    setTemplates(null);
    try {
      const res = await api.docListTemplates();
      setTemplates(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'list_templates succeeded',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'list_templates',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setTemplatesErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_templates failed',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'list_templates',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadTemplateDetails = async () => {
    const id = templateId.trim();
    if (!id) {
      setTemplateDetailsErr(new Error('template_id is required'));
      return;
    }
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setTemplateDetailsLoading(true);
    setTemplateDetailsErr(null);
    setTemplateDetails(null);
    try {
      const res = await api.docGetTemplateDetails(id, selectedToken?.token);
      setTemplateDetails(res);
      setUiState({ templateId: id });
      logger.info({
        event: 'ui_form_submitted',
        message: 'get_template_details succeeded',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'get_template_details',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setTemplateDetailsErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'get_template_details failed',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'get_template_details',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setTemplateDetailsLoading(false);
    }
  };

  const loadFragments = async () => {
    const id = templateId.trim();
    if (!id) {
      setFragmentsErr(new Error('template_id is required'));
      return;
    }
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setFragmentsLoading(true);
    setFragmentsErr(null);
    setFragments(null);
    setFragmentId('');
    setFragmentDetails(null);
    try {
      const res = await api.docListTemplateFragments(id, selectedToken?.token);
      setFragments(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'list_template_fragments succeeded',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'list_template_fragments',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setFragmentsErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_template_fragments failed',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'list_template_fragments',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setFragmentsLoading(false);
    }
  };

  const loadFragmentDetails = async () => {
    const tId = templateId.trim();
    const fId = fragmentId.trim();
    if (!tId) {
      setFragmentDetailsErr(new Error('template_id is required'));
      return;
    }
    if (!fId) {
      setFragmentDetailsErr(new Error('fragment_id is required'));
      return;
    }
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setFragmentDetailsLoading(true);
    setFragmentDetailsErr(null);
    setFragmentDetails(null);
    try {
      const res = await api.docGetFragmentDetails(tId, fId, selectedToken?.token);
      setFragmentDetails(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'get_fragment_details succeeded',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'get_fragment_details',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setFragmentDetailsErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'get_fragment_details failed',
        request_id: requestId,
        component: 'GofrDocDiscovery',
        operation: 'get_fragment_details',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setFragmentDetailsLoading(false);
    }
  };

  const loadStyles = async () => {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    setStylesLoading(true);
    setStylesErr(null);
    setStyles(null);
    try {
      const res = await api.docListStyles();
      setStyles(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'list_styles succeeded',
        request_id: requestId,
        component: 'GofrDocDiscovery',
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
        component: 'GofrDocDiscovery',
        operation: 'list_styles',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setStylesLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
      <Typography variant="h4" gutterBottom>
        GOFR-DOC Discovery
      </Typography>
      <GofrDocContextStrip />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Browse templates, fragments, and styles. Token is optional for detail calls.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Optional token
          </Typography>
          <TokenSelect
            label="Token"
            tokens={tokens}
            value={uiState.selectedTokenIndex}
            onChange={(idx) => setUiState({ selectedTokenIndex: idx })}
            allowNone
          />
          {selectedToken ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              Using token: {selectedToken.name}
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Help</Typography>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={loadHelp}
              disabled={helpLoading}
              startIcon={helpLoading ? <CircularProgress size={16} /> : undefined}
            >
              {helpLoading ? 'Loading…' : 'Get Help'}
            </Button>
            <RequestPreview tool="help" args={{}} />
          </Box>
          {helpErr ? <ToolErrorAlert err={helpErr} fallback="help failed" /> : null}
          <JsonBlock data={helpText || null} copyLabel="Copy help" maxHeight={300} />
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      <Card>
        <CardContent>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6">Templates</Typography>
            <RawResponsePreview title="Raw list_templates response" data={templates} />
          </Box>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={loadTemplates}
              disabled={templatesLoading}
              startIcon={templatesLoading ? <CircularProgress size={16} /> : undefined}
            >
              {templatesLoading ? 'Loading…' : 'Browse templates'}
            </Button>
            <RequestPreview tool="list_templates" args={{}} />
          </Box>
          {templatesErr ? <ToolErrorAlert err={templatesErr} fallback="list_templates failed" /> : null}

          {templates?.templates?.length ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Templates
              </Typography>
              <Table size="small" sx={{ mb: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>template_id</TableCell>
                    <TableCell>name</TableCell>
                    <TableCell>description</TableCell>
                    <TableCell>group</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.templates.map((t) => (
                    <TableRow
                      key={t.template_id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        setTemplateId(t.template_id);
                        setUiState({ templateId: t.template_id });
                      }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.template_id}</TableCell>
                      <TableCell>{t.name ?? ''}</TableCell>
                      <TableCell>{t.description ?? ''}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.group ?? ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="caption" color="text.secondary">
                Click a row to set template_id.
              </Typography>
            </Box>
          ) : templates ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No templates returned.
            </Alert>
          ) : null}

          <Divider sx={{ my: 2 }} />

          <TextField
            label="template_id"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            fullWidth
          />
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={loadTemplateDetails}
              disabled={templateDetailsLoading}
              startIcon={templateDetailsLoading ? <CircularProgress size={16} /> : undefined}
            >
              {templateDetailsLoading ? 'Loading…' : 'View template details'}
            </Button>
            <RequestPreview tool="get_template_details" args={{ template_id: templateId }} />
          </Box>
          {templateDetailsErr ? <ToolErrorAlert err={templateDetailsErr} fallback="get_template_details failed" /> : null}
          <JsonBlock data={templateDetails} copyLabel="Copy template details" />
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      <Card>
        <CardContent>
          <Typography variant="h6">Fragments</Typography>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              onClick={loadFragments}
              disabled={fragmentsLoading}
              startIcon={fragmentsLoading ? <CircularProgress size={16} /> : undefined}
            >
              {fragmentsLoading ? 'Loading…' : 'Browse fragments'}
            </Button>
            <RequestPreview tool="list_template_fragments" args={{ template_id: templateId }} />
          </Box>
          {fragmentsErr ? <ToolErrorAlert err={fragmentsErr} fallback="list_template_fragments failed" /> : null}
          <JsonBlock data={fragments} copyLabel="Copy fragments" />

          <Divider sx={{ my: 2 }} />

          <TextField
            select
            label="fragment_id"
            value={fragmentId}
            onChange={(e) => setFragmentId(e.target.value)}
            fullWidth
            SelectProps={{ native: true }}
          >
            <option value="">Select fragment</option>
            {(fragments?.fragments ?? []).map((f) => (
              <option key={f.fragment_id} value={f.fragment_id}>
                {f.fragment_id}
              </option>
            ))}
          </TextField>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={loadFragmentDetails}
              disabled={fragmentDetailsLoading}
              startIcon={fragmentDetailsLoading ? <CircularProgress size={16} /> : undefined}
            >
              {fragmentDetailsLoading ? 'Loading…' : 'View fragment details'}
            </Button>
            <RequestPreview tool="get_fragment_details" args={{ template_id: templateId, fragment_id: fragmentId }} />
          </Box>
          {fragmentDetailsErr ? <ToolErrorAlert err={fragmentDetailsErr} fallback="get_fragment_details failed" /> : null}
          <JsonBlock data={fragmentDetails} copyLabel="Copy fragment details" />
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      <Card>
        <CardContent>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="h6">Styles</Typography>
            <RawResponsePreview title="Raw list_styles response" data={styles} />
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

          {styles?.styles?.length ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Styles
              </Typography>
              <Table size="small" sx={{ mb: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>style_id</TableCell>
                    <TableCell>name</TableCell>
                    <TableCell>description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {styles.styles.map((s) => (
                    <TableRow
                      key={s.style_id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        setUiState({ styleId: s.style_id });
                      }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{s.style_id}</TableCell>
                      <TableCell>{s.name ?? ''}</TableCell>
                      <TableCell>{s.description ?? ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="caption" color="text.secondary">
                Click a row to set style_id (used on Render).
              </Typography>
            </Box>
          ) : styles ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No styles returned.
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
