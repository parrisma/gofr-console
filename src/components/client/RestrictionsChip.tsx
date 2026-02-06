/**
 * RestrictionsChip Component
 * 
 * Compact visual indicator for client restrictions with tooltip details.
 * Shows color-coded badges for exclusions (red) and impact themes (green).
 */

import React from 'react';
import {
  Box,
  Chip,
  Tooltip,
  Typography,
  Stack,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import SpaIcon from '@mui/icons-material/Spa';
import {
  countActiveRestrictions,
  isEmptyRestrictions,
  getIndustryLabel,
  getImpactThemeLabel,
  getFaithBasedLabel,
} from '../../types/restrictions';
import type { ClientRestrictions } from '../../types/restrictions';

interface RestrictionsChipProps {
  /** Client restrictions to display */
  restrictions?: ClientRestrictions;
  
  /** Click handler to expand full view (e.g., open profile editor) */
  onClick?: () => void;
  
  /** Size variant */
  size?: 'small' | 'medium';
}

export default function RestrictionsChip({
  restrictions,
  onClick,
  size = 'medium',
}: RestrictionsChipProps) {
  
  // Don't render anything if no restrictions
  if (isEmptyRestrictions(restrictions)) {
    return null;
  }
  
  const counts = countActiveRestrictions(restrictions);
  const excludedIndustries = restrictions?.ethical_sector?.excluded_industries || [];
  const faithBased = restrictions?.ethical_sector?.faith_based;
  const impactThemes = restrictions?.impact_sustainability?.impact_themes || [];
  const impactMandate = restrictions?.impact_sustainability?.impact_mandate;
  const stewardship = restrictions?.impact_sustainability?.stewardship_obligations;
  
  // Build tooltip content
  const tooltipContent = (
    <Box sx={{ p: 1, maxWidth: 400 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
        ESG & Compliance Restrictions
      </Typography>
      
      {/* Exclusions Section */}
      {counts.exclusions > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'error.light' }}>
            🚫 Negative Screening ({counts.exclusions})
          </Typography>
          
          {excludedIndustries.length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                Excluded Industries:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {excludedIndustries.map((industry) => (
                  <Chip
                    key={industry}
                    label={getIndustryLabel(industry)}
                    size="small"
                    color="error"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                ))}
              </Stack>
            </Box>
          )}
          
          {faithBased && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                Faith-Based: {getFaithBasedLabel(faithBased)}
              </Typography>
            </Box>
          )}
        </Box>
      )}
      
      {/* Impact Section */}
      {counts.impact > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'success.light' }}>
            🌱 Positive Screening ({counts.impact})
          </Typography>
          
          {impactMandate && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
              • Impact Mandate: Active
            </Typography>
          )}
          
          {impactThemes.length > 0 && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                Impact Themes:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                {impactThemes.map((theme) => (
                  <Chip
                    key={theme}
                    label={getImpactThemeLabel(theme)}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                ))}
              </Stack>
            </Box>
          )}
          
          {stewardship && (
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
              • Stewardship Obligations: Active
            </Typography>
          )}
        </Box>
      )}
      
      {counts.other > 0 && (
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontStyle: 'italic' }}>
          + {counts.other} other restriction(s)
        </Typography>
      )}
      
      {onClick && (
        <Typography variant="caption" sx={{ display: 'block', color: 'primary.main', mt: 1, fontStyle: 'italic' }}>
          Click to view/edit full restrictions
        </Typography>
      )}
    </Box>
  );
  
  return (
    <Tooltip title={tooltipContent} arrow placement="bottom-start">
      <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
        {/* Exclusions Badge */}
        {counts.exclusions > 0 && (
          <Chip
            icon={<BlockIcon />}
            label={`${counts.exclusions} exclusion${counts.exclusions > 1 ? 's' : ''}`}
            size={size}
            color="error"
            variant="outlined"
            onClick={onClick}
            sx={{
              cursor: onClick ? 'pointer' : 'default',
              '&:hover': onClick ? { backgroundColor: 'error.light', opacity: 0.8 } : {},
            }}
          />
        )}
        
        {/* Impact Badge */}
        {counts.impact > 0 && (
          <Chip
            icon={<SpaIcon />}
            label={`${counts.impact} impact theme${counts.impact > 1 ? 's' : ''}`}
            size={size}
            color="success"
            variant="outlined"
            onClick={onClick}
            sx={{
              cursor: onClick ? 'pointer' : 'default',
              '&:hover': onClick ? { backgroundColor: 'success.light', opacity: 0.8 } : {},
            }}
          />
        )}
        
        {/* Faith-Based Badge (if present without other exclusions) */}
        {faithBased && counts.exclusions === 1 && excludedIndustries.length === 0 && (
          <Chip
            label={getFaithBasedLabel(faithBased)}
            size={size}
            color="warning"
            variant="outlined"
            onClick={onClick}
            sx={{
              cursor: onClick ? 'pointer' : 'default',
              '&:hover': onClick ? { backgroundColor: 'warning.light', opacity: 0.8 } : {},
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}
