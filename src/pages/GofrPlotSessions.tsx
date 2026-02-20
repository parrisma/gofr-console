import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { api } from '../services/api';
import { logger } from '../services/logging';
import { useConfig } from '../hooks/useConfig';
import { useGofrPlotUi } from '../hooks/useGofrPlotUi';
import type { JwtToken } from '../stores/configStore';
import type { PlotGetImageResponse, PlotListImagesResponse } from '../types/gofrDoc';
import RequestPreview from '../components/common/RequestPreview';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import TokenSelect from '../components/common/TokenSelect';
import RawResponsePopupIcon from '../components/common/RawResponsePopupIcon';

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

export default function GofrPlotSessions() {
  const { tokens } = useConfig();
  const { state: uiState, setState: setUiState } = useGofrPlotUi();

  const selectedToken: JwtToken | null = useMemo(() => {
    const idx = uiState.selectedTokenIndex;
    return idx >= 0 && idx < tokens.length ? tokens.at(idx) ?? null : null;
  }, [tokens, uiState.selectedTokenIndex]);

  const requireToken = (): string => {
    if (!selectedToken?.token) throw new Error('Auth required: select a token');
    return selectedToken.token;
  };

  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState<unknown>(null);
  const [listRes, setListRes] = useState<PlotListImagesResponse | null>(null);

  const [identifier, setIdentifier] = useState(uiState.selectedPlotIdentifier || '');

  const [getLoading, setGetLoading] = useState(false);
  const [getErr, setGetErr] = useState<unknown>(null);
  const [getRes, setGetRes] = useState<PlotGetImageResponse | null>(null);

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-PLOT Sessions page viewed',
      component: 'GofrPlotSessions',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

  useEffect(() => {
    if (uiState.selectedPlotIdentifier && uiState.selectedPlotIdentifier !== identifier) {
      setIdentifier(uiState.selectedPlotIdentifier);
    }
  }, [uiState.selectedPlotIdentifier, identifier]);

  const loadImages = async () => {
    const token = requireToken();
    const requestId = logger.createRequestId();
    const startedAt = performance.now();

    setListLoading(true);
    setListErr(null);
    setListRes(null);

    try {
      const res = await api.docPlotListImages(token);
      setListRes(res);
      logger.info({
        event: 'ui_form_submitted',
        message: 'list_images succeeded',
        request_id: requestId,
        component: 'GofrPlotSessions',
        operation: 'list_images',
        result: 'success',
        duration_ms: Math.round(performance.now() - startedAt),
      });
    } catch (e) {
      setListErr(e);
      logger.error({
        event: 'ui_form_submitted',
        message: 'list_images failed',
        request_id: requestId,
        component: 'GofrPlotSessions',
        operation: 'list_images',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setListLoading(false);
    }
  };

  const runGetImage = async () => {
    const token = requireToken();
    const id = identifier.trim();
    if (!id) {
      setGetErr(new Error('identifier is required (GUID or alias)'));
      return;
    }

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
        component: 'GofrPlotSessions',
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
        component: 'GofrPlotSessions',
        operation: 'get_image',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setGetLoading(false);
    }
  };

  const canPreviewInline = getRes?.image?.mimeType === 'image/png' || getRes?.image?.mimeType === 'image/jpeg';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GOFR-PLOT Sessions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Browse stored plot images (proxy outputs) and fetch by GUID or alias.
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h6">Stored images</Typography>
              <Typography variant="body2" color="text.secondary">
                list_images (token required)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="contained"
                onClick={loadImages}
                disabled={listLoading || uiState.selectedTokenIndex < 0}
                startIcon={listLoading ? <CircularProgress size={16} /> : undefined}
              >
                {listLoading ? 'Loading…' : 'Refresh'}
              </Button>
              <RequestPreview tool="list_images" args={{ auth_token: '(token omitted)', token: '(token omitted)' }} />
              <RawResponsePopupIcon title="list_images raw" data={listRes ?? listErr ?? null} />
            </Box>
          </Box>

          {listErr ? <ToolErrorAlert err={listErr} fallback="list_images failed" /> : null}

          {(listRes?.images ?? []).length ? (
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell><strong>guid</strong></TableCell>
                  <TableCell width={90}><strong>format</strong></TableCell>
                  <TableCell width={160}><strong>alias</strong></TableCell>
                  <TableCell width={110}><strong>size</strong></TableCell>
                  <TableCell width={200}><strong>created_at</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(listRes?.images ?? []).map((img) => {
                  const selected = img.guid === uiState.selectedPlotIdentifier;
                  return (
                    <TableRow
                      key={img.guid}
                      hover
                      selected={selected}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        setUiState({ selectedPlotIdentifier: img.guid });
                        setIdentifier(img.guid);
                      }}
                    >
                      <TableCell>{img.guid}</TableCell>
                      <TableCell>{img.format ?? ''}</TableCell>
                      <TableCell>{img.alias ?? ''}</TableCell>
                      <TableCell>{typeof img.size === 'number' ? img.size : ''}</TableCell>
                      <TableCell>{img.created_at ?? ''}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : listRes && !listLoading ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              No images returned.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Get image
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="identifier (GUID or alias)"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              sx={{ minWidth: 520 }}
              size="small"
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="contained"
                onClick={runGetImage}
                disabled={getLoading || uiState.selectedTokenIndex < 0}
                startIcon={getLoading ? <CircularProgress size={16} /> : undefined}
              >
                {getLoading ? 'Fetching…' : 'Fetch'}
              </Button>
              <RequestPreview tool="get_image" args={{ identifier, auth_token: '(token omitted)', token: '(token omitted)' }} />
              <RawResponsePopupIcon title="get_image raw" data={getRes ?? getErr ?? null} />
            </Box>
          </Box>

          {getErr ? <ToolErrorAlert err={getErr} fallback="get_image failed" /> : null}

          {getRes ? (
            <>
              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Result
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                identifier: {getRes.meta.identifier ?? identifier} | format: {getRes.meta.format ?? ''} | size_bytes: {getRes.meta.size_bytes ?? ''}
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
        </CardContent>
      </Card>
    </Box>
  );
}
