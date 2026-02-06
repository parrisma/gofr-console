/**
 * Shared types and constants for Client Profile management
 */

import type { ClientRestrictions } from './restrictions';

// Client profile attribute types
export type MandateType =
  | 'equity_long_short'
  | 'global_macro'
  | 'event_driven'
  | 'relative_value'
  | 'fixed_income'
  | 'multi_strategy';

export type Horizon = 'short' | 'medium' | 'long';

export type AlertFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly';

// Full client profile interface
export interface ClientProfile {
  name: string;
  client_type: string;
  alert_frequency?: AlertFrequency;
  impact_threshold?: number;
  mandate_type?: MandateType;
  benchmark?: string;
  horizon?: Horizon;
  esg_constrained?: boolean;
  turnover_rate?: number;
  mandate_text?: string;
  restrictions?: ClientRestrictions;
}

// Partial update payload (only changed fields)
export interface ClientProfileUpdate {
  mandate_type?: MandateType;
  benchmark?: string;
  horizon?: Horizon;
  esg_constrained?: boolean;
  alert_frequency?: AlertFrequency;
  impact_threshold?: number;
  mandate_text?: string;
  restrictions?: ClientRestrictions;
}

// Validation constants
export const MANDATE_TYPES: { value: MandateType; label: string }[] = [
  { value: 'equity_long_short', label: 'Equity Long/Short' },
  { value: 'global_macro', label: 'Global Macro' },
  { value: 'event_driven', label: 'Event Driven' },
  { value: 'relative_value', label: 'Relative Value' },
  { value: 'fixed_income', label: 'Fixed Income' },
  { value: 'multi_strategy', label: 'Multi-Strategy' },
];

export const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

export const ALERT_FREQUENCIES: { value: AlertFrequency; label: string }[] = [
  { value: 'realtime', label: 'Real-time' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

// Validation functions
export const validateBenchmark = (value: string): string | null => {
  if (!value) return null; // Optional field
  const upperValue = value.toUpperCase();
  if (!/^[A-Z0-9^.]+$/.test(upperValue)) {
    return 'Benchmark must contain only uppercase letters, numbers, ^, and .';
  }
  return null;
};

export const validateImpactThreshold = (value: number): string | null => {
  if (value === undefined || value === null) return null; // Optional field
  if (value < 0 || value > 100) {
    return 'Impact threshold must be between 0 and 100';
  }
  return null;
};

export const validateMandateText = (value: string): string | null => {
  if (!value) return null; // Optional field
  if (value.length > 5000) {
    return 'Mandate text must be 5000 characters or less';
  }
  return null;
};

// Backend error code mapping
export const ERROR_MESSAGES: Record<string, string> = {
  INVALID_ALERT_FREQUENCY:
    'Invalid alert frequency. Choose: realtime, hourly, daily, or weekly',
  INVALID_HORIZON: 'Invalid horizon. Choose: short, medium, or long',
  INVALID_MANDATE_TYPE: 'Invalid mandate type. Please select from the list',
  CLIENT_NOT_FOUND: 'Client not found. Please refresh and try again',
  UNAUTHORIZED: "You don't have permission to edit this client",
  INVALID_IMPACT_THRESHOLD: 'Impact threshold must be between 0 and 100',
  MANDATE_TEXT_TOO_LONG: 'Mandate text must be 5000 characters or less',
};

export const getErrorMessage = (errorCode: string, fallbackMessage?: string): string => {
  const knownCodes = new Set(Object.keys(ERROR_MESSAGES));
  return (
    (knownCodes.has(errorCode) ? ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES] : null) ||
    fallbackMessage ||
    'Failed to update profile. Please try again'
  );
};
