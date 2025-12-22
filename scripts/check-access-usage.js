/**
 * Build-time check to enforce usage of hasCandidateAccess()
 * 
 * This script scans the codebase for direct access checks that bypass hasCandidateAccess()
 * and fails the build if any are found.
 * 
 * Run: node scripts/check-access-usage.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FORBIDDEN_PATTERNS = [
  // Direct is_paid checks in access control logic (not display)
  {
    pattern: /if\s*\([^)]*\.is_paid\s*[!=]==?\s*(true|false)/,
    description: 'Direct is_paid check in conditional',
    allowIn: ['admin', 'payment'], // Allow in admin UI and payment processing
  },
  {
    pattern: /hasAccess\s*=.*\.is_paid/,
    description: 'Access check using direct is_paid',
    allowIn: [],
  },
  {
    pattern: /canAccess\s*=.*\.is_paid/,
    description: 'Access check using direct is_paid',
    allowIn: [],
  },
  
  // Direct trial_ends_at date comparisons for access (not display)
  {
    pattern: /if\s*\([^)]*trial_ends_at[^)]*[<>=]/,
    description: 'Direct trial_ends_at date comparison for access',
    allowIn: ['admin'], // Allow in admin UI
  },
  {
    pattern: /hasAccess\s*=.*trial_ends_at.*new Date/,
    description: 'Access check using direct trial_ends_at',
    allowIn: [],
  },
  
  // Direct payment_events queries (should use hasCandidateAccessServer)
  {
    pattern: /payment_events.*status.*completed/,
    description: 'Direct payment_events query (use hasCandidateAccessServer)',
    allowIn: ['accessCheck'], // Allow in accessCheck.ts itself
  },
];

const ALLOWED_FILES = [
  'lib/utils/accessCheck.ts', // The source of truth
  'lib/hooks/useAccessCheck.ts', // Uses hasCandidateAccess
  'scripts/check-access-usage.js', // This file
];

function shouldCheckFile(filePath) {
  // Only check TypeScript/JavaScript files
  if (!filePath.match(/\.(ts|tsx|js|jsx)$/)) {
    return false;
  }
  
  // Skip node_modules
  if (filePath.includes('node_modules')) {
    return false;
  }
  
  // Skip allowed files
  const relativePath = path.relative(process.cwd(), filePath);
  if (ALLOWED_FILES.some(allowed => relativePath.includes(allowed))) {
    return false;
  }
  
  return true;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];
  
  // Check if file imports hasCandidateAccess
  const hasImport = content.includes('hasCandidateAccess') || 
                    content.includes('hasCandidateAccessServer');
  
  // Determine file context
  const isAdminFile = filePath.includes('admin');
  const isPaymentFile = filePath.includes('payment');
  const isAccessCheckFile = filePath.includes('accessCheck');
  
  lines.forEach((line, index) => {
    FORBIDDEN_PATTERNS.forEach((patternDef, patternIndex) => {
      const pattern = typeof patternDef === 'object' ? patternDef.pattern : patternDef;
      const allowIn = typeof patternDef === 'object' ? patternDef.allowIn : [];
      
      if (pattern.test(line)) {
        // Allow if it's in a comment
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return;
        }
        
        // Allow if it's in the accessCheck.ts file itself
        if (isAccessCheckFile) {
          return;
        }
        
        // Allow if in allowed contexts
        if (allowIn.includes('admin') && isAdminFile) {
          return;
        }
        if (allowIn.includes('payment') && isPaymentFile) {
          return;
        }
        
        // Allow display/formatting uses (not access checks)
        if (line.includes('toLocaleString') || 
            line.includes('toISOString') ||
            line.includes('format') ||
            line.includes('display') ||
            line.includes('show') ||
            line.includes('render')) {
          return;
        }
        
        // Allow assignment to trial_ends_at (setting, not checking)
        if (line.includes('trial_ends_at =') || line.includes('trial_ends_at:')) {
          return;
        }
        
        // Flag if it's an access check pattern
        if (line.includes('hasAccess') || 
            line.includes('canAccess') ||
            line.includes('hasAccess =') ||
            line.includes('canAccess =') ||
            (!hasImport && (line.includes('is_paid') || line.includes('trial_ends_at')))) {
          issues.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            description: typeof patternDef === 'object' ? patternDef.description : 'Direct access check',
          });
        }
      }
    });
  });
  
  return issues;
}

function scanDirectory(dir, issues = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip certain directories
      if (['node_modules', '.next', '.git', 'dist', 'build'].includes(entry.name)) {
        continue;
      }
      scanDirectory(fullPath, issues);
    } else if (entry.isFile() && shouldCheckFile(fullPath)) {
      const fileIssues = checkFile(fullPath);
      issues.push(...fileIssues);
    }
  }
  
  return issues;
}

// Main execution
console.log('🔍 Checking for direct access checks that bypass hasCandidateAccess()...\n');

const rootDir = process.cwd();
const issues = scanDirectory(rootDir);

if (issues.length > 0) {
  console.error('❌ BUILD FAILED: Found direct access checks that bypass hasCandidateAccess()\n');
  console.error('All access decisions MUST use hasCandidateAccess() or hasCandidateAccessServer()\n');
  
  issues.forEach((issue, index) => {
    const relativePath = path.relative(process.cwd(), issue.file);
    console.error(`${index + 1}. ${relativePath}:${issue.line}`);
    console.error(`   ${issue.content}`);
    console.error('');
  });
  
  console.error('Fix: Replace direct access checks with hasCandidateAccess() or hasCandidateAccessServer()');
  console.error('See: lib/utils/accessCheck.ts for the centralized implementation\n');
  
  process.exit(1);
} else {
  console.log('✅ All access checks use hasCandidateAccess() - Build passed!\n');
  process.exit(0);
}

