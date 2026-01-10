/**
 * Apply for Me Types
 * 
 * Type definitions for application modes and supported sites.
 */

export type ApplyForMeMode =
  | "COLLABORATIVE"   // Default: Human-in-the-loop, candidate intervenes when needed
  | "FULLY_AUTOMATED"; // Future: Full automation (currently disabled)

export type SupportedApplySite =
  | "DICE"
  | "GREENHOUSE"
  | "TECHFETCH"
  | "ZIPRECRUITER";

export type ApplicationStatus =
  | "pending"
  | "running"
  | "submitted"
  | "failed"
  | "WAITING_FOR_CANDIDATE"; // New: Paused for human intervention

export type InterventionReason =
  | "CAPTCHA_REQUIRED"
  | "LOGIN_REQUIRED"
  | "SIGNUP_REQUIRED"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "PROFILE_COMPLETION_REQUIRED";

export interface HumanInterventionEvent {
  type: "HUMAN_INTERVENTION_REQUIRED";
  reason: InterventionReason;
  message: string;
  applicationRunId: string;
  jobTitle: string;
  jobCompany: string;
  site: SupportedApplySite;
  browserWindowOpen: boolean;
  instructions: string[];
}

export interface CandidateSiteAccount {
  id: string;
  candidate_id: string;
  site: SupportedApplySite;
  email: string;
  account_status: "NOT_CREATED" | "CREATED" | "ACTIVATED" | "VERIFIED";
  created_at: string;
  updated_at: string;
}

export interface ApplicationRun {
  id: string;
  candidate_id: string;
  job_id: string;
  job_url: string;
  status: ApplicationStatus;
  error?: string | null;
  applied_at?: string | null;
  intervention_reason?: string | null;
  intervention_message?: string | null;
  paused_at?: string | null;
  resume_token?: string | null;
  last_intervention_type?: string | null;
  last_intervention_timestamp?: string | null;
}

