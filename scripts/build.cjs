/**
 * Cross-platform build script
 * Handles Windows and Unix environments
 * Prevents Playwright from being evaluated during build
 */

const { execSync } = require('child_process');

// Set environment variables (works on both Windows and Unix)
process.env.NEXT_DISABLE_JEST_WORKERS = '1';
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Run access check
console.log('🔍 Checking for direct access checks that bypass hasCandidateAccess()...');
try {
  execSync('node scripts/check-access-usage.js', { 
    stdio: 'inherit',
    env: { ...process.env }
  });
} catch (error) {
  console.error('❌ Access check failed');
  process.exit(1);
}

// Run Next.js build
console.log('📦 Building Next.js application...');
try {
  execSync('next build', { 
    stdio: 'inherit',
    env: { ...process.env }
  });
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

console.log('✅ Build completed successfully!');

