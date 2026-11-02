/**
 * Phase 7 — Automated Secret Scanner
 * Scans source and config files for exposed production secrets without printing secret values.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.gemini',
  '.vscode',
  'dist',
  'build'
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  '.env.example',
  'secrets.example.h'
]);

// Patterns to detect real secrets (ignoring common template placeholders)
const SECRET_RULES = [
  {
    name: 'Google / Gemini API Key',
    regex: /AIza[0-9A-Za-z-_]{35}/,
    category: 'API_CREDENTIAL'
  },
  {
    name: 'MongoDB Connection String with Embedded Password',
    regex: /mongodb(\+srv)?:\/\/[^:]+:[^@]+@/,
    category: 'DATABASE_CREDENTIAL'
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----/,
    category: 'CRYPTO_KEY'
  },
  {
    name: 'Hardcoded Wi-Fi Password in Firmware',
    regex: /const\s+char\*\s+(WIFI_PASSWORD|WIFI_PASS)\s*=\s*"([^"]+)"/,
    filter: (match) => !match[2].includes('YOUR_') && !match[2].includes('CHANGE_ME') && match[2].length > 0,
    category: 'FIRMWARE_SECRET'
  },
  {
    name: 'Hardcoded Production Hardware Token in Firmware',
    regex: /const\s+char\*\s+HW_TOKEN\s*=\s*"([^"]+)"/,
    filter: (match) => !match[1].includes('YOUR_') && !match[1].includes('CHANGE_ME') && match[1].length > 0,
    category: 'FIRMWARE_SECRET'
  }
];

function scanDirectory(dir, findings = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        scanDirectory(fullPath, findings);
      }
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name) || entry.name.endsWith('.tmp')) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, lineNum) => {
          for (const rule of SECRET_RULES) {
            const match = line.match(rule.regex);
            if (match) {
              const isViolating = rule.filter ? rule.filter(match) : true;
              if (isViolating) {
                findings.push({
                  file: relPath,
                  line: lineNum + 1,
                  rule: rule.name,
                  category: rule.category
                });
              }
            }
          }
        });
      } catch (err) {
        // Binary or unreadable file
      }
    }
  }
  return findings;
}

function runScanner() {
  console.log('[Secret Scanner] Scanning repository for exposed credentials...');
  const findings = scanDirectory(ROOT_DIR);

  if (findings.length === 0) {
    console.log('[PASS] Secret Scanner: Zero exposed credentials detected in repository.');
    return { pass: true, findings: [] };
  } else {
    console.error(`[FAIL] Secret Scanner: Found ${findings.length} suspicious secret patterns!`);
    findings.forEach((f) => {
      console.error(`  - [${f.category}] ${f.rule} in ${f.file}:${f.line} (Secret redacted)`);
    });
    return { pass: false, findings };
  }
}

if (require.main === module) {
  const result = runScanner();
  process.exit(result.pass ? 0 : 1);
}

module.exports = { runScanner };
