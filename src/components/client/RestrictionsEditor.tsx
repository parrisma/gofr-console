/**
 * RestrictionsEditor Component
 * 
 * Multi-section form for editing comprehensive client ESG & compliance restrictions.
 * Supports ethical screening (negative), impact themes (positive), and future capabilities.
 */

import React from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Checkbox,
  Switch,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Alert,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  EXCLUDED_INDUSTRIES,
  IMPACT_THEMES,
  FAITH_BASED_CODES,
  getIndustryLabel,
  getImpactThemeLabel,
  getFaithBasedLabel,
} from '../../types/restrictions';
import type {
  ClientRestrictions,
  ExcludedIndustry,
  ImpactTheme,
  FaithBasedCode,
} from '../../types/restrictions';

interface RestrictionsEditorProps {
  /** Current restrictions value */
  value?: ClientRestrictions;
  
  /** Callback when restrictions change */
  onChange: (restrictions: ClientRestrictions) => void;
  
  /** Disable all inputs */
  disabled?: boolean;
}

export default function RestrictionsEditor({
  value = {},
  onChange,
  disabled = false,
}: RestrictionsEditorProps) {
  
  // ============================================================================
  // Ethical Sector Handlers
  // ============================================================================
  
  const excludedIndustries = value.ethical_sector?.excluded_industries || [];
  const faithBased = value.ethical_sector?.faith_based;
  const faithBasedSelectValue = faithBased || '';
  
  const handleIndustryToggle = (industry: ExcludedIndustry) => {
    const current = excludedIndustries;
    const newList = current.includes(industry)
      ? current.filter(i => i !== industry)
      : [...current, industry];
    
    onChange({
      ...value,
      ethical_sector: {
        ...value.ethical_sector,
        excluded_industries: newList.length > 0 ? newList : undefined,
      },
    });
  };
  
  const handleFaithBasedChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value as FaithBasedCode | '';
    onChange({
      ...value,
      ethical_sector: {
        ...value.ethical_sector,
        faith_based: newValue || undefined,
      },
    });
  };
  
  // ============================================================================
  // Impact & Sustainability Handlers
  // ============================================================================
  
  const impactMandate = value.impact_sustainability?.impact_mandate || false;
  const impactThemes = value.impact_sustainability?.impact_themes || [];
  const stewardshipObligations = value.impact_sustainability?.stewardship_obligations || false;
  
  const handleImpactMandateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      impact_sustainability: {
        ...value.impact_sustainability,
        impact_mandate: event.target.checked || undefined,
      },
    });
  };
  
  const handleImpactThemesChange = (event: SelectChangeEvent<string[]>) => {
    const newThemes = event.target.value as string[];
    onChange({
      ...value,
      impact_sustainability: {
        ...value.impact_sustainability,
        impact_themes: newThemes.length > 0 ? (newThemes as ImpactTheme[]) : undefined,
      },
    });
  };
  
  const handleStewardshipChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      impact_sustainability: {
        ...value.impact_sustainability,
        stewardship_obligations: event.target.checked || undefined,
      },
    });
  };
  
  // ============================================================================
  // Render Helpers
  // ============================================================================
  
  const hasEthicalRestrictions = excludedIndustries.length > 0 || faithBased;
  const hasImpactRestrictions = impactMandate || impactThemes.length > 0 || stewardshipObligations;
  
  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure ESG and compliance restrictions that affect news filtering and portfolio recommendations.
        Restrictions are stored as a complete replacement - all fields below represent the full state.
      </Typography>
      
      {/* ============================================================================
          Ethical Sector (Negative Screening)
          ============================================================================ */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">🚫 Ethical Sector (Negative Screening)</Typography>
            {hasEthicalRestrictions && (
              <Chip
                label={`${excludedIndustries.length} exclusions${faithBased ? ' + faith-based' : ''}`}
                size="small"
                color="error"
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Excluded Industries */}
            <FormControl component="fieldset" disabled={disabled}>
              <FormLabel component="legend">Excluded Industries</FormLabel>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                Stories about these industries will be filtered out (anti-pitch).
              </Typography>
              <FormGroup>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                  {EXCLUDED_INDUSTRIES.map((industry) => (
                    <FormControlLabel
                      key={industry}
                      control={
                        <Checkbox
                          checked={excludedIndustries.includes(industry)}
                          onChange={() => handleIndustryToggle(industry)}
                          size="small"
                        />
                      }
                      label={getIndustryLabel(industry)}
                    />
                  ))}
                </Box>
              </FormGroup>
            </FormControl>
            
            {/* Faith-Based Compliance */}
            <FormControl fullWidth disabled={disabled}>
              <FormLabel>Faith-Based Compliance</FormLabel>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                Apply additional restrictions based on religious values.
              </Typography>
              <Select
                value={faithBasedSelectValue}
                onChange={handleFaithBasedChange}
                displayEmpty
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {FAITH_BASED_CODES.map((code) => (
                  <MenuItem key={code} value={code}>
                    {getFaithBasedLabel(code)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </AccordionDetails>
      </Accordion>
      
      {/* ============================================================================
          Impact & Sustainability (Positive Screening)
          ============================================================================ */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">🌱 Impact & Sustainability (Positive Screening)</Typography>
            {hasImpactRestrictions && (
              <Chip
                label={`${impactThemes.length} themes${impactMandate ? ' + mandate' : ''}`}
                size="small"
                color="success"
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Impact Mandate */}
            <FormControl component="fieldset" disabled={disabled}>
              <FormControlLabel
                control={
                  <Switch
                    checked={impactMandate}
                    onChange={handleImpactMandateChange}
                  />
                }
                label="Impact Mandate"
              />
              <Typography variant="caption" color="text.secondary">
                Client has explicit requirement to generate measurable social/environmental impact.
              </Typography>
            </FormControl>
            
            {/* Impact Themes */}
            <FormControl fullWidth disabled={disabled}>
              <FormLabel>Impact Themes</FormLabel>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                Stories matching these themes will be prioritized (relevance boost).
              </Typography>
              <Select
                multiple
                value={impactThemes}
                onChange={handleImpactThemesChange}
                input={<OutlinedInput />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((theme) => (
                      <Chip
                        key={theme}
                        label={getImpactThemeLabel(theme as ImpactTheme)}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                )}
              >
                {IMPACT_THEMES.map((theme) => (
                  <MenuItem key={theme} value={theme}>
                    <Checkbox checked={impactThemes.includes(theme)} size="small" />
                    {getImpactThemeLabel(theme)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {/* Stewardship Obligations */}
            <FormControl component="fieldset" disabled={disabled}>
              <FormControlLabel
                control={
                  <Switch
                    checked={stewardshipObligations}
                    onChange={handleStewardshipChange}
                  />
                }
                label="Stewardship Obligations"
              />
              <Typography variant="caption" color="text.secondary">
                Client requires active ownership and ESG engagement activities.
              </Typography>
            </FormControl>
          </Box>
        </AccordionDetails>
      </Accordion>
      
      {/* ============================================================================
          Future Capabilities (Disabled Placeholders)
          ============================================================================ */}
      <Accordion disabled>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" color="text.disabled">
            ⚖️ Legal & Regulatory (Coming Soon)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info">
            UCITS compliance, MiFID II restrictions, and concentration limits will be available in Phase 2.
          </Alert>
        </AccordionDetails>
      </Accordion>
      
      <Accordion disabled>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" color="text.disabled">
            ⚠️ Operational Risk (Coming Soon)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info">
            Liquidity requirements, domicile restrictions, and leverage limits will be available in Phase 2.
          </Alert>
        </AccordionDetails>
      </Accordion>
      
      <Accordion disabled>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" color="text.disabled">
            💰 Tax & Accounting (Coming Soon)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity="info">
            Tax-loss harvesting, jurisdiction rules, and wash sale prevention will be available in Phase 2.
          </Alert>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
