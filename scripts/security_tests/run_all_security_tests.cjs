/**
 * Phase 7 — Master Security & Regression Test Runner
 * Executes the complete automated security test suite across Secret Scanning, API Security, and Database Persistence.
 */

const { runScanner } = require('./secret_scanner.cjs');
const { runApiSecurityTests } = require('./api_security_test.cjs');
const { runDatabaseSecurityTests } = require('./database_security_test.cjs');

async function main() {
  console.log('================================================================');
  console.log(' GREEN EYE COBOT / FIELDWATCH - MASTER SECURITY TEST SUITE');
  console.log('================================================================\n');

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // 1. Run Secret Scan
  console.log('--- CATEGORY 1: SECRET SCANNING & CREDENTIAL ISOLATION ---');
  const scanRes = runScanner();
  totalTests++;
  if (scanRes.pass) {
    totalPassed++;
  } else {
    totalFailed++;
  }
  console.log('');

  // 2. Run API, Authentication, AI, & Regression Suite
  console.log('--- CATEGORY 2: API, AUTHENTICATION, AI, & REGRESSION SUITE ---');
  const apiRes = await runApiSecurityTests();
  totalTests += apiRes.total;
  totalPassed += apiRes.passCount;
  totalFailed += apiRes.failCount;
  console.log('');

  // 3. Run Database, GeoJSON, TTL & Persistence Suite
  console.log('--- CATEGORY 3: DATABASE, GEOJSON, TTL & PERSISTENCE SUITE ---');
  const dbRes = await runDatabaseSecurityTests();
  totalTests += dbRes.total;
  totalPassed += dbRes.passCount;
  totalFailed += dbRes.failCount;
  totalSkipped += dbRes.skippedCount;
  console.log('');

  // Summary Report
  console.log('================================================================');
  console.log(' MASTER SECURITY SUITE SUMMARY REPORT');
  console.log('================================================================');
  console.log(` Total Security Tests:  ${totalTests}`);
  console.log(` Passed:                ${totalPassed}`);
  console.log(` Failed:                ${totalFailed}`);
  console.log(` Skipped:               ${totalSkipped}`);
  console.log('================================================================');

  if (totalFailed === 0) {
    console.log(' OVERALL STATUS: ALL AUTOMATED SECURITY TESTS PASSED');
    console.log('================================================================\n');
    process.exit(0);
  } else {
    console.error(' OVERALL STATUS: SECURITY TEST FAILURES DETECTED');
    console.log('================================================================\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL] Master test suite runner error:', err);
  process.exit(1);
});
