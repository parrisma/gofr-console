/**
 * Restriction Templates
 * 
 * Preset configurations for common client restriction scenarios.
 * These templates help quickly initialize restrictions for new clients.
 */

import type { 
  ClientRestrictions, 
  ExcludedIndustry,
  ImpactTheme,
} from '../types/restrictions';

/**
 * No restrictions - default empty state
 */
export const TEMPLATE_NONE: ClientRestrictions = {};

/**
 * Standard ESG screening - common exclusions
 */
export const TEMPLATE_ESG_SCREENED: ClientRestrictions = {
  ethical_sector: {
    excluded_industries: [
      'TOBACCO',
      'WEAPONS',
      'GAMBLING',
      'FOSSIL_FUELS',
      'PRIVATE_PRISONS',
    ] as ExcludedIndustry[],
  },
};

/**
 * Shariah-compliant investing
 */
export const TEMPLATE_SHARIAH: ClientRestrictions = {
  ethical_sector: {
    excluded_industries: [
      'TOBACCO',
      'WEAPONS',
      'GAMBLING',
      'PORNOGRAPHY',
      'ALCOHOL',
    ] as ExcludedIndustry[],
    faith_based: 'shariah',
  },
};

/**
 * Impact fund with positive themes
 */
export const TEMPLATE_IMPACT_FUND: ClientRestrictions = {
  ethical_sector: {
    excluded_industries: [
      'TOBACCO',
      'WEAPONS',
      'FOSSIL_FUELS',
    ] as ExcludedIndustry[],
  },
  impact_sustainability: {
    impact_mandate: true,
    impact_themes: [
      'clean_energy',
      'sustainable_transport',
      'climate_adaptation',
    ] as ImpactTheme[],
    stewardship_obligations: true,
  },
};

/**
 * Catholic values-based investing
 */
export const TEMPLATE_CATHOLIC: ClientRestrictions = {
  ethical_sector: {
    excluded_industries: [
      'TOBACCO',
      'WEAPONS',
      'GAMBLING',
      'PORNOGRAPHY',
      'ALCOHOL',
    ] as ExcludedIndustry[],
    faith_based: 'catholic',
  },
};

/**
 * Methodist values-based investing
 */
export const TEMPLATE_METHODIST: ClientRestrictions = {
  ethical_sector: {
    excluded_industries: [
      'TOBACCO',
      'WEAPONS',
      'GAMBLING',
      'PORNOGRAPHY',
      'ALCOHOL',
    ] as ExcludedIndustry[],
    faith_based: 'methodist',
  },
};

/**
 * UCITS-compliant fund (placeholder for Phase 2)
 */
export const TEMPLATE_UCITS: ClientRestrictions = {
  legal_regulatory: {
    ucits_compliant: true,
  },
};

/**
 * All available restriction templates
 */
export const RESTRICTION_TEMPLATES = {
  none: {
    id: 'none',
    label: 'No Restrictions',
    description: 'No ESG or compliance restrictions applied',
    restrictions: TEMPLATE_NONE,
  },
  esg_screened: {
    id: 'esg_screened',
    label: 'ESG Screened',
    description: 'Common exclusions: Tobacco, Weapons, Gambling, Fossil Fuels, Private Prisons',
    restrictions: TEMPLATE_ESG_SCREENED,
  },
  shariah: {
    id: 'shariah',
    label: 'Shariah Compliant',
    description: 'Islamic finance principles with faith-based compliance',
    restrictions: TEMPLATE_SHARIAH,
  },
  catholic: {
    id: 'catholic',
    label: 'Catholic Values',
    description: 'Catholic values-based investing principles',
    restrictions: TEMPLATE_CATHOLIC,
  },
  methodist: {
    id: 'methodist',
    label: 'Methodist Values',
    description: 'Methodist values-based investing principles',
    restrictions: TEMPLATE_METHODIST,
  },
  impact_fund: {
    id: 'impact_fund',
    label: 'Impact Fund',
    description: 'Positive impact themes with stewardship obligations',
    restrictions: TEMPLATE_IMPACT_FUND,
  },
  ucits: {
    id: 'ucits',
    label: 'UCITS Compliant',
    description: 'EU UCITS regulatory framework (Phase 2)',
    restrictions: TEMPLATE_UCITS,
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    description: 'Define your own restriction configuration',
    restrictions: TEMPLATE_NONE,
  },
} as const;

export type TemplateId = keyof typeof RESTRICTION_TEMPLATES;

/**
 * Apply a template to create a restrictions object.
 * Returns a deep clone to avoid mutation.
 */
export function applyTemplate(templateId: TemplateId): ClientRestrictions {
  const template = RESTRICTION_TEMPLATES[templateId];
  return JSON.parse(JSON.stringify(template.restrictions));
}

/**
 * Get template metadata by ID
 */
export function getTemplate(templateId: TemplateId) {
  return RESTRICTION_TEMPLATES[templateId];
}

/**
 * Get all available templates as an array
 */
export function getAllTemplates() {
  return Object.values(RESTRICTION_TEMPLATES);
}
