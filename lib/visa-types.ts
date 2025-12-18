/**
 * Visa Status Types
 * 
 * Fixed enum values for consistent matching.
 * DO NOT add free-text options.
 */

export const VISA_STATUS_VALUES = [
  'US_CITIZEN',
  'GREEN_CARD',
  'H1B',
  'F1',
  'EAD',
  'TN',
  'UNSPECIFIED',
] as const;

export type VisaStatus = typeof VISA_STATUS_VALUES[number];

// User-facing labels
export const VISA_STATUS_LABELS: Record<VisaStatus, string> = {
  US_CITIZEN: 'US Citizen',
  GREEN_CARD: 'Green Card Holder',
  H1B: 'H1B Visa',
  F1: 'F1 (OPT/CPT)',
  EAD: 'Employment Authorization Document (EAD)',
  TN: 'TN Permit Holder',
  UNSPECIFIED: 'Unspecified (All jobs will be shared)',
};

// Check if a value is a valid visa status
export function isValidVisaStatus(value: string): value is VisaStatus {
  return VISA_STATUS_VALUES.includes(value as VisaStatus);
}

// Normalize legacy visa values to new enum
export function normalizeVisaStatus(value: string | null | undefined): VisaStatus {
  if (!value) return 'UNSPECIFIED';
  
  const upper = value.toUpperCase().trim();
  
  // Direct match
  if (isValidVisaStatus(upper)) return upper;
  
  // Legacy value mappings
  const legacyMappings: Record<string, VisaStatus> = {
    'US CITIZEN': 'US_CITIZEN',
    'USCITIZEN': 'US_CITIZEN',
    'CITIZEN': 'US_CITIZEN',
    'GC': 'GREEN_CARD',
    'GCH': 'GREEN_CARD',
    'GREEN CARD': 'GREEN_CARD',
    'GREENCARD': 'GREEN_CARD',
    'GREEN CARD HOLDER': 'GREEN_CARD',
    'H-1B': 'H1B',
    'H1-B': 'H1B',
    'H1': 'H1B',
    'F-1': 'F1',
    'OPT': 'F1',
    'CPT': 'F1',
    'F1 OPT': 'F1',
    'F1 CPT': 'F1',
    'TN VISA': 'TN',
    'TN-1': 'TN',
    'WORK PERMIT': 'EAD',
    'WORK AUTHORIZATION': 'EAD',
  };
  
  return legacyMappings[upper] || 'UNSPECIFIED';
}

