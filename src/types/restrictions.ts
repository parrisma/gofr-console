/**
 * ESG & Compliance Restrictions Type Definitions
 * 
 * This module defines the TypeScript interfaces and constants for the client
 * restrictions system, matching the backend schema documented in esg_extension.md.
 */

// ============================================================================
// Standard Industry Codes
// ============================================================================

export const EXCLUDED_INDUSTRIES = [
  'TOBACCO',
  'WEAPONS',
  'GAMBLING',
  'PORNOGRAPHY',
  'ALCOHOL',
  'FOSSIL_FUELS',
  'PRIVATE_PRISONS',
  'PREDATORY_LENDING',
  'ANIMAL_TESTING',
  'PALM_OIL',
] as const;

export type ExcludedIndustry = typeof EXCLUDED_INDUSTRIES[number];

// ============================================================================
// Impact Themes
// ============================================================================

export const IMPACT_THEMES = [
  'clean_energy',
  'sustainable_transport',
  'affordable_housing',
  'healthcare_access',
  'education_equity',
  'financial_inclusion',
  'circular_economy',
  'biodiversity',
  'water_conservation',
  'climate_adaptation',
] as const;

export type ImpactTheme = typeof IMPACT_THEMES[number];

// ============================================================================
// Faith-Based Compliance Codes
// ============================================================================

export const FAITH_BASED_CODES = ['shariah', 'catholic', 'methodist'] as const;

export type FaithBasedCode = typeof FAITH_BASED_CODES[number];

// ============================================================================
// Restriction Interfaces
// ============================================================================

/**
 * Ethical sector restrictions for negative screening.
 */
export interface EthicalSectorRestrictions {
  /** Industries to exclude from negative screening */
  excluded_industries?: ExcludedIndustry[];
  
  /** Faith-based compliance requirement */
  faith_based?: FaithBasedCode;
}

/**
 * Impact and sustainability-focused restrictions for positive screening.
 */
export interface ImpactSustainabilityRestrictions {
  /** Whether client has explicit impact mandate */
  impact_mandate?: boolean;
  
  /** Specific impact themes to prioritize */
  impact_themes?: ImpactTheme[];
  
  /** Whether client requires stewardship/ESG engagement */
  stewardship_obligations?: boolean;
}

/**
 * Legal and regulatory restrictions (future capability).
 * Currently placeholders - to be implemented in Phase 2.
 */
export interface LegalRegulatoryRestrictions {
  /** EU UCITS restrictions */
  ucits_compliant?: boolean;
  
  /** MiFID II complex product restrictions */
  mifid_restrictions?: string[];
  
  /** Maximum single-name concentration limit */
  concentration_limits?: {
    single_name_max_pct?: number;
    sector_max_pct?: number;
  };
}

/**
 * Operational risk restrictions (future capability).
 * Currently placeholders - to be implemented in Phase 2.
 */
export interface OperationalRiskRestrictions {
  /** Minimum liquidity requirements */
  min_daily_volume?: number;
  
  /** Prohibited domiciles */
  prohibited_domiciles?: string[];
  
  /** Maximum leverage ratio */
  max_leverage?: number;
}

/**
 * Tax and accounting restrictions (future capability).
 * Currently placeholders - to be implemented in Phase 2.
 */
export interface TaxAccountingRestrictions {
  /** Tax-loss harvesting considerations */
  tax_loss_harvesting?: boolean;
  
  /** Jurisdiction-specific tax rules */
  tax_jurisdiction?: string;
  
  /** Wash sale prevention */
  wash_sale_aware?: boolean;
}

/**
 * Complete client restrictions object.
 * 
 * This matches the backend schema and supports full replacement semantics.
 * When updating restrictions via update_client_profile, always send the
 * complete restrictions object - partial updates are not supported.
 */
export interface ClientRestrictions {
  /** Ethical and negative screening restrictions (active) */
  ethical_sector?: EthicalSectorRestrictions;
  
  /** Impact and positive screening restrictions (active) */
  impact_sustainability?: ImpactSustainabilityRestrictions;
  
  /** Legal/regulatory restrictions (future capability) */
  legal_regulatory?: LegalRegulatoryRestrictions;
  
  /** Operational risk restrictions (future capability) */
  operational_risk?: OperationalRiskRestrictions;
  
  /** Tax accounting restrictions (future capability) */
  tax_accounting?: TaxAccountingRestrictions;
}

// ============================================================================
// Validation & Helper Functions
// ============================================================================

/**
 * Check if a restriction configuration is empty (no restrictions applied).
 */
export function isEmptyRestrictions(restrictions?: ClientRestrictions): boolean {
  if (!restrictions) return true;
  
  const hasEthical = 
    restrictions.ethical_sector?.excluded_industries?.length ||
    restrictions.ethical_sector?.faith_based;
  
  const hasImpact = 
    restrictions.impact_sustainability?.impact_mandate ||
    restrictions.impact_sustainability?.impact_themes?.length ||
    restrictions.impact_sustainability?.stewardship_obligations;
  
  const hasLegal = restrictions.legal_regulatory?.ucits_compliant;
  const hasOperational = restrictions.operational_risk?.min_daily_volume;
  const hasTax = restrictions.tax_accounting?.tax_loss_harvesting;
  
  return !hasEthical && !hasImpact && !hasLegal && !hasOperational && !hasTax;
}

/**
 * Count active restrictions across all categories.
 */
export function countActiveRestrictions(restrictions?: ClientRestrictions): {
  total: number;
  exclusions: number;
  impact: number;
  other: number;
} {
  if (!restrictions) {
    return { total: 0, exclusions: 0, impact: 0, other: 0 };
  }
  
  const exclusions = (restrictions.ethical_sector?.excluded_industries?.length || 0) +
    (restrictions.ethical_sector?.faith_based ? 1 : 0);
  
  const impact = (restrictions.impact_sustainability?.impact_themes?.length || 0) +
    (restrictions.impact_sustainability?.impact_mandate ? 1 : 0) +
    (restrictions.impact_sustainability?.stewardship_obligations ? 1 : 0);
  
  const other = 
    (restrictions.legal_regulatory ? 1 : 0) +
    (restrictions.operational_risk ? 1 : 0) +
    (restrictions.tax_accounting ? 1 : 0);
  
  return {
    total: exclusions + impact + other,
    exclusions,
    impact,
    other,
  };
}

/**
 * Validate that industry codes are from the standard list.
 */
export function validateExcludedIndustries(industries: string[]): boolean {
  return industries.every(ind => EXCLUDED_INDUSTRIES.includes(ind as ExcludedIndustry));
}

/**
 * Validate that impact themes are from the standard list.
 */
export function validateImpactThemes(themes: string[]): boolean {
  return themes.every(theme => IMPACT_THEMES.includes(theme as ImpactTheme));
}

/**
 * Validate faith-based code is from the standard list.
 */
export function validateFaithBased(code: string): boolean {
  return FAITH_BASED_CODES.includes(code as FaithBasedCode);
}

/**
 * Get human-readable label for excluded industry code.
 */
export function getIndustryLabel(code: ExcludedIndustry): string {
  const labels: Record<ExcludedIndustry, string> = {
    TOBACCO: 'Tobacco',
    WEAPONS: 'Weapons & Defense',
    GAMBLING: 'Gambling',
    PORNOGRAPHY: 'Adult Entertainment',
    ALCOHOL: 'Alcohol',
    FOSSIL_FUELS: 'Fossil Fuels',
    PRIVATE_PRISONS: 'Private Prisons',
    PREDATORY_LENDING: 'Predatory Lending',
    ANIMAL_TESTING: 'Animal Testing',
    PALM_OIL: 'Palm Oil',
  };
  return labels[code] || code;
}

/**
 * Get human-readable label for impact theme.
 */
export function getImpactThemeLabel(theme: ImpactTheme): string {
  const labels: Record<ImpactTheme, string> = {
    clean_energy: 'Clean Energy',
    sustainable_transport: 'Sustainable Transport',
    affordable_housing: 'Affordable Housing',
    healthcare_access: 'Healthcare Access',
    education_equity: 'Education Equity',
    financial_inclusion: 'Financial Inclusion',
    circular_economy: 'Circular Economy',
    biodiversity: 'Biodiversity',
    water_conservation: 'Water Conservation',
    climate_adaptation: 'Climate Adaptation',
  };
  return labels[theme] || theme;
}

/**
 * Get human-readable label for faith-based code.
 */
export function getFaithBasedLabel(code: FaithBasedCode): string {
  const labels: Record<FaithBasedCode, string> = {
    shariah: 'Shariah Compliant',
    catholic: 'Catholic Values',
    methodist: 'Methodist Values',
  };
  return labels[code] || code;
}
