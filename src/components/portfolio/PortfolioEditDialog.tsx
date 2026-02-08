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

interface Holding {
  ticker: string;
  name?: string;
  instrument_name?: string;
  weight: number;
  shares?: number | null;
  avg_cost?: number | null;
}

interface PortfolioEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  holding: Holding | null;
  clientGuid: string;
  authToken: string;
  mode: 'add' | 'edit';
}

export default function PortfolioEditDialog({
  open,
  onClose,
  onSuccess,
  holding,
  clientGuid,
  authToken,
  mode,
}: PortfolioEditDialogProps) {
  const [ticker, setTicker] = useState('');
  const [weight, setWeight] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && holding) {
        setTicker(holding.ticker);
        setWeight(String(holding.weight));
        setShares(holding.shares ? String(holding.shares) : '');
        setAvgCost(holding.avg_cost ? String(holding.avg_cost) : '');
      } else {
        setTicker('');
        setWeight('');
        setShares('');
        setAvgCost('');
      }
      setError(null);
      setValidationErrors({});
    }
  }, [open, mode, holding]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!ticker.trim()) {
      errors.ticker = 'Ticker is required';
    } else if (!/^[A-Z0-9.]+$/.test(ticker.toUpperCase())) {
      errors.ticker = 'Invalid ticker format';
    }

    const weightNum = parseFloat(weight);
    if (!weight.trim()) {
      errors.weight = 'Weight is required';
    } else if (isNaN(weightNum) || weightNum <= 0 || weightNum > 100) {
      errors.weight = 'Weight must be between 0 and 100';
    }

    if (shares && isNaN(parseInt(shares))) {
      errors.shares = 'Shares must be a number';
    }

    if (avgCost && isNaN(parseFloat(avgCost))) {
      errors.avgCost = 'Avg cost must be a number';
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

    const weightNum = parseFloat(weight);
    const sharesNum = shares ? parseInt(shares) : undefined;
    const avgCostNum = avgCost ? parseFloat(avgCost) : undefined;
    const tickerUpper = ticker.toUpperCase();

    try {
      if (mode === 'edit' && holding) {
        // Update = Remove + Add with rollback on failure
        const originalTicker = holding.ticker;
        const originalWeight = holding.weight;
        const originalShares = holding.shares ?? undefined;
        const originalAvgCost = holding.avg_cost ?? undefined;

        try {
          // Step 1: Remove existing holding
          await api.removeFromPortfolio(authToken, clientGuid, originalTicker);

          try {
            // Step 2: Add with new values
            await api.addToPortfolio(authToken, clientGuid, tickerUpper, weightNum, sharesNum, avgCostNum);
            onSuccess();
            onClose();
          } catch {
            // Rollback: restore original holding
            setError('Failed to update holding. Attempting to restore original...');
            try {
              await api.addToPortfolio(authToken, clientGuid, originalTicker, originalWeight, originalShares, originalAvgCost);
              setError('Update failed but original holding was restored');
            } catch {
              setError('CRITICAL: Update failed and rollback failed. Original holding may be lost. Please check manually.');
            }
          }
        } catch (removeError) {
          throw new Error(`Failed to remove original holding: ${removeError instanceof Error ? removeError.message : 'Unknown error'}`);
        }
      } else {
        // Add new holding
        await api.addToPortfolio(authToken, clientGuid, tickerUpper, weightNum, sharesNum, avgCostNum);
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save holding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'edit' ? 'Edit' : 'Add'} Portfolio Holding</DialogTitle>
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
            helperText={validationErrors.ticker || 'Stock ticker symbol (e.g., AAPL)'}
            required
            inputProps={{ style: { textTransform: 'uppercase' } }}
          />

          <TextField
            label="Weight %"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            disabled={loading}
            error={!!validationErrors.weight}
            helperText={validationErrors.weight || 'Portfolio weight percentage (0-100)'}
            required
            inputProps={{ min: 0, max: 100, step: 0.1 }}
          />

          <TextField
            label="Shares"
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            disabled={loading}
            error={!!validationErrors.shares}
            helperText={validationErrors.shares || 'Number of shares (optional)'}
            inputProps={{ min: 0, step: 1 }}
          />

          <TextField
            label="Average Cost"
            type="number"
            value={avgCost}
            onChange={(e) => setAvgCost(e.target.value)}
            disabled={loading}
            error={!!validationErrors.avgCost}
            helperText={validationErrors.avgCost || 'Average cost per share (optional)'}
            inputProps={{ min: 0, step: 0.01 }}
          />

          {mode === 'edit' && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption">
                Updates are performed by removing and re-adding the holding. If the update fails, the original will be automatically restored.
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
