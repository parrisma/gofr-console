import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import { api } from '../services/api';
import { logger } from '../services/logging';
import { useGofrPlotUi } from '../hooks/useGofrPlotUi';
import RequestPreview from '../components/common/RequestPreview';
import ToolErrorAlert from '../components/common/ToolErrorAlert';
import RawResponsePopupIcon from '../components/common/RawResponsePopupIcon';
import type { PlotListHandlersResponse, PlotListThemesResponse } from '../types/gofrDoc';

function mapToRows(map: Record<string, string> | undefined): Array<{ name: string; description: string }> {
  if (!map) return [];
  return Object.entries(map).map(([name, description]) => ({ name, description }));
}

export default function GofrPlotDiscovery() {
  const { state: uiState, setState: setUiState } = useGofrPlotUi();

  const [themesLoading, setThemesLoading] = useState(false);
  const [themesErr, setThemesErr] = useState<unknown>(null);
  const [themesRes, setThemesRes] = useState<PlotListThemesResponse | null>(null);

  const [handlersLoading, setHandlersLoading] = useState(false);
  const [handlersErr, setHandlersErr] = useState<unknown>(null);
  const [handlersRes, setHandlersRes] = useState<PlotListHandlersResponse | null>(null);

  const themeRows = useMemo(() => mapToRows(themesRes?.themes), [themesRes]);
  const handlerRows = useMemo(() => mapToRows(handlersRes?.handlers), [handlersRes]);

  useEffect(() => {
    logger.info({
      event: 'ui_page_view',
      message: 'GOFR-PLOT Discovery page viewed',
      component: 'GofrPlotDiscovery',
      operation: 'page_view',
      result: 'success',
    });
  }, []);

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
        component: 'GofrPlotDiscovery',
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
        component: 'GofrPlotDiscovery',
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
        component: 'GofrPlotDiscovery',
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
        component: 'GofrPlotDiscovery',
        operation: 'list_handlers',
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        data: { cause: e instanceof Error ? e.message : 'unknown' },
      });
    } finally {
      setHandlersLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        GOFR-PLOT Discovery
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Browse themes and chart types (handlers). Row click selects defaults for the Builder.
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h6">Themes</Typography>
              <Typography variant="body2" color="text.secondary">
                list_themes (no token)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="contained"
                onClick={loadThemes}
                disabled={themesLoading}
                startIcon={themesLoading ? <CircularProgress size={16} /> : undefined}
              >
                {themesLoading ? 'Loading…' : 'Browse Themes'}
              </Button>
              <RequestPreview tool="list_themes" args={{}} />
              <RawResponsePopupIcon title="list_themes raw" data={themesRes ?? themesErr ?? null} />
            </Box>
          </Box>

          {themesErr ? <ToolErrorAlert err={themesErr} fallback="list_themes failed" /> : null}

          {themeRows.length ? (
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell width={200}><strong>name</strong></TableCell>
                  <TableCell><strong>description</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {themeRows.map((row) => {
                  const selected = row.name === uiState.selectedTheme;
                  return (
                    <TableRow
                      key={row.name}
                      hover
                      selected={selected}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setUiState({ selectedTheme: row.name })}
                    >
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.description}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : themesRes && !themesLoading ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              No themes returned.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h6">Chart types</Typography>
              <Typography variant="body2" color="text.secondary">
                list_handlers (no token)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="contained"
                onClick={loadHandlers}
                disabled={handlersLoading}
                startIcon={handlersLoading ? <CircularProgress size={16} /> : undefined}
              >
                {handlersLoading ? 'Loading…' : 'Browse Chart Types'}
              </Button>
              <RequestPreview tool="list_handlers" args={{}} />
              <RawResponsePopupIcon title="list_handlers raw" data={handlersRes ?? handlersErr ?? null} />
            </Box>
          </Box>

          {handlersErr ? <ToolErrorAlert err={handlersErr} fallback="list_handlers failed" /> : null}

          {handlerRows.length ? (
            <Table size="small" sx={{ mt: 1 }}>
              <TableHead>
                <TableRow>
                  <TableCell width={200}><strong>name</strong></TableCell>
                  <TableCell><strong>description</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {handlerRows.map((row) => {
                  const selected = row.name === uiState.selectedHandler;
                  return (
                    <TableRow
                      key={row.name}
                      hover
                      selected={selected}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setUiState({ selectedHandler: row.name })}
                    >
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.description}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : handlersRes && !handlersLoading ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              No handlers returned.
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
