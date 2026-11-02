/**
 * FieldWatch / Green Eye Cobot - Phase 5 Database Migration Script
 * Idempotent migration of MongoDB collections, indexes, JSON schemas, and GeoJSON coordinate structures.
 */

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });
dotenv.config({ path: path.join(ROOT_DIR, 'backend', '.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const databaseName = process.env.MONGODB_DATABASE || 'green_eye';
const DATA_DIR = path.join(ROOT_DIR, 'database', 'data');
const DETECTIONS_FILE = path.join(DATA_DIR, 'detections.json');

function parseCoordinatesToGeoJSON(latitude, longitude) {
  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return null;
  }
  let lat = null;
  let lon = null;

  if (typeof latitude === 'number' && Number.isFinite(latitude)) {
    lat = latitude;
  } else if (typeof latitude === 'string') {
    const latMatch = latitude.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*([NS])?$/i);
    if (latMatch) {
      lat = parseFloat(latMatch[1]);
      if (latMatch[2] && latMatch[2].toUpperCase() === 'S') lat = -lat;
    }
  }

  if (typeof longitude === 'number' && Number.isFinite(longitude)) {
    lon = longitude;
  } else if (typeof longitude === 'string') {
    const lonMatch = longitude.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*([EW])?$/i);
    if (lonMatch) {
      lon = parseFloat(lonMatch[1]);
      if (lonMatch[2] && lonMatch[2].toUpperCase() === 'W') lon = -lon;
    }
  }

  if (lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon)) {
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        type: 'Point',
        coordinates: [Number(lon.toFixed(6)), Number(lat.toFixed(6))]
      };
    }
  }
  return null;
}

// 1. Migrate Local JSON files idempotently
function migrateLocalJsonFiles() {
  console.log('[Migration] Checking local persistent JSON data...');
  if (!fs.existsSync(DETECTIONS_FILE)) {
    console.log('[Migration] No local detections.json found. Skipping JSON file migration.');
    return;
  }

  try {
    const raw = fs.readFileSync(DETECTIONS_FILE, 'utf8');
    const records = JSON.parse(raw);
    if (!Array.isArray(records)) return;

    let updatedCount = 0;
    const migrated = records.map((rec) => {
      let changed = false;
      const copy = { ...rec };
      if (!copy.locationGeo && (copy.latitude || copy.longitude)) {
        const geo = parseCoordinatesToGeoJSON(copy.latitude, copy.longitude);
        if (geo) {
          copy.locationGeo = geo;
          changed = true;
        }
      }
      if (!copy.deviceId) {
        copy.deviceId = 'GE-01';
        changed = true;
      }
      if (changed) updatedCount++;
      return copy;
    });

    if (updatedCount > 0) {
      const tmpFile = `${DETECTIONS_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(migrated, null, 2), 'utf8');
      fs.renameSync(tmpFile, DETECTIONS_FILE);
      console.log(`[Migration] Successfully upgraded ${updatedCount} local JSON detection records with GeoJSON & deviceId.`);
    } else {
      console.log('[Migration] Local JSON detection records already up-to-date.');
    }
  } catch (err) {
    console.warn(`[Migration] Warning processing local JSON: ${err.message}`);
  }
}

// 2. Migrate MongoDB collections, schemas, and records
async function migrateMongoDB() {
  console.log('[Migration] Attempting to connect to MongoDB...');
  let client = null;
  try {
    client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000
    });
    await client.connect();
    console.log(`[Migration] Connected to MongoDB database: "${databaseName}"`);
    const db = client.db(databaseName);

    // List of collections to ensure
    const targetCollections = [
      'detections',
      'telemetry_events',
      'telemetry_logs',
      'users',
      'devices',
      'commands',
      'audit_events'
    ];

    const existingCols = (await db.listCollections().toArray()).map(c => c.name);
    for (const name of targetCollections) {
      if (!existingCols.includes(name)) {
        await db.createCollection(name);
        console.log(`[Migration] Created collection: "${name}"`);
      }
    }

    // Add indexes
    console.log('[Migration] Ensuring indexes...');
    // Detections
    await db.collection('detections').createIndex({ createdAt: -1 });
    await db.collection('detections').createIndex({ locationGeo: '2dsphere' }, { sparse: true });
    await db.collection('detections').createIndex({ deviceId: 1, createdAt: -1 });
    await db.collection('detections').createIndex({ source: 1 });

    // Telemetry TTL (7 days = 604800s)
    await db.collection('telemetry_events').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 604800, name: 'telemetry_events_7day_ttl' }
    );
    await db.collection('telemetry_events').createIndex({ deviceId: 1, createdAt: -1 });

    await db.collection('telemetry_logs').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 604800, name: 'telemetry_logs_7day_ttl' }
    );
    await db.collection('telemetry_logs').createIndex({ deviceId: 1, createdAt: -1 });

    // Users
    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ id: 1 }, { unique: true });

    // Devices
    await db.collection('devices').createIndex({ deviceId: 1 }, { unique: true });

    // Commands
    await db.collection('commands').createIndex({ issuedAt: -1 });
    await db.collection('commands').createIndex({ deviceId: 1, issuedAt: -1 });
    await db.collection('commands').createIndex({ expiresAt: 1 });

    // Audit Events
    await db.collection('audit_events').createIndex({ timestamp: -1 });
    await db.collection('audit_events').createIndex({ eventType: 1, timestamp: -1 });
    await db.collection('audit_events').createIndex({ actorId: 1 });

    console.log('[Migration] Indexes verified successfully.');

    // Migrate existing detection documents missing locationGeo
    const cursor = db.collection('detections').find({
      $or: [
        { locationGeo: { $exists: false } },
        { locationGeo: null },
        { deviceId: { $exists: false } }
      ]
    });

    let migratedDbCount = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const updates = {};
      if (!doc.locationGeo && (doc.latitude || doc.longitude)) {
        const geo = parseCoordinatesToGeoJSON(doc.latitude, doc.longitude);
        if (geo) updates.locationGeo = geo;
      }
      if (!doc.deviceId) {
        updates.deviceId = 'GE-01';
      }
      if (Object.keys(updates).length > 0) {
        await db.collection('detections').updateOne({ _id: doc._id }, { $set: updates });
        migratedDbCount++;
      }
    }

    console.log(`[Migration] MongoDB migration completed. ${migratedDbCount} detection records upgraded.`);
  } catch (err) {
    console.log(`[Migration] MongoDB is not running locally or unreachable (${err.message}). Static and JSON migration completed.`);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function run() {
  console.log('=== FIELDWATCH DATABASE MIGRATION (PHASE 5) ===');
  migrateLocalJsonFiles();
  await migrateMongoDB();
  console.log('=== MIGRATION FINISHED ===');
}

run();
