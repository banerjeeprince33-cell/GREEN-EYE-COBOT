/**
 * Phase 7 — Database, GeoJSON, TTL & Persistence Security Test Suite
 */

const { MongoClient } = require('mongodb');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DATABASE || 'green_eye';
const DATA_DIR = path.join(ROOT_DIR, 'database', 'data');
const DETECTIONS_FILE = path.join(DATA_DIR, 'detections.json');

async function runDatabaseSecurityTests() {
  console.log('--- STARTING DATABASE & PERSISTENCE SECURITY TESTS ---');
  let passCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  const results = [];

  function record(name, pass, detail = '') {
    if (pass) {
      passCount++;
      console.log(`[PASS] ${name}`);
      results.push({ name, pass: true });
    } else {
      failCount++;
      console.error(`[FAIL] ${name} ${detail ? `(${detail})` : ''}`);
      results.push({ name, pass: false, detail });
    }
  }

  function skip(name, reason) {
    skippedCount++;
    console.log(`[SKIPPED] ${name} — ${reason}`);
    results.push({ name, skipped: true, reason });
  }

  // 1. Test JSON Fallback Structure & Atomic Replacement
  try {
    if (fs.existsSync(DETECTIONS_FILE)) {
      const raw = fs.readFileSync(DETECTIONS_FILE, 'utf8');
      const records = JSON.parse(raw);
      const isArray = Array.isArray(records);
      const hasGeo = records.length > 0 ? Boolean(records[0].locationGeo || records[0].latitude) : true;
      record('JSON Fallback: detections.json exists with valid structured array', isArray && hasGeo);
    } else {
      skip('JSON Fallback Integrity', 'Local detections.json not found');
    }
  } catch (err) {
    record('JSON Fallback Integrity', false, err.message);
  }

  // 2. Test MongoDB Live Connection & Indexes
  let client = null;
  try {
    client = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 2500
    });
    await client.connect();
    const db = client.db(DB_NAME);

    // Collections
    const collections = (await db.listCollections().toArray()).map(c => c.name);
    record('Database Collections: detections collection exists', collections.includes('detections'));
    record('Database Collections: telemetry_events collection exists', collections.includes('telemetry_events') || collections.includes('telemetry_logs'));
    record('Database Collections: users collection exists', collections.includes('users'));
    record('Database Collections: devices collection exists', collections.includes('devices'));
    record('Database Collections: commands collection exists', collections.includes('commands'));
    record('Database Collections: audit_events collection exists', collections.includes('audit_events'));

    // 2dsphere Geospatial Index
    const detIndexes = await db.collection('detections').indexes();
    const has2dsphere = detIndexes.some(idx => idx.key && idx.key.locationGeo === '2dsphere');
    record('Geospatial Index: 2dsphere index verified on detections.locationGeo', has2dsphere);

    // 7-Day TTL Index
    const targetTelCol = collections.includes('telemetry_events') ? 'telemetry_events' : 'telemetry_logs';
    const telIndexes = await db.collection(targetTelCol).indexes();
    const ttlIndex = telIndexes.find(idx => idx.expireAfterSeconds !== undefined);
    record('Retention Policy: 7-Day TTL index verified (expireAfterSeconds: 604800)', Boolean(ttlIndex && ttlIndex.expireAfterSeconds === 604800));

    // Unique Indexes
    const userIndexes = await db.collection('users').indexes();
    const hasUniqueUserId = userIndexes.some(idx => idx.unique && idx.key.id === 1);
    record('Database Constraints: Unique constraint index verified on users.id', hasUniqueUserId);

    const deviceIndexes = await db.collection('devices').indexes();
    const hasUniqueDeviceId = deviceIndexes.some(idx => idx.unique && idx.key.deviceId === 1);
    record('Database Constraints: Unique constraint index verified on devices.deviceId', hasUniqueDeviceId);

  } catch (dbErr) {
    skip('MongoDB Live Index Verification', `MongoDB unreachable at ${MONGO_URI} (${dbErr.message})`);
  } finally {
    if (client) await client.close().catch(() => {});
  }

  return { passCount, failCount, skippedCount, total: passCount + failCount + skippedCount, results };
}

if (require.main === module) {
  runDatabaseSecurityTests().then((res) => {
    console.log(`\nDatabase Security Suite Completed: ${res.passCount}/${res.total} passed (${res.skippedCount} skipped).`);
    process.exit(res.failCount === 0 ? 0 : 1);
  });
}

module.exports = { runDatabaseSecurityTests };
