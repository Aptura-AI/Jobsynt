/**
 * Secure Credential Storage
 * 
 * Encrypts and stores job-board credentials securely.
 * 
 * Safety Rules:
 * - Passwords encrypted at rest
 * - Decrypt only in memory
 * - Never log credentials
 * - Never send credentials to GPT
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || '';
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt password
 */
function encryptPassword(password: string): { encrypted: string; iv: string; authTag: string } {
  if (!ENCRYPTION_KEY) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY not configured');
  }

  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt password
 */
function decryptPassword(encrypted: string, iv: string, authTag: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY not configured');
  }

  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Save encrypted credentials for a candidate and site
 */
export async function saveCredentials(params: {
  candidateId: string;
  site: string;
  email: string;
  password: string;
}): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Database not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Encrypt password
  const { encrypted, iv, authTag } = encryptPassword(params.password);

  // Store encrypted credentials in candidate_site_accounts
  // Using a JSONB field to store encrypted data
  const { error } = await supabase
    .from('candidate_site_accounts')
    .upsert({
      candidate_id: params.candidateId,
      site: params.site,
      email: params.email,
      account_status: 'VERIFIED',
      // Store encrypted password in a JSONB field (we'll add this column)
      encrypted_credentials: {
        encrypted,
        iv,
        authTag,
      },
    }, { onConflict: 'candidate_id,site' });

  if (error) {
    console.error('[Credentials] Failed to save credentials:', error);
    throw new Error('Failed to save credentials');
  }
}

/**
 * Get and decrypt credentials for a candidate and site
 */
export async function getCredentials(params: {
  candidateId: string;
  site: string;
}): Promise<{ email: string; password: string } | null> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: account, error } = await supabase
    .from('candidate_site_accounts')
    .select('email, encrypted_credentials, account_status')
    .eq('candidate_id', params.candidateId)
    .eq('site', params.site)
    .eq('account_status', 'VERIFIED')
    .maybeSingle();

  if (error || !account || !account.encrypted_credentials) {
    return null;
  }

  try {
    const creds = account.encrypted_credentials as { encrypted: string; iv: string; authTag: string };
    const password = decryptPassword(creds.encrypted, creds.iv, creds.authTag);

    return {
      email: account.email,
      password,
    };
  } catch (decryptError: any) {
    console.error('[Credentials] Failed to decrypt credentials:', decryptError);
    return null;
  }
}

/**
 * Check if credentials exist for a candidate and site
 */
export async function hasCredentials(params: {
  candidateId: string;
  site: string;
}): Promise<boolean> {
  const creds = await getCredentials(params);
  return creds !== null;
}

