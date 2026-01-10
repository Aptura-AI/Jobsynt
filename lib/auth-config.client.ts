/**
 * Client-safe auth configuration utilities
 * 
 * These functions can be imported by Client Components without server-only dependencies.
 * DO NOT import server-only modules (next/headers, fs, bcrypt, etc.) in this file.
 */

/**
 * Checks if URL search params indicate an invite signup
 * Invite signups have an 'email' parameter in the query string
 */
export function isInviteSignup(searchParams: URLSearchParams): boolean {
  // If there's an email parameter, treat it as an invite signup
  const email = searchParams.get('email');
  return email !== null && email.trim() !== '';
}
