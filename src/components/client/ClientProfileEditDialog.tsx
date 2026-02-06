import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Slider,
  Grid,
  Typography,
  Box,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Tabs,
  Tab,
} from '@mui/material';
import {
  MANDATE_TYPES,
  HORIZONS,
  ALERT_FREQUENCIES,
  validateBenchmark,
  validateImpactThreshold,
  validateMandateText,
  getErrorMessage,
  type ClientProfile,
  type ClientProfileUpdate,
  type MandateType,
  type Horizon,
  type AlertFrequency,
} from '../../types/clientProfile';
import type { ClientRestrictions } from '../../types/restrictions';
import RestrictionsEditor from './RestrictionsEditor';

interface ClientProfileEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (updates: ClientProfileUpdate) => Promise<void>;
  profile: ClientProfile;
  clientName: string;
}

export default function ClientProfileEditDialog({
  open,
  onClose,
  onSave,
  profile,
  clientName,
}: ClientProfileEditDialogProps) {
  // Form state
  const [mandateType, setMandateType] = useState<MandateType | ''>(profile.mandate_type || '');
  const [benchmark, setBenchmark] = useState(profile.benchmark || '');
  const [horizon, setHorizon] = useState<Horizon | ''>(profile.horizon || '');
  const [esgConstrained, setEsgConstrained] = useState(profile.esg_constrained || false);
  const [alertFrequency, setAlertFrequency] = useState<AlertFrequency | ''>(
    profile.alert_frequency || ''
  );
  const [impactThreshold, setImpactThreshold] = useState(profile.impact_threshold ?? 50);
  const [mandateText, setMandateText] = useState(profile.mandate_text || '');
  const [restrictions, setRestrictions] = useState<ClientRestrictions>(profile.restrictions || {});

  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Track original values for dirty checking
  const [originalValues] = useState({
    mandate_type: profile.mandate_type || '',
    benchmark: profile.benchmark || '',
    horizon: profile.horizon || '',
    esg_constrained: profile.esg_constrained || false,
    alert_frequency: profile.alert_frequency || '',
    impact_threshold: profile.impact_threshold ?? 50,
    mandate_text: profile.mandate_text || '',
    restrictions: profile.restrictions || {},
  });

  // Reset form when dialog opens/closes or profile changes
  useEffect(() => {
    if (open) {
      setMandateType(profile.mandate_type || '');
      setBenchmark(profile.benchmark || '');
      setHorizon(profile.horizon || '');
      setEsgConstrained(profile.esg_constrained || false);
      setAlertFrequency(profile.alert_frequency || '');
      setImpactThreshold(profile.impact_threshold ?? 50);
      setMandateText(profile.mandate_text || '');
      setRestrictions(profile.restrictions || {});
      setActiveTab(0);
      setError(null);
      setValidationErrors({});
    }
  }, [open, profile]);

  // Calculate which fields have changed
  const getChangedFields = (): ClientProfileUpdate => {
    const changes: ClientProfileUpdate = {};

    if (mandateType !== originalValues.mandate_type) {
      changes.mandate_type = mandateType || undefined;
    }
    if (benchmark.toUpperCase() !== originalValues.benchmark.toUpperCase()) {
      changes.benchmark = benchmark.toUpperCase() || undefined;
    }
    if (horizon !== originalValues.horizon) {
      changes.horizon = horizon || undefined;
    }
    if (esgConstrained !== originalValues.esg_constrained) {
      changes.esg_constrained = esgConstrained;
    }
    if (alertFrequency !== originalValues.alert_frequency) {
      changes.alert_frequency = alertFrequency || undefined;
    }
    if (impactThreshold !== originalValues.impact_threshold) {
      changes.impact_threshold = impactThreshold;
    }
    if (mandateText !== originalValues.mandate_text) {
      changes.mandate_text = mandateText || undefined;
    }
    if (JSON.stringify(restrictions) !== JSON.stringify(originalValues.restrictions)) {
      changes.restrictions = restrictions;
    }

    return changes;
  };

  const hasChanges = Object.keys(getChangedFields()).length > 0;

  // Validate individual fields
  const validateField = (field: string, value: string | number): string | null => {
    switch (field) {
      case 'benchmark':
        return validateBenchmark(value as string);
      case 'impact_threshold':
        return validateImpactThreshold(value as number);
      case 'mandate_text':
        return validateMandateText(value as string);
      default:
        return null;
    }
  };

  // Handle field changes with validation
  const handleBenchmarkChange = (value: string) => {
    setBenchmark(value);
    const error = validateField('benchmark', value);
    setValidationErrors((prev) => ({
      ...prev,
      benchmark: error || '',
    }));
  };

  const handleImpactThresholdChange = (value: number) => {
    setImpactThreshold(value);
    const error = validateField('impact_threshold', value);
    setValidationErrors((prev) => ({
      ...prev,
      impact_threshold: error || '',
    }));
  };

  const handleMandateTextChange = (value: string) => {
    setMandateText(value);
    const error = validateField('mandate_text', value);
    setValidationErrors((prev) => ({
      ...prev,
      mandate_text: error || '',
    }));
  };

  // Validate all fields before save
  const validateAll = (): boolean => {
    const errors: Record<string, string> = {};

    const benchmarkError = validateField('benchmark', benchmark);
    if (benchmarkError) errors.benchmark = benchmarkError;

    const thresholdError = validateField('impact_threshold', impactThreshold);
    if (thresholdError) errors.impact_threshold = thresholdError;

    const mandateTextError = validateField('mandate_text', mandateText);
    if (mandateTextError) errors.mandate_text = mandateTextError;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    setError(null);

    // Validate all fields
    if (!validateAll()) {
      setError('Please fix validation errors before saving');
      return;
    }

    const changes = getChangedFields();

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setLoading(true);

    try {
      await onSave(changes);
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? getErrorMessage((err as Error & { code?: string }).code || '', err.message)
          : 'Failed to update profile';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>
        Edit Client Profile
        <Typography variant="caption" display="block" color="text.secondary">
          {clientName}
        </Typography>
      </DialogTitle>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}
      >
        <Tab label="Profile" />
        <Tab label="Restrictions" />
      </Tabs>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Profile Tab */}
        {activeTab === 0 && (
        <Grid container spacing={3}>
          {/* Mandate Type */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Mandate Type</InputLabel>
              <Select
                value={mandateType}
                onChange={(e) => setMandateType(e.target.value as MandateType)}
                label="Mandate Type"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {MANDATE_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Benchmark */}
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label="Benchmark"
              value={benchmark}
              onChange={(e) => handleBenchmarkChange(e.target.value)}
              placeholder="e.g., SPY, QQQ"
              helperText={validationErrors.benchmark || 'Ticker symbol (uppercase)'}
              error={!!validationErrors.benchmark}
              inputProps={{ style: { textTransform: 'uppercase' } }}
            />
          </Grid>

          {/* Horizon */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Investment Horizon
            </Typography>
            <ToggleButtonGroup
              value={horizon}
              exclusive
              onChange={(_, value) => setHorizon(value as Horizon)}
              fullWidth
            >
              {HORIZONS.map((h) => (
                <ToggleButton key={h.value} value={h.value}>
                  {h.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Grid>

          {/* Alert Frequency */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl fullWidth>
              <InputLabel>Alert Frequency</InputLabel>
              <Select
                value={alertFrequency}
                onChange={(e) => setAlertFrequency(e.target.value as AlertFrequency)}
                label="Alert Frequency"
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {ALERT_FREQUENCIES.map((freq) => (
                  <MenuItem key={freq.value} value={freq.value}>
                    {freq.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* ESG Constrained */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={esgConstrained}
                    onChange={(e) => setEsgConstrained(e.target.checked)}
                  />
                }
                label="ESG Constrained"
              />
            </Box>
          </Grid>

          {/* Impact Threshold */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Impact Threshold: {impactThreshold}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Slider
                value={impactThreshold}
                onChange={(_, value) => handleImpactThresholdChange(value as number)}
                min={0}
                max={100}
                step={5}
                marks={[
                  { value: 0, label: '0' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                  { value: 75, label: '75' },
                  { value: 100, label: '100' },
                ]}
                sx={{ flex: 1 }}
              />
              <TextField
                type="number"
                value={impactThreshold}
                onChange={(e) => handleImpactThresholdChange(Number(e.target.value))}
                inputProps={{ min: 0, max: 100, step: 1 }}
                sx={{ width: 80 }}
                error={!!validationErrors.impact_threshold}
                helperText={validationErrors.impact_threshold}
              />
            </Box>
          </Grid>

          {/* Mandate Text */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Investment Mandate & Guidelines
              </Typography>
              {mandateText && (
                <Button
                  size="small"
                  onClick={() => handleMandateTextChange('')}
                  disabled={loading}
                  sx={{ textTransform: 'none' }}
                >
                  Clear Mandate
                </Button>
              )}
            </Box>
            <TextField
              fullWidth
              multiline
              rows={6}
              label=""
              value={mandateText}
              onChange={(e) => handleMandateTextChange(e.target.value)}
              placeholder="Enter detailed investment guidelines, restrictions, and preferences..."
              helperText={
                validationErrors.mandate_text || 
                `${mandateText.length} / 5000 characters${mandateText.length >= 4800 ? ' (approaching limit)' : ''}`
              }
              error={!!validationErrors.mandate_text || mandateText.length > 5000}
              slotProps={{
                input: {
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  },
                },
                htmlInput: {
                  maxLength: 5000,
                },
              }}
            />
          </Grid>
        </Grid>
        )}

        {/* Restrictions Tab */}
        {activeTab === 1 && (
          <Box sx={{ py: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Restrictions are stored as full replacement. All fields below represent the complete state.
              Changes here will overwrite any existing restrictions.
            </Alert>
            <RestrictionsEditor
              value={restrictions}
              onChange={setRestrictions}
              disabled={loading}
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || !hasChanges}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
