/**
 * ClientCreateWizard Component
 * 
 * Multi-step wizard for creating new clients with comprehensive profile setup.
 * Steps: 1) Basic Info, 2) Investment Profile, 3) Alert Settings, 4) ESG & Restrictions
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Slider,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  RadioGroup,
  Radio,
} from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import {
  MANDATE_TYPES,
  HORIZONS,
  ALERT_FREQUENCIES,
  type MandateType,
  type Horizon,
  type AlertFrequency,
} from '../../types/clientProfile';
import type { ClientRestrictions } from '../../types/restrictions';
import RestrictionsEditor from './RestrictionsEditor';
import { 
  RESTRICTION_TEMPLATES, 
  applyTemplate,
  type TemplateId,
} from '../../utils/restrictionTemplates';

interface ClientCreateWizardProps {
  open: boolean;
  onClose: () => void;
  onCreate: (clientData: CreateClientData) => Promise<void>;
}

export interface CreateClientData {
  name: string;
  client_type: string;
  alert_frequency?: AlertFrequency;
  impact_threshold?: number;
  mandate_type?: MandateType;
  benchmark?: string;
  horizon?: Horizon;
  esg_constrained?: boolean;
  mandate_text?: string;
  restrictions?: ClientRestrictions;
}

const steps = ['Basic Info', 'Investment Profile', 'Alert Settings', 'ESG & Restrictions'];

export default function ClientCreateWizard({
  open,
  onClose,
  onCreate,
}: ClientCreateWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [clientType, setClientType] = useState('');

  // Step 2: Investment Profile
  const [mandateType, setMandateType] = useState<MandateType | ''>('');
  const [benchmark, setBenchmark] = useState('');
  const [horizon, setHorizon] = useState<Horizon | ''>('');
  const [mandateText, setMandateText] = useState('');

  // Step 3: Alert Settings
  const [alertFrequency, setAlertFrequency] = useState<AlertFrequency | ''>('realtime');
  const [impactThreshold, setImpactThreshold] = useState(50);

  // Step 4: ESG & Restrictions
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('none');
  const [restrictions, setRestrictions] = useState<ClientRestrictions>({});
  const [esgConstrained, setEsgConstrained] = useState(false);

  const handleNext = () => {
    setError(null);
    
    // Validate current step
    if (activeStep === 0) {
      if (!name.trim()) {
        setError('Client name is required');
        return;
      }
      if (!clientType.trim()) {
        setError('Client type is required');
        return;
      }
    }
    
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const handleTemplateSelect = (templateId: TemplateId) => {
    setSelectedTemplate(templateId);
    if (templateId === 'custom') {
      // Keep current restrictions for custom
      return;
    }
    const templateRestrictions = applyTemplate(templateId);
    setRestrictions(templateRestrictions);
    
    // Set esg_constrained flag based on template
    const hasRestrictions = templateId !== 'none';
    setEsgConstrained(hasRestrictions);
  };

  const handleCreate = async () => {
    setError(null);
    setLoading(true);

    const clientData: CreateClientData = {
      name: name.trim(),
      client_type: clientType.trim(),
      alert_frequency: alertFrequency || undefined,
      impact_threshold: impactThreshold,
      mandate_type: mandateType || undefined,
      benchmark: benchmark.trim().toUpperCase() || undefined,
      horizon: horizon || undefined,
      esg_constrained: esgConstrained,
      mandate_text: mandateText.trim() || undefined,
      restrictions: Object.keys(restrictions).length > 0 ? restrictions : undefined,
    };

    try {
      await onCreate(clientData);
      handleReset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setName('');
    setClientType('');
    setMandateType('');
    setBenchmark('');
    setHorizon('');
    setMandateText('');
    setAlertFrequency('realtime');
    setImpactThreshold(50);
    setSelectedTemplate('none');
    setRestrictions({});
    setEsgConstrained(false);
    setError(null);
  };

  const handleCancel = () => {
    handleReset();
    onClose();
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        // Basic Info
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                required
                label="Client Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Apex Capital, Green Investments"
                helperText="Full name of the client or fund"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                required
                label="Client Type"
                value={clientType}
                onChange={(e) => setClientType(e.target.value)}
                placeholder="e.g., Hedge Fund, Asset Manager, Family Office"
                helperText="Type or category of client"
              />
            </Grid>
          </Grid>
        );

      case 1:
        // Investment Profile
        return (
          <Grid container spacing={3}>
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

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Benchmark"
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                placeholder="e.g., SPY, QQQ"
                helperText="Ticker symbol (optional)"
                inputProps={{ style: { textTransform: 'uppercase' } }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Investment Horizon</InputLabel>
                <Select
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value as Horizon)}
                  label="Investment Horizon"
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {HORIZONS.map((h) => (
                    <MenuItem key={h.value} value={h.value}>
                      {h.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Investment Mandate & Guidelines"
                value={mandateText}
                onChange={(e) => setMandateText(e.target.value)}
                placeholder="Enter detailed investment guidelines, restrictions, and preferences..."
                helperText="Optional: Detailed mandate text"
              />
            </Grid>
          </Grid>
        );

      case 2:
        // Alert Settings
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Alert Frequency</InputLabel>
                <Select
                  value={alertFrequency}
                  onChange={(e) => setAlertFrequency(e.target.value as AlertFrequency)}
                  label="Alert Frequency"
                >
                  {ALERT_FREQUENCIES.map((freq) => (
                    <MenuItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                Impact Threshold: {impactThreshold}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Minimum impact score for news alerts (0-100)
              </Typography>
              <Slider
                value={impactThreshold}
                onChange={(_, value) => setImpactThreshold(value as number)}
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
              />
            </Grid>
          </Grid>
        );

      case 3:
        // ESG & Restrictions
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              ESG & Compliance Restrictions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose a preset template or configure custom restrictions
            </Typography>

            {/* Template Selection */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Quick Templates
              </Typography>
              <Grid container spacing={2}>
                {Object.values(RESTRICTION_TEMPLATES).map((template) => (
                  <Grid key={template.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card
                      variant="outlined"
                      sx={{
                        borderColor: selectedTemplate === template.id ? 'primary.main' : 'divider',
                        borderWidth: selectedTemplate === template.id ? 2 : 1,
                      }}
                    >
                      <CardActionArea onClick={() => handleTemplateSelect(template.id as TemplateId)}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                              {template.label}
                            </Typography>
                            {selectedTemplate === template.id && (
                              <CheckCircle color="primary" fontSize="small" />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {template.description}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Custom Configuration (only if "custom" selected) */}
            {selectedTemplate === 'custom' && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Custom Restrictions Configuration
                </Typography>
                <RestrictionsEditor
                  value={restrictions}
                  onChange={setRestrictions}
                  disabled={loading}
                />
              </Box>
            )}

            {/* Legacy ESG Flag */}
            <Box sx={{ mt: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={esgConstrained}
                    onChange={(e) => setEsgConstrained(e.target.checked)}
                  />
                }
                label="ESG Constrained (Legacy Flag)"
              />
              <Typography variant="caption" color="text.secondary" display="block">
                This flag is automatically set when restrictions are applied
              </Typography>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>Create New Client</DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {renderStepContent(activeStep)}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext} variant="contained">
            Next
          </Button>
        ) : (
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Creating...' : 'Create Client'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
