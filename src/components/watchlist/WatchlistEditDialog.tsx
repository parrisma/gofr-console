import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import { api } from '../../services/api';

interface WatchlistItem {
  ticker: string;
  instrument_name?: string;
  name?: string;
  alert_threshold?: number;
}

interface WatchlistEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: WatchlistItem | null;
  clientGuid: string;
  authToken: string;
  mode: 'add' | 'edit';
  defaultImpactThreshold?: number;
}

export default function WatchlistEditDialog({
  open,
  onClose,
  onSuccess,
  item,
  clientGuid,
  authToken,
  mode,
  defaultImpactThreshold = 50,
}: WatchlistEditDialogProps) {
  const [ticker, setTicker] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && item) {
        setTicker(item.ticker);
        setAlertThreshold(item.alert_threshold ? String(item.alert_threshold) : String(defaultImpactThreshold));
      } else {
        setTicker('');
        setAlertThreshold(String(defaultImpactThreshold));
      }
      setError(null);
      setValidationErrors({});
    }
  }, [open, mode, item, defaultImpactThreshold]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!ticker.trim()) {
      errors.ticker = 'Ticker is required';
    } else if (!/^[A-Z0-9.]+$/.test(ticker.toUpperCase())) {
      errors.ticker = 'Invalid ticker format';
    }

    if (alertThreshold) {
      const thresholdNum = parseInt(alertThreshold);
      if (isNaN(thresholdNum) || thresholdNum < 0 || thresholdNum > 100) {
        errors.alertThreshold = 'Alert threshold must be between 0 and 100';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    setLoading(true);
    setError(null);

    const thresholdNum = alertThreshold ? parseInt(alertThreshold) : undefined;
    const tickerUpper = ticker.toUpperCase();

    try {
      if (mode === 'edit' && item) {
        // Update = Remove + Add with rollback on failure
        const originalTicker = item.ticker;
        const originalThreshold = item.alert_threshold;

        try {
          // Step 1: Remove existing item
          await api.removeFromWatchlist(authToken, clientGuid, originalTicker);

          try {
            // Step 2: Add with new values
            await api.addToWatchlist(authToken, clientGuid, tickerUpper, thresholdNum);
            onSuccess();
            onClose();
          } catch (addError) {
            // Rollback: restore original item
            setError('Failed to update watchlist item. Attempting to restore original...');
            try {
              await api.addToWatchlist(authToken, clientGuid, originalTicker, originalThreshold);
              setError('Update failed but original item was restored');
            } catch (rollbackError) {
              setError('CRITICAL: Update failed and rollback failed. Original item may be lost. Please check manually.');
            }
          }
        } catch (removeError) {
          throw new Error(`Failed to remove original item: ${removeError instanceof Error ? removeError.message : 'Unknown error'}`);
        }
      } else {
        // Add new item
        await api.addToWatchlist(authToken, clientGuid, tickerUpper, thresholdNum);
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save watchlist item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'edit' ? 'Edit' : 'Add'} Watchlist Item</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            disabled={mode === 'edit' || loading}
            error={!!validationErrors.ticker}
            helperText={validationErrors.ticker || 'Stock ticker symbol (e.g., TSLA)'}
            required
            inputProps={{ style: { textTransform: 'uppercase' } }}
          />

          <TextField
            label="Alert Threshold"
            type="number"
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(e.target.value)}
            disabled={loading}
            error={!!validationErrors.alertThreshold}
            helperText={validationErrors.alertThreshold || `Impact score threshold (0-100). Defaults to client threshold: ${defaultImpactThreshold}`}
            inputProps={{ min: 0, max: 100, step: 1 }}
          />

          {mode === 'edit' && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption">
                Updates are performed by removing and re-adding the item. If the update fails, the original will be automatically restored.
              </Typography>
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
