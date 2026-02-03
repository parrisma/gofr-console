import { Box, Paper, Typography, Chip, Stack, Divider, LinearProgress, Tooltip, IconButton, Collapse } from '@mui/material';
import { Warning, CheckCircle, ErrorOutline, Edit, ExpandMore } from '@mui/icons-material';
import { useState } from 'react';
import { MANDATE_TYPES, HORIZONS, ALERT_FREQUENCIES } from '../../types/clientProfile';

interface ScoreBreakdown {
  holdings: { score: number; weight: number };
  mandate: { score: number; weight: number };
  constraints: { score: number; weight: number };
  engagement: { score: number; weight: number };
}

interface ClientHeaderProps {
  name: string;
  clientType: string;
  mandateType?: string;
  benchmark?: string;
  horizon?: string;
  alertFrequency?: string;
  esgConstrained?: boolean;
  impactThreshold?: number;
  turnoverRate?: number;
  mandateText?: string;
  completenessScore?: number;
  scoreBreakdown?: ScoreBreakdown;
  missingFields?: string[];
  editable?: boolean;
  onEdit?: () => void;
}

export default function ClientHeader({
  name,
  clientType,
  mandateType,
  benchmark,
  horizon,
  alertFrequency,
  esgConstrained,
  impactThreshold,
  turnoverRate,
  mandateText,
  completenessScore,
  scoreBreakdown,
  missingFields,
  editable = false,
  onEdit,
}: ClientHeaderProps) {
  const [mandateExpanded, setMandateExpanded] = useState(false);

  console.log('ClientHeader received mandateText:', mandateText);

  const getScoreColor = (score?: number) => {
    if (!score) return 'error';
    if (score >= 0.7) return 'success';
    if (score >= 0.4) return 'warning';
    return 'error';
  };

  const getScoreIcon = (score?: number) => {
    if (!score || score < 0.4) return <ErrorOutline />;
    if (score >= 0.7) return <CheckCircle />;
    return <Warning />;
  };

  const formatBreakdown = () => {
    if (!scoreBreakdown) return '';
    return [
      `Holdings: ${(scoreBreakdown.holdings.score * 100).toFixed(0)}% (weight: ${(scoreBreakdown.holdings.weight * 100).toFixed(0)}%)`,
      `Mandate: ${(scoreBreakdown.mandate.score * 100).toFixed(0)}% (weight: ${(scoreBreakdown.mandate.weight * 100).toFixed(0)}%)`,
      `Constraints: ${(scoreBreakdown.constraints.score * 100).toFixed(0)}% (weight: ${(scoreBreakdown.constraints.weight * 100).toFixed(0)}%)`,
      `Engagement: ${(scoreBreakdown.engagement.score * 100).toFixed(0)}% (weight: ${(scoreBreakdown.engagement.weight * 100).toFixed(0)}%)`,
    ].join(' • ');
  };

  // Helper functions to format display values
  const formatMandateType = (value?: string) => {
    if (!value) return null;
    return MANDATE_TYPES.find(m => m.value === value)?.label || value;
  };

  const formatHorizon = (value?: string) => {
    if (!value) return null;
    return HORIZONS.find(h => h.value === value)?.label || value;
  };

  const formatAlertFrequency = (value?: string) => {
    if (!value) return null;
    return ALERT_FREQUENCIES.find(a => a.value === value)?.label || value;
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack spacing={2}>
        {/* Client Name & Type with Completeness Score */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
                  {name}
                </Typography>
                {editable && onEdit && (
                  <IconButton
                    size="small"
                    onClick={onEdit}
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'primary.main',
                      },
                    }}
                    aria-label="Edit profile"
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Chip label={clientType} color="primary" sx={{ mt: 1 }} />
            </Box>
          </Box>
          
          {/* Completeness Score on Right */}
          {completenessScore !== undefined && (
            <Tooltip 
              title={
                <Box>
                  <Typography variant="body2" fontWeight="bold" gutterBottom>
                    Profile Completeness: {(completenessScore * 100).toFixed(0)}%
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                    Measures data readiness to serve this client
                  </Typography>
                  {scoreBreakdown && (
                    <Typography variant="caption" display="block" sx={{ whiteSpace: 'pre-wrap' }}>
                      {formatBreakdown()}
                    </Typography>
                  )}
                  {missingFields && missingFields.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" fontWeight="bold" display="block">
                        Missing Fields:
                      </Typography>
                      <Typography variant="caption" display="block">
                        {missingFields.join(', ')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              }
              arrow
              placement="left"
            >
              <Box sx={{ minWidth: 200 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {getScoreIcon(completenessScore)}
                  <Typography variant="caption" color="text.secondary">
                    Profile Completeness
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={completenessScore * 100} 
                  color={getScoreColor(completenessScore)}
                  sx={{ height: 8, borderRadius: 1 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {(completenessScore * 100).toFixed(0)}% complete
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Box>

        <Divider />

        {/* Key Profile Info */}
        <Stack direction="row" spacing={3} flexWrap="wrap">
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Mandate Profile
            </Typography>
            <Typography 
              variant="h6" 
              sx={{ mt: 0.5 }} 
              color={mandateType ? 'text.primary' : 'text.disabled'}
            >
              {formatMandateType(mandateType) || '<missing>'}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Benchmark
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ mt: 0.5 }}
              color={benchmark ? 'text.primary' : 'text.disabled'}
            >
              {benchmark || '<missing>'}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Horizon
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ mt: 0.5 }}
              color={horizon ? 'text.primary' : 'text.disabled'}
            >
              {formatHorizon(horizon) || '<missing>'}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Alert Frequency
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ mt: 0.5 }}
              color={alertFrequency ? 'text.primary' : 'text.disabled'}
            >
              {formatAlertFrequency(alertFrequency) || '<missing>'}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              Impact Threshold
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ mt: 0.5 }}
              color={impactThreshold !== undefined ? 'text.primary' : 'text.disabled'}
            >
              {impactThreshold !== undefined ? impactThreshold : '<missing>'}
            </Typography>
          </Box>

          {turnoverRate !== undefined && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Turnover Rate
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5 }}>
                {(turnoverRate * 100).toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Stack>

        {/* Constraints & Flags */}
        {esgConstrained && (
          <>
            <Divider />
            <Box>
              <Chip
                icon={<Warning />}
                label="ESG Constrained"
                color="error"
                sx={{ mr: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                This client has ESG investment restrictions
              </Typography>
            </Box>
          </>
        )}

        {/* Mandate Text - Expandable Section */}
        <>
          <Divider />
          <Box>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
                p: 1,
                borderRadius: 1,
                transition: 'background-color 0.2s',
              }}
              onClick={() => setMandateExpanded(!mandateExpanded)}
            >
              <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                  Investment Mandate & Guidelines
                  {!mandateText && (
                    <Typography 
                      component="span"
                      variant="caption" 
                      color="text.disabled"
                      sx={{ ml: 1 }}
                    >
                      (not set - click Edit to add)
                    </Typography>
                  )}
                </Typography>
                {!mandateExpanded && mandateText && (
                  <Typography 
                    variant="body2" 
                    color="text.primary"
                    sx={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {mandateText.substring(0, 150)}
                    {mandateText.length > 150 ? '...' : ''}
                  </Typography>
                )}
              </Box>
              <IconButton
                size="small"
                sx={{
                  transform: mandateExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <ExpandMore />
              </IconButton>
            </Box>
            <Collapse in={mandateExpanded}>
              <Box 
                sx={{ 
                  mt: 2, 
                  p: 2, 
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {mandateText ? (
                  <Typography 
                    variant="body2" 
                    sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {mandateText}
                  </Typography>
                ) : (
                  <Typography 
                    variant="body2" 
                    color="text.disabled"
                    sx={{ fontStyle: 'italic' }}
                  >
                    No investment mandate or guidelines have been set for this client. Click the Edit button above to add detailed investment guidelines, restrictions, and preferences.
                  </Typography>
                )}
              </Box>
            </Collapse>
          </Box>
        </>
      </Stack>
    </Paper>
  );
}
