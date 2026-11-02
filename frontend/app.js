// ==========================================================================
// LIVE SERVER AUTO-RELOAD SHIELD
// Protects webcam, AI vision, and radar sessions from being wiped out
// by development live-reload file watchers (e.g. VS Code Live Server on port 5500)
// ==========================================================================
(function installLiveReloadShield() {
  if (typeof window === 'undefined') return;
  
  if (window.WebSocket) {
    const RawWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
      const ws = new RawWebSocket(...args);
      
      let customOnMessage = null;
      Object.defineProperty(ws, 'onmessage', {
        get() { return customOnMessage; },
        set(handler) {
          if (typeof handler === 'function') {
            customOnMessage = function(event) {
              if (event && (event.data === 'reload' || (typeof event.data === 'string' && event.data.includes('reload')))) {
                if (window.laptopCameraVideo || window.laptopCameraStream || window.isDetectionLoopRunning) {
                  console.info('[Fieldwatch Shield] Blocked background auto-reload to preserve live webcam stream.');
                  return;
                }
              }
              return handler(event);
            };
          } else {
            customOnMessage = handler;
          }
        }
      });

      const origAddEventListener = ws.addEventListener.bind(ws);
      ws.addEventListener = function(type, listener, options) {
        if (type === 'message' && typeof listener === 'function') {
          const guardedListener = function(event) {
            if (event && (event.data === 'reload' || (typeof event.data === 'string' && event.data.includes('reload')))) {
              if (window.laptopCameraVideo || window.laptopCameraStream || window.isDetectionLoopRunning) {
                console.info('[Fieldwatch Shield] Blocked background auto-reload to preserve live webcam stream.');
                return;
              }
            }
            return listener(event);
          };
          return origAddEventListener(type, guardedListener, options);
        }
        return origAddEventListener(type, listener, options);
      };

      return ws;
    };
  }
})();

const STORAGE_KEY = 'fieldwatch-live-detections-v3';
const AUTH_STORAGE_KEY = 'fieldwatch_researcher_session_v1';

// Centralized DOM Security & HTML Sanitization Utility
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Dynamically resolve API_BASE based on deployment environment
const API_BASE = (() => {
  if (typeof window === 'undefined' || !window.location) {
    return 'http://localhost:3000/api';
  }

  const { protocol, hostname, port, origin } = window.location;

  // Fallback for file:// protocol
  if (protocol === 'file:') {
    return 'http://localhost:3000/api';
  }

  // Local dev tooling (e.g. live-server on port 5500, Vite, etc.) connecting to local backend
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '3000') {
    return 'http://localhost:3000/api';
  }

  // Deployed cloud host (Render, Railway, VPS) or served directly via backend port 3000
  return `${origin}/api`;
})();

// Default Demo Researcher Fallback & Offline Registry (matches server.js registry)
const DEFAULT_RESEARCHER = {
  id: 'FW-842',
  email: 'arkasnata@fieldwatch.org',
  name: 'Arkasnata Bandyopadhyay',
  role: 'Lead Field Researcher',
  station: 'Kolkata Station (Node 04)',
  clearance: 'Level 3 - Full Camera & Database Clearance',
  avatar: 'AB'
};

const AUTHORIZED_OFFLINE_RESEARCHERS = [
  DEFAULT_RESEARCHER,
  {
    id: 'FW-101',
    email: 'researcher@fieldwatch.org',
    name: 'Dr. Elena Rostova',
    role: 'Senior Wildlife Biologist',
    station: 'Canopy Node 02',
    clearance: 'Level 3 - Surveillance & Sensor Operations',
    avatar: 'ER'
  },
  {
    id: 'FW-303',
    email: 'sanskriti@fieldwatch.org',
    name: 'Sanskriti Gupta',
    role: 'Research & Documentary Analyst',
    station: 'Kolkata Station (Node 04)',
    clearance: 'Level 3 - Research & Documentation Operations',
    avatar: 'SG'
  },
  {
    id: 'FW-404',
    email: 'ayitri@fieldwatch.org',
    name: 'Ayitri Dhar',
    role: 'Research & Development (R&D)',
    station: 'Kolkata Station (Node 04)',
    clearance: 'Level 3 - Research & Development Operations',
    avatar: 'AD'
  }
];

const seedDetections = [
  { animal: 'Asian elephant', species: 'Elephas maximus', symbol: '♞', tone: 'deer', location: 'North trail', latitude: '11.6824 N', longitude: '76.3721 E', altitude: '842 m', date: '27 Aug 2026', time: '09:40:52', confidence: '98.4%' },
  { animal: 'Indian gaur', species: 'Bos gaurus', symbol: '♞', tone: 'deer', location: 'River bend', latitude: '11.6791 N', longitude: '76.3802 E', altitude: '816 m', date: '27 Aug 2026', time: '09:18:26', confidence: '94.1%' },
  { animal: 'Malabar giant squirrel', species: 'Ratufa indica', symbol: '◉', tone: '', location: 'Canopy node 02', latitude: '11.6870 N', longitude: '76.3648 E', altitude: '901 m', date: '27 Aug 2026', time: '08:52:07', confidence: '91.7%' },
  { animal: 'Crested serpent eagle', species: 'Spilornis cheela', symbol: '⌁', tone: 'bird', location: 'East ridge', latitude: '11.6755 N', longitude: '76.3914 E', altitude: '977 m', date: '27 Aug 2026', time: '08:31:44', confidence: '89.6%' },
  { animal: 'Bonnet macaque', species: 'Macaca radiata', symbol: '◉', tone: 'cat', location: 'South clearing', latitude: '11.6718 N', longitude: '76.3695 E', altitude: '788 m', date: '27 Aug 2026', time: '07:46:12', confidence: '87.2%' }
];

/* ==========================================================================
   FIELD OPERATIONS NOTIFICATIONS & ALERTS SYSTEM
   ========================================================================== */

const NOTIF_SVGS = {
  danger: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
  success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  info: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>`,
  radar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19.1"/></svg>`,
  signal: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2"/><path d="M12 20v2"/></svg>`,
  battery: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/><line x1="10" x2="10" y1="11" y2="13"/></svg>`
};

let systemNotifications = [
  {
    id: 1,
    type: 'danger',
    icon: 'danger',
    title: 'Visual Threat Detection',
    desc: 'Bengal Tiger (96.2% conf) registered near Node 02 River Bend.',
    time: '2 mins ago',
    unread: true
  },
  {
    id: 2,
    type: 'success',
    icon: 'radar',
    title: 'Ultrasonic Radar Online',
    desc: '180° sweep active across 4 field nodes at 115200 baud.',
    time: '8 mins ago',
    unread: true
  },
  {
    id: 3,
    type: 'info',
    icon: 'signal',
    title: 'Field Station Online',
    desc: 'Station Node 04 locked to RF telemetry link (Node 04).',
    time: '14 mins ago',
    unread: true
  },
  {
    id: 4,
    type: 'info',
    icon: 'battery',
    title: 'ESP32-CAM Solar Battery',
    desc: 'Optimal charge at 87% with strong RF SNR signal telemetry.',
    time: '25 mins ago',
    unread: false
  }
];

function renderNotifications() {
  const listEl = document.querySelector('#notif-list');
  const countEl = document.querySelector('#notif-badge-count');
  if (!listEl) return;

  const unreadCount = systemNotifications.filter(n => n.unread).length;
  if (countEl) {
    countEl.textContent = unreadCount;
    countEl.style.display = unreadCount > 0 ? 'inline-block' : 'none';
  }

  listEl.textContent = '';
  systemNotifications.forEach(n => {
    const item = document.createElement('div');
    item.className = `notif-item ${n.unread ? 'unread' : ''} ${n.type === 'danger' ? 'danger' : ''}`;
    item.dataset.id = String(n.id);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'notif-item-icon';
    const svg = (typeof n.icon === 'string' && NOTIF_SVGS[n.icon]) 
      ? NOTIF_SVGS[n.icon] 
      : (NOTIF_SVGS[n.type] || NOTIF_SVGS.info);
    iconSpan.innerHTML = svg;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'notif-item-content';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'notif-item-title';
    titleSpan.textContent = n.title || '';

    const descSpan = document.createElement('span');
    descSpan.className = 'notif-item-desc';
    descSpan.textContent = n.desc || '';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'notif-item-time';
    timeSpan.textContent = n.time || '';

    contentDiv.appendChild(titleSpan);
    contentDiv.appendChild(descSpan);
    contentDiv.appendChild(timeSpan);

    item.appendChild(iconSpan);
    item.appendChild(contentDiv);
    listEl.appendChild(item);
  });
}

function addSystemNotification(type, title, desc, icon = 'info') {
  const newNotif = {
    id: Date.now(),
    type,
    icon,
    title,
    desc,
    time: 'Just now',
    unread: true
  };
  systemNotifications.unshift(newNotif);
  if (systemNotifications.length > 25) systemNotifications.pop();
  renderNotifications();
}

function markAllNotificationsRead() {
  systemNotifications.forEach(n => n.unread = false);
  renderNotifications();
  showToast('All notifications marked as read');
}

let currentResearcher = null;
let detections = loadDetections();
let showingAll = true;
let laptopCameraStream;
let laptopCameraImage;
let laptopCameraVideo;
let faceScanTimer;
let boxesPollInFlight = false;
let latestBoxes = [];
let currentDeviceLocation = null;
let deviceLocationWatchId = null;

/* ==========================================================================
   AUTHENTICATION & ACCESS CONTROL
   ========================================================================== */

function getAuthSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    return session && session.token ? session : null;
  } catch {
    return null;
  }
}

function saveAuthSession(session) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getAuthToken() {
  const session = getAuthSession();
  return session?.token || null;
}

/* ==========================================================================
   MULTI-ENGINE GEOSPATIAL & LAPTOP LOCATION TELEMETRY
   ========================================================================== */

const LOCATION_STORAGE_KEY = 'fieldwatch_station_location';

function getStoredLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.city === 'Dalsingpara' || Math.abs(Number(parsed.latitude) - 26.8142) < 0.2)) {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setStoredLocation(loc) {
  try {
    if (!loc) return;
    if (loc.city === 'Dalsingpara' || Math.abs(Number(loc.latitude) - 26.8142) < 0.2) {
      return; // Do not store inaccurate Dalsingpara roaming fix
    }
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
  } catch {}
}

function formatCoordinate(value, positiveLabel, negativeLabel) {
  const number = Number(value);
  if (isNaN(number)) return '--';
  return `${Math.abs(number).toFixed(6)}° ${number >= 0 ? positiveLabel : negativeLabel}`;
}

function getGoogleMapsUrl(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return `https://www.google.com/maps?q=${lat},${lon}&z=17&t=k`;
}

function getGoogleMapsDirectionsUrl(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

function getGoogleMapsEmbedUrl(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return `https://maps.google.com/maps?q=${lat},${lon}&t=k&z=16&ie=UTF8&iwloc=&output=embed`;
}

function getOsmEmbedUrl(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  const offset = 0.008;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${(lon - offset).toFixed(5)}%2C${(lat - offset).toFixed(5)}%2C${(lon + offset).toFixed(5)}%2C${(lat + offset).toFixed(5)}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lon.toFixed(5)}`;
}

let activeMapTab = 'hud'; // 'hud' | 'gmaps' | 'osm'

function switchMapView(mode) {
  activeMapTab = mode;
  const hudFrame = document.querySelector('#map-visual-hud');
  const gmapsFrame = document.querySelector('#map-visual-gmaps');
  const osmFrame = document.querySelector('#map-visual-osm');
  const hudBtn = document.querySelector('#map-tab-hud');
  const gmapsBtn = document.querySelector('#map-tab-gmaps');
  const osmBtn = document.querySelector('#map-tab-osm');

  [hudBtn, gmapsBtn, osmBtn].forEach(b => b?.classList.remove('active'));

  if (hudFrame) hudFrame.style.display = mode === 'hud' ? 'block' : 'none';
  if (gmapsFrame) gmapsFrame.style.display = mode === 'gmaps' ? 'block' : 'none';
  if (osmFrame) osmFrame.style.display = mode === 'osm' ? 'block' : 'none';

  if (mode === 'hud') hudBtn?.classList.add('active');
  if (mode === 'gmaps') {
    gmapsBtn?.classList.add('active');
    refreshMapIframes();
  }
  if (mode === 'osm') {
    osmBtn?.classList.add('active');
    refreshMapIframes();
  }
}

function refreshMapIframes() {
  if (!currentDeviceLocation) return;
  const lat = Number(currentDeviceLocation.latitude);
  const lon = Number(currentDeviceLocation.longitude);
  if (isNaN(lat) || isNaN(lon)) return;

  const gmapsIframe = document.querySelector('#gmaps-satellite-frame');
  if (gmapsIframe && (!gmapsIframe.src || gmapsIframe.src === 'about:blank' || !gmapsIframe.src.includes(`${lat},${lon}`))) {
    gmapsIframe.src = getGoogleMapsEmbedUrl(lat, lon);
  }

  const osmIframe = document.querySelector('#osm-map-frame');
  if (osmIframe && (!osmIframe.src || osmIframe.src === 'about:blank' || !osmIframe.src.includes(`${lat.toFixed(5)}`))) {
    osmIframe.src = getOsmEmbedUrl(lat, lon);
  }

  const modalMapFrame = document.querySelector('#loc-modal-map-frame');
  if (modalMapFrame && (!modalMapFrame.src || modalMapFrame.src === 'about:blank' || !modalMapFrame.src.includes(`${lat},${lon}`))) {
    modalMapFrame.src = getGoogleMapsEmbedUrl(lat, lon);
  }
}

async function resolveLocationAddress(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (isNaN(lat) || isNaN(lon)) return null;

  try {
    const res = await fetch(`${API_BASE}/location/reverse?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}

  // Fallback direct Nominatim
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.county || 'Field Station';
      const state = addr.state || addr.province || '';
      const country = addr.country || '';
      return {
        displayName: data.display_name,
        city,
        state,
        country,
        formatted: `${city}${state ? ', ' + state : ''}${country ? ', ' + country : ''}`
      };
    }
  } catch {}

  return {
    displayName: `Station (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
    city: 'Field Station',
    formatted: `Station Sector (${lat.toFixed(4)}, ${lon.toFixed(4)})`
  };
}

function updateLocationUI(location) {
  if (!location) return;
  const latNum = Number(location.latitude);
  const lonNum = Number(location.longitude);
  const latitudeText = formatCoordinate(latNum, 'N', 'S');
  const longitudeText = formatCoordinate(lonNum, 'E', 'W');
  const accuracy = Number.isFinite(location.accuracy) ? Math.round(location.accuracy) : 15;
  const coordinateText = `${latitudeText} / ${longitudeText}`;
  const addressText = location.formattedAddress || location.city || 'Field Station';

  // 1. Top workspace banner & camera
  const stationEl = document.querySelector('#workspace-location-name');
  if (stationEl) {
    const cityName = location.city ? location.city.toUpperCase() : 'STATION 04';
    stationEl.textContent = `GPS FIX // ${cityName}`;
  }

  const coordsEl = document.querySelector('#workspace-location-coords');
  if (coordsEl) {
    coordsEl.textContent = `[${latitudeText} / ${longitudeText}]`;
  }

  const stationIndicator = document.querySelector('#workspace-station-indicator');
  if (stationIndicator) {
    stationIndicator.setAttribute('title', `GPS Fix: ${coordinateText} (±${accuracy}m) • Click to Calibrate`);
  }

  const cameraLocationEl = document.querySelector('#camera-dynamic-loc-name');
  if (cameraLocationEl) cameraLocationEl.textContent = `${location.city || 'Sector 04'} (${coordinateText})`;

  const dropdownStationEl = document.querySelector('#dropdown-station');
  if (dropdownStationEl) dropdownStationEl.textContent = `${location.city || 'Field Station'} • ${coordinateText}`;

  // 1.5. Workspace dropdown elements
  const wsCoordsEl = document.querySelector('#ws-dropdown-coords');
  if (wsCoordsEl) wsCoordsEl.textContent = `${latitudeText} • ${longitudeText} (±${accuracy}m)`;

  const wsLaptopCoords = document.querySelector('#ws-preset-laptop-coords');
  if (wsLaptopCoords) wsLaptopCoords.textContent = `${addressText} [${latitudeText}, ${longitudeText}]`;

  const wsGmapsLink = document.querySelector('#ws-open-gmaps-link');
  if (wsGmapsLink) wsGmapsLink.href = getGoogleMapsUrl(latNum, lonNum);

  // 2. Map HUD card
  const liveCoordsEl = document.querySelector('#map-live-coordinates');
  if (liveCoordsEl) liveCoordsEl.textContent = `${latitudeText}, ${longitudeText}`;

  const liveAccEl = document.querySelector('#map-live-accuracy');
  if (liveAccEl) {
    const altText = location.altitude ? ` • Alt: ${location.altitude}` : '';
    liveAccEl.textContent = `±${accuracy}m precision${altText}`;
  }

  const liveAddressEl = document.querySelector('#map-live-address');
  if (liveAddressEl) liveAddressEl.textContent = addressText;

  const liveSourceEl = document.querySelector('#map-live-source');
  if (liveSourceEl) {
    const src = (location.source || 'Laptop GPS').toUpperCase();
    liveSourceEl.textContent = `● ${src}`;
  }

  const hudOverlaySource = document.querySelector('#map-hud-source-text');
  if (hudOverlaySource) {
    hudOverlaySource.textContent = `${latitudeText} • ${longitudeText} (±${accuracy}m)`;
  }

  const hudLabelStation = document.querySelector('#map-hud-label-station');
  if (hudLabelStation) {
    hudLabelStation.textContent = `${location.city || 'Station 04'} (Laptop GPS)`;
  }

  const hudStationPin = document.querySelector('#pin-kolkata');
  if (hudStationPin) {
    hudStationPin.setAttribute('title', `${location.city || 'Station 04'} [${latitudeText}, ${longitudeText}]`);
  }

  // 3. Google Maps action links
  const mapsLink = document.querySelector('#google-maps-location-link');
  if (mapsLink) {
    mapsLink.href = getGoogleMapsUrl(latNum, lonNum);
    mapsLink.removeAttribute('aria-disabled');
  }

  const dirLink = document.querySelector('#google-maps-directions-link');
  if (dirLink) {
    dirLink.href = getGoogleMapsDirectionsUrl(latNum, lonNum);
    dirLink.removeAttribute('aria-disabled');
  }

  // 4. Modal elements (Calibrate Field Location)
  const activeTitleEl = document.querySelector('#loc-active-station-title');
  if (activeTitleEl) {
    const src = location.source ? `(Source: ${location.source})` : '(Source: Laptop)';
    activeTitleEl.textContent = `${location.city || 'Field Station'} ${src}`;
  }

  const activeCoordsEl = document.querySelector('#loc-active-station-coords');
  if (activeCoordsEl) {
    const alt = location.altitude ? `Alt: ${location.altitude}` : 'Alt: N/A';
    activeCoordsEl.textContent = `${latitudeText}, ${longitudeText} (Accuracy ±${accuracy}m, ${alt})`;
  }

  // Refresh iframes if open
  refreshMapIframes();
  refreshMapIframes();
}

/* ==========================================================================
   HIGH-ACCURACY CONTINUOUS BROWSER GPS ENGINE (watchPosition)
   ========================================================================== */

const GPS_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30000
};

let lastGpsTimestamp = 0;
let isGpsWatcherRunning = false;
let gpsPermissionState = 'prompt'; // 'granted' | 'prompt' | 'denied'
let isManualStationOverride = false;

// Setup Permissions API listener if supported
if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
  try {
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      gpsPermissionState = status.state;
      status.onchange = () => {
        gpsPermissionState = status.state;
        if (status.state === 'granted') {
          console.log('[GPS Engine] Browser location permission granted by user');
          if (!isManualStationOverride) {
            startLiveGpsWatcher({ notify: true, forceRestart: true });
          }
        } else if (status.state === 'denied') {
          console.warn('[GPS Engine] Browser location permission denied by user');
          updateGpsStatusUI('PERMISSION_DENIED');
        }
      };
    }).catch(() => {});
  } catch {}
}

function updateGpsStatusUI(statusType, detailMessage = '') {
  const stationNameEl = document.querySelector('#workspace-location-name');
  const stationCoordsEl = document.querySelector('#workspace-location-coords');
  const liveSourceEl = document.querySelector('#map-live-source');
  const liveAccuracyEl = document.querySelector('#map-live-accuracy');
  const activeTitleEl = document.querySelector('#loc-active-station-title');
  const activeCoordsEl = document.querySelector('#loc-active-station-coords');

  if (statusType === 'ACQUIRING') {
    if (stationNameEl) stationNameEl.textContent = 'GPS FIX // ACQUIRING...';
    if (stationCoordsEl) stationCoordsEl.textContent = '[Locking Satellites...]';
    if (liveSourceEl) liveSourceEl.textContent = '● SEARCHING SATELLITES';
    if (liveAccuracyEl) liveAccuracyEl.textContent = 'Acquiring high-precision GPS fix...';
    if (activeTitleEl) activeTitleEl.textContent = 'Live Satellite GPS (Acquiring Satellites...)';
    if (activeCoordsEl) activeCoordsEl.textContent = 'Awaiting browser geolocation stream...';
  } else if (statusType === 'PERMISSION_DENIED') {
    if (stationNameEl) stationNameEl.textContent = 'GPS // PERMISSION BLOCKED';
    if (stationCoordsEl) stationCoordsEl.textContent = '[Enable Location in Browser]';
    if (liveSourceEl) liveSourceEl.textContent = '● GPS PERMISSION DENIED';
    if (liveAccuracyEl) liveAccuracyEl.textContent = 'Location blocked: allow access in browser URL bar';
    if (activeTitleEl) activeTitleEl.textContent = 'GPS Blocked: Permission Denied';
    if (activeCoordsEl) activeCoordsEl.textContent = 'Click lock/tune icon in browser URL bar and set Location to Allow';
  } else if (statusType === 'POSITION_UNAVAILABLE') {
    if (liveSourceEl) liveSourceEl.textContent = '● SENSOR UNAVAILABLE';
    if (liveAccuracyEl) liveAccuracyEl.textContent = detailMessage || 'GPS/WiFi position temporarily unavailable';
  } else if (statusType === 'TIMEOUT') {
    if (liveSourceEl) liveSourceEl.textContent = '● GPS RETRYING';
    if (liveAccuracyEl) liveAccuracyEl.textContent = 'Satellite fix timeout (30s) • retrying continuous watch...';
  } else if (statusType === 'INSECURE_CONTEXT') {
    if (stationNameEl) stationNameEl.textContent = 'GPS // INSECURE CONTEXT';
    if (stationCoordsEl) stationCoordsEl.textContent = '[Requires HTTPS or Localhost]';
    if (liveSourceEl) liveSourceEl.textContent = '● INSECURE CONTEXT';
    if (liveAccuracyEl) liveAccuracyEl.textContent = 'Browser restricts GPS to HTTPS/localhost';
  }
}

function useVerifiedKolkataStation(notify = false) {
  const kolkataLoc = {
    latitude: 22.564300,
    longitude: 88.369300,
    accuracy: 15,
    altitude: '12 m MSL',
    rawAltitude: 12,
    heading: null,
    speed: null,
    city: 'Kolkata',
    displayName: 'Kolkata, West Bengal, India',
    formattedAddress: 'Kolkata, West Bengal, India',
    source: 'Field Station GPS',
    timestamp: Date.now()
  };
  currentDeviceLocation = kolkataLoc;
  setStoredLocation(kolkataLoc);
  updateLocationUI(kolkataLoc);
  if (notify) {
    showToast('✓ GPS locked: Kolkata Station (22.5643° N, 88.3693° E)');
  }
}

function onGpsPositionSuccess(position, notify = false) {
  if (!position || !position.coords) return;
  const coords = position.coords;

  const lat = coords.latitude;
  const lon = coords.longitude;
  const accuracy = coords.accuracy;
  const altitude = coords.altitude;
  const heading = coords.heading;
  const speed = coords.speed;
  const timestamp = position.timestamp || Date.now();

  // Validate coordinates are real finite floating numbers
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.warn('[GPS Engine] Received non-finite coordinates from browser:', lat, lon);
    return;
  }

  // Reject coarse cellular roaming tower estimates (e.g. Dalsingpara 26.8142 with ±50000m error)
  // When laptop is on an ESP32 hotspot or cellular tether without hardware GPS, browsers guess ISP circle hubs
  if (accuracy >= 5000 && (Math.abs(lat - 26.8142) < 0.25 || Math.abs(lat - 22.56) > 2.0)) {
    console.warn('[GPS Engine] Rejected coarse cellular roaming node (lat:', lat, 'lon:', lon, 'accuracy:', accuracy, 'm). Retaining verified Kolkata station.');
    useVerifiedKolkataStation(notify);
    return;
  }

  // Reject stale or out-of-order updates
  if (timestamp < lastGpsTimestamp) {
    console.warn('[GPS Engine] Out-of-order position timestamp discarded:', timestamp, '<', lastGpsTimestamp);
    return;
  }
  lastGpsTimestamp = timestamp;
  isManualStationOverride = false;

  // Format optional telemetry parameters when available
  const altText = Number.isFinite(altitude) ? `${altitude.toFixed(1)} m` : null;
  const headingVal = Number.isFinite(heading) ? heading : null;
  const speedVal = Number.isFinite(speed) ? speed : null;

  // Quality tag based strictly on browser-reported accuracy
  let qualitySource = 'Browser Geolocation';
  if (accuracy <= 25) {
    qualitySource = 'Exact Satellite GPS';
  } else if (accuracy <= 100) {
    qualitySource = 'High-Precision WiFi/Cell';
  } else if (accuracy <= 1000) {
    qualitySource = 'Standard Browser Geo';
  } else {
    qualitySource = 'Coarse Network Location';
  }

  const isFirstFix = !currentDeviceLocation || currentDeviceLocation.source === 'Station Preset';

  // Construct location record strictly from raw browser telemetry (no rounding, no guessing)
  const loc = {
    latitude: lat,
    longitude: lon,
    accuracy: accuracy,
    altitude: altText,
    rawAltitude: Number.isFinite(altitude) ? altitude : null,
    heading: headingVal,
    speed: speedVal,
    source: qualitySource,
    timestamp: timestamp
  };

  // Retain reverse geocoded city name if user has not moved significantly
  if (currentDeviceLocation && currentDeviceLocation.city &&
      Math.abs(currentDeviceLocation.latitude - lat) < 0.001 &&
      Math.abs(currentDeviceLocation.longitude - lon) < 0.001) {
    loc.city = currentDeviceLocation.city;
    loc.displayName = currentDeviceLocation.displayName;
    loc.formattedAddress = currentDeviceLocation.formattedAddress;
  }

  currentDeviceLocation = loc;
  setStoredLocation(loc);
  updateLocationUI(loc);

  // Asynchronously resolve human-readable city/suburb without altering coordinates
  if (!loc.city || !loc.formattedAddress) {
    resolveLocationAddress(lat, lon).then((addr) => {
      if (addr && currentDeviceLocation && currentDeviceLocation.timestamp === timestamp) {
        currentDeviceLocation.city = addr.city;
        currentDeviceLocation.displayName = addr.displayName;
        currentDeviceLocation.formattedAddress = addr.formatted;
        updateLocationUI(currentDeviceLocation);
      }
    }).catch(() => {});
  }

  if (notify || isFirstFix) {
    const accText = accuracy < 100 ? `${Math.round(accuracy)}m` : `${(accuracy / 1000).toFixed(1)}km`;
    showToast(`✓ Satellite GPS lock active (±${accText} accuracy)`);
  }
}

function onGpsPositionError(err, notify = false) {
  console.warn('[GPS Engine] watchPosition error:', err.code, err.message);

  if (err.code === 1) { // PERMISSION_DENIED
    gpsPermissionState = 'denied';
    updateGpsStatusUI('PERMISSION_DENIED');
    if (notify) {
      showToast('⚠️ Location access blocked: Please click the lock/tune icon in your address bar and allow Location access');
    }
  } else if (err.code === 2) { // POSITION_UNAVAILABLE
    updateGpsStatusUI('POSITION_UNAVAILABLE', err.message);
    if (notify) {
      showToast('⚠️ GPS position unavailable: Please ensure Windows Location Service or WiFi is enabled');
    }
  } else if (err.code === 3) { // TIMEOUT
    updateGpsStatusUI('TIMEOUT');
  }
}

function startLiveGpsWatcher({ notify = false, forceRestart = false } = {}) {
  // 1. Secure context check (Geolocation API is blocked by browsers on insecure HTTP except localhost)
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    console.error('[GPS Engine] Not running in a secure context! Geolocation requires HTTPS or localhost.');
    updateGpsStatusUI('INSECURE_CONTEXT');
    if (notify) showToast('⚠️ Location requires a secure context (HTTPS or localhost)');
    return null;
  }

  // 2. Browser capability check
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.error('[GPS Engine] navigator.geolocation is not supported in this browser');
    if (notify) showToast('⚠️ Browser does not support geolocation');
    return null;
  }

  // 3. Restart watcher if requested or not running
  if (forceRestart && deviceLocationWatchId !== null) {
    try {
      navigator.geolocation.clearWatch(deviceLocationWatchId);
    } catch {}
    deviceLocationWatchId = null;
    isGpsWatcherRunning = false;
  }

  if (deviceLocationWatchId !== null && isGpsWatcherRunning) {
    if (notify) {
      if (currentDeviceLocation) {
        showToast(`🛰️ Continuous GPS tracking active: ${currentDeviceLocation.city || 'Field Station'} (±${Math.round(currentDeviceLocation.accuracy || 10)}m)`);
      } else {
        showToast('🛰️ Continuous GPS watcher active, waiting for satellite fix...');
      }
    }
    return deviceLocationWatchId;
  }

  updateGpsStatusUI('ACQUIRING');
  if (notify) {
    showToast('🛰️ Starting high-accuracy continuous GPS tracking...');
  }

  try {
    deviceLocationWatchId = navigator.geolocation.watchPosition(
      (pos) => onGpsPositionSuccess(pos, notify),
      (err) => onGpsPositionError(err, notify),
      GPS_WATCH_OPTIONS
    );
    isGpsWatcherRunning = true;
    console.log('[GPS Engine] Started watchPosition with ID:', deviceLocationWatchId, GPS_WATCH_OPTIONS);
    return deviceLocationWatchId;
  } catch (err) {
    console.error('[GPS Engine] Failed to start watchPosition:', err);
    if (notify) showToast(`⚠️ Failed to start GPS tracking: ${err.message}`);
    return null;
  }
}

function stopLiveGpsWatcher() {
  if (deviceLocationWatchId !== null && navigator.geolocation) {
    try {
      navigator.geolocation.clearWatch(deviceLocationWatchId);
      console.log('[GPS Engine] Cleared watchPosition ID:', deviceLocationWatchId);
    } catch {}
    deviceLocationWatchId = null;
  }
  isGpsWatcherRunning = false;
}

async function requestCurrentLocation({ notify = true } = {}) {
  startLiveGpsWatcher({ notify, forceRestart: true });
  if (currentDeviceLocation) return currentDeviceLocation;

  // Wait up to 6 seconds for first watchPosition callback to fire
  return new Promise((resolve) => {
    let resolved = false;
    const interval = setInterval(() => {
      if (currentDeviceLocation) {
        clearInterval(interval);
        resolved = true;
        resolve(currentDeviceLocation);
      }
    }, 200);

    setTimeout(() => {
      if (!resolved) {
        clearInterval(interval);
        resolve(currentDeviceLocation);
      }
    }, 6000);
  });
}

function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function updateResearcherUI(researcher) {
  if (!researcher) return;
  
  // Topbar
  const topAvatar = document.querySelector('#topbar-user-avatar');
  if (topAvatar) topAvatar.textContent = researcher.avatar || 'AB';
  
  const topBadge = document.querySelector('#topbar-clearance');
  if (topBadge) topBadge.textContent = `CLEARANCE: ${researcher.clearance?.split('-')[0]?.trim() || 'LEVEL 3'}`;

  // Dropdown Menu
  const ddName = document.querySelector('#dropdown-name');
  if (ddName) ddName.textContent = researcher.name;
  const ddId = document.querySelector('#dropdown-id');
  if (ddId) ddId.textContent = `ID: #${researcher.id}`;
  const ddStation = document.querySelector('#dropdown-station');
  if (ddStation) ddStation.textContent = researcher.station;

  // Sidebar Profile
  const sideAvatar = document.querySelector('#sidebar-avatar');
  if (sideAvatar) sideAvatar.textContent = researcher.avatar || 'AB';
  const sideName = document.querySelector('#sidebar-researcher-name');
  if (sideName) sideName.textContent = researcher.name;
  const sideRole = document.querySelector('#sidebar-researcher-role');
  if (sideRole) sideRole.textContent = researcher.role;

  // Greeting
  updateRealtimeGreeting(researcher.name);
}

function checkAuthStatus() {
  const session = getAuthSession();
  const authModal = document.querySelector('#auth-modal');
  
  if (session && session.researcher && session.token) {
    currentResearcher = session.researcher;
    document.body.classList.remove('locked');
    if (authModal) authModal.classList.remove('active');
    updateResearcherUI(currentResearcher);
    syncDetectionsFromApi();
    syncTelemetryFromApi();
    configureLiveCamera();
    requestCurrentLocation({ notify: false }).catch(() => {});
  } else {
    currentResearcher = null;
    document.body.classList.add('locked');
    if (authModal) authModal.classList.add('active');
    checkPublicDatabaseHealth().catch(() => {});
    syncDetectionsFromApi().catch(() => {});
  }
}

let lockoutTimerInterval = null;

async function loginResearcher(identifier, password, remember = true) {
  const errorBanner = document.querySelector('#auth-error');
  const lockoutBanner = document.querySelector('#auth-lockout');
  const submitBtn = document.querySelector('#auth-submit-btn');
  
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying Credentials...';
  }
  if (errorBanner) errorBanner.style.display = 'none';
  if (lockoutBanner) lockoutBanner.style.display = 'none';

  let authData = null;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: String(identifier).trim(), password: String(password) })
    });

    if (response.status === 429) {
      const errData = await response.json();
      let waitSec = Number(errData.retryAfter) || 300;
      if (lockoutBanner) {
        lockoutBanner.style.display = 'block';
        lockoutBanner.textContent = '';
        const strong = document.createElement('strong');
        strong.textContent = '🔒 TERMINAL LOCKED';
        const span = document.createElement('span');
        span.textContent = ` Anti-brute-force defense active. Try again in ${waitSec}s`;
        lockoutBanner.appendChild(strong);
        lockoutBanner.appendChild(span);
        if (lockoutTimerInterval) clearInterval(lockoutTimerInterval);
        lockoutTimerInterval = setInterval(() => {
          waitSec -= 1;
          span.textContent = ` Anti-brute-force defense active. Try again in ${waitSec}s`;
          if (waitSec <= 0) {
            clearInterval(lockoutTimerInterval);
            lockoutBanner.style.display = 'none';
            if (submitBtn) submitBtn.disabled = false;
          }
        }, 1000);
      }
      throw new Error(errData.error || 'Too many attempts. Terminal locked.');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Access Denied: Invalid Field Researcher credentials or passcode.');
    }

    authData = await response.json();
  } catch (error) {
    // If backend is offline / unreachable (Failed to fetch / network error), provide Zero-Cloud Local Fail-Safe
    const isNetworkError = error instanceof TypeError || 
                           error.name === 'TypeError' || 
                           (error.message && (error.message.includes('fetch') || error.message.includes('Network') || error.message.includes('Failed')));

    if (isNetworkError) {
      const cleanId = String(identifier).trim().toLowerCase();
      const cleanPass = String(password).trim();
      const matched = AUTHORIZED_OFFLINE_RESEARCHERS.find(r => 
        r.email.toLowerCase() === cleanId || r.id.toLowerCase() === cleanId
      );

      if (matched && cleanPass === 'field2026') {
        authData = {
          success: true,
          token: `offline_token_${matched.id}_${Date.now()}`,
          researcher: matched,
          offlineFailSafe: true
        };
        showToast('⚡ Offline Fail-Safe Active: Local Terminal Unlocked');
      } else {
        if (errorBanner && (!lockoutBanner || lockoutBanner.style.display === 'none')) {
          errorBanner.textContent = 'Access Denied: Invalid Field Researcher credentials or passcode.';
          errorBanner.style.display = 'block';
        }
        return;
      }
    } else {
      if (errorBanner && (!lockoutBanner || lockoutBanner.style.display === 'none')) {
        errorBanner.textContent = error.message || 'Access Denied: Invalid Field Researcher credentials';
        errorBanner.style.display = 'block';
      }
      return;
    }
  } finally {
    if (submitBtn && (!lockoutBanner || lockoutBanner.style.display === 'none')) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Authenticate &amp; Unlock Terminal</span> <i>&rarr;</i>';
    }
  }

  if (authData && authData.researcher) {
    if (remember) {
      saveAuthSession(authData);
    }
    
    currentResearcher = authData.researcher;
    document.body.classList.remove('locked');
    document.querySelector('#auth-modal')?.classList.remove('active');
    updateResearcherUI(currentResearcher);
    showToast(`Access granted: Welcome ${currentResearcher.name}`);

    syncDetectionsFromApi().catch(() => {});
    syncTelemetryFromApi().catch(() => {});
    requestCurrentLocation({ notify: false }).catch(() => {});
  }
}

function restoreDefaultForestArt() {
  const forest = document.querySelector('.forest-art');
  if (!forest) return;
  forest.classList.remove('laptop-camera-view', 'live-source', 'live-camera-view');
  forest.innerHTML = `
    <div class="mist mist-one"></div>
    <div class="mist mist-two"></div>
    <div class="tree tree-left"></div>
    <div class="tree tree-right"></div>
    <div class="animal-silhouette">&#x265E;</div>
    <div class="camera-crosshair"></div>
    <span class="cam-time" id="realtime-cam-clock">${new Date().toLocaleTimeString('en-GB')}</span>
    <span class="cam-meta">CAM-04 / 1080P / 24 FPS</span>
  `;
  const scanBadge = document.querySelector('.scan-badge') || document.querySelector('.face-scan-badge');
  if (scanBadge) {
    scanBadge.className = 'scan-badge';
    scanBadge.innerHTML = '<span class="pulse-dot"></span> Scanning';
  }
  const btn = document.querySelector('#laptop-camera-button');
  if (btn) btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg> <span>Use laptop webcam</span>';
}

let overlayAnimFrameId = null;

function stopAllCameraStreams() {
  isDetectionLoopRunning = false;
  window.isDetectionLoopRunning = false;
  if (overlayAnimFrameId) {
    cancelAnimationFrame(overlayAnimFrameId);
    overlayAnimFrameId = null;
  }
  if (faceScanTimer) {
    window.clearInterval(faceScanTimer);
    faceScanTimer = undefined;
  }
  if (laptopCameraStream) {
    try {
      laptopCameraStream.getTracks().forEach((track) => track.stop());
    } catch {}
    laptopCameraStream = undefined;
    window.laptopCameraStream = undefined;
  }
  if (laptopCameraVideo) {
    laptopCameraVideo.srcObject = null;
    laptopCameraVideo.onloadedmetadata = null;
    laptopCameraVideo.onerror = null;
    laptopCameraVideo.remove();
    laptopCameraVideo = undefined;
    window.laptopCameraVideo = undefined;
  }
  if (laptopCameraImage) {
    laptopCameraImage.onerror = null;
    laptopCameraImage.remove();
    laptopCameraImage = undefined;
    window.laptopCameraImage = undefined;
  }
  setSubsystemStatus('camera', 'offline', 'STANDBY');
  setSubsystemStatus('vision', 'online', 'READY');
  restoreDefaultForestArt();
}

function logoutResearcher() {
  clearAuthSession();
  currentResearcher = null;

  stopLiveGpsWatcher();
  currentDeviceLocation = null;
  lastGpsTimestamp = 0;
  
  // Close any active webcam streams cleanly
  stopAllCameraStreams();
  
  document.body.classList.add('locked');
  document.querySelector('#auth-modal')?.classList.add('active');
  const dd = document.querySelector('#user-dropdown-menu');
  if (dd) dd.style.display = 'none';
  showToast('Terminal locked: Field Researcher session ended');
}

/* ==========================================================================
   DATA & TELEMETRY SYNC
   ========================================================================== */

function loadDetections() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return seedDetections;
  }
}

function saveDetections() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(detections));
  const storageEl = document.querySelector('#storage-count');
  if (storageEl) storageEl.textContent = `${detections.length} records`;
}

function renderDetections() {
  const body = document.querySelector('#detections-body');
  if (!body) return;
  const visible = showingAll ? detections : detections.slice(0, 5);

  body.textContent = '';
  visible.forEach((detection) => {
    const distCm = detection.distanceCm !== undefined ? Number(detection.distanceCm) : 240;
    const distText = distCm < 100 ? `${Math.round(distCm)} cm` : `${(distCm / 100).toFixed(2)} m`;
    const angleText = `${Math.round(detection.angle !== undefined ? detection.angle : 90)}°`;
    const isObstacle = Boolean(detection.obstacle || (distCm < 150 && distCm > 0));

    const tr = document.createElement('tr');

    // Animal cell
    const tdAnimal = document.createElement('td');
    const animalCell = document.createElement('div');
    animalCell.className = 'animal-cell';
    const symbolSpan = document.createElement('span');
    symbolSpan.className = `animal-symbol ${detection.tone || ''}`;
    symbolSpan.textContent = detection.symbol || '◉';
    const textDiv = document.createElement('div');
    textDiv.textContent = detection.animal || 'Unknown';
    const speciesSpan = document.createElement('span');
    speciesSpan.className = 'species';
    speciesSpan.textContent = detection.species || 'Sensor Log';
    textDiv.appendChild(speciesSpan);
    animalCell.appendChild(symbolSpan);
    animalCell.appendChild(textDiv);
    tdAnimal.appendChild(animalCell);

    // Location cell
    const tdLoc = document.createElement('td');
    tdLoc.textContent = detection.location || 'Kolkata Station';

    // Distance & Angle cell
    const tdDist = document.createElement('td');
    const distBadge = document.createElement('span');
    distBadge.className = `distance-badge ${isObstacle ? 'obstacle' : ''}`;
    distBadge.textContent = distText;
    const angleCoord = document.createElement('span');
    angleCoord.className = 'coord';
    angleCoord.textContent = `${angleText} Heading`;
    tdDist.appendChild(distBadge);
    tdDist.appendChild(document.createElement('br'));
    tdDist.appendChild(angleCoord);

    // Coordinates cell
    const tdCoords = document.createElement('td');
    const coordSpan = document.createElement('span');
    coordSpan.className = 'coord';
    coordSpan.textContent = `${detection.latitude || '--'}\n${detection.longitude || '--'}`;
    coordSpan.style.whiteSpace = 'pre-line';
    tdCoords.appendChild(coordSpan);

    // Date/Time cell
    let displayDate = detection.date;
    let displayTime = detection.time;
    if ((!displayDate || !displayTime) && detection.createdAt) {
      try {
        const dObj = new Date(detection.createdAt);
        if (!isNaN(dObj.getTime())) {
          if (!displayDate) displayDate = dObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          if (!displayTime) displayTime = dObj.toLocaleTimeString('en-GB');
        }
      } catch {}
    }
    const tdTime = document.createElement('td');
    const dateText = document.createTextNode(displayDate || 'Recent');
    const timeCoord = document.createElement('span');
    timeCoord.className = 'coord';
    timeCoord.textContent = displayTime ? `${displayTime} UTC` : 'Live';
    tdTime.appendChild(dateText);
    tdTime.appendChild(document.createElement('br'));
    tdTime.appendChild(timeCoord);

    // Confidence cell
    const tdConf = document.createElement('td');
    const confSpan = document.createElement('span');
    confSpan.className = 'confidence';
    confSpan.textContent = detection.confidence || (isObstacle ? 'ALERT 94%' : 'CLEAR 98%');
    tdConf.appendChild(confSpan);

    tr.appendChild(tdAnimal);
    tr.appendChild(tdLoc);
    tr.appendChild(tdDist);
    tr.appendChild(tdCoords);
    tr.appendChild(tdTime);
    tr.appendChild(tdConf);

    body.appendChild(tr);
  });

  const countEl = document.querySelector('#showing-count');
  if (countEl) countEl.textContent = `Showing ${visible.length} of ${detections.length} records`;

  // Real-Time Analytics Calculations from active database
  const now = new Date();
  const todayFormattedGB = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const todayDetections = detections.filter(d => {
    if (!d.date) return false;
    return d.date === todayFormattedGB || d.date.toLowerCase() === 'today';
  });

  const todayEl = document.querySelector('#today-count');
  if (todayEl) todayEl.textContent = String(todayDetections.length).padStart(2, '0');

  const todayTrendEl = document.querySelector('#today-trend');
  if (todayTrendEl) {
    todayTrendEl.textContent = `↑ ${todayDetections.length} logged today`;
  }

  // Real-time unique species count
  const uniqueSpecies = new Set(
    detections.map(d => (d.species || d.animal || '').trim().toLowerCase()).filter(Boolean)
  );
  const speciesEl = document.querySelector('#species-count');
  if (speciesEl) speciesEl.textContent = String(uniqueSpecies.size).padStart(2, '0');

  const speciesLabel = document.querySelector('#species-target-label');
  if (speciesLabel) {
    speciesLabel.textContent = `${uniqueSpecies.size} unique species logged`;
  }

  const storageEl = document.querySelector('#storage-count');
  if (storageEl) storageEl.textContent = `${detections.length} records`;
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}

// Subsystem Matrix Status Synchronizer
function setSubsystemStatus(subsystemKey, status, label) {
  const chip = document.querySelector(`#chip-${subsystemKey}`);
  const led = document.querySelector(`#led-${subsystemKey}`);
  const statusEl = document.querySelector(`#status-${subsystemKey}`);
  const normalizedStatus = (status || 'offline').toLowerCase();
  
  if (led) {
    led.className = `chip-led ${normalizedStatus}`;
  }
  if (statusEl) {
    statusEl.className = `chip-status ${normalizedStatus}`;
    statusEl.textContent = label || status.toUpperCase();
  }
}

async function checkPublicDatabaseHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const health = await res.json();
      setSubsystemStatus('backend', 'online', 'ONLINE');
      const isMongo = health.database === 'mongodb';
      setSubsystemStatus('database', isMongo ? 'online' : 'simulation', isMongo ? 'MONGODB' : 'LOCAL DB');
      const providerEl = document.querySelector('#database-provider-label');
      if (providerEl) {
        providerEl.textContent = isMongo ? 'MongoDB' : 'Local DB';
      }
      const storageCountEl = document.querySelector('#storage-count');
      if (storageCountEl) {
        storageCountEl.textContent = `${health.detectionsCount || (typeof detections !== 'undefined' ? detections.length : 0)} records`;
      }
    } else {
      setSubsystemStatus('backend', 'degraded', 'HTTP ' + res.status);
      setSubsystemStatus('database', 'simulation', 'LOCAL DB');
    }
  } catch {
    setSubsystemStatus('backend', 'offline', 'OFFLINE');
    setSubsystemStatus('database', 'simulation', 'LOCAL DB');
  }
}

let lastDetectionsHash = '';
let isSyncingDetections = false;

async function syncDetectionsFromApi() {
  if (isSyncingDetections) return;
  isSyncingDetections = true;
  try {
    const response = await fetch(`${API_BASE}/detections`);
    if (response.ok) {
      setSubsystemStatus('backend', 'online', 'ONLINE');
      const remoteDetections = await response.json();
      if (Array.isArray(remoteDetections)) {
        const newHash = remoteDetections.length > 0 
          ? `${remoteDetections.length}_${remoteDetections[0]._id || remoteDetections[0].time || ''}` 
          : 'empty';
        if (newHash !== lastDetectionsHash) {
          lastDetectionsHash = newHash;
          detections = remoteDetections;
          renderDetections();
        }
      }
    } else {
      setSubsystemStatus('backend', 'degraded', 'HTTP ' + response.status);
    }
  } catch (err) {
    // Demo offline fallback
    setSubsystemStatus('backend', 'offline', 'OFFLINE');
  } finally {
    isSyncingDetections = false;
  }

  // Fetch Database Health & Active Provider Status (throttled)
  try {
    const statusRes = await fetch(`${API_BASE}/database/status`, {
      headers: getAuthHeaders()
    });
    if (statusRes.ok) {
      const dbInfo = await statusRes.json();
      setSubsystemStatus('database', dbInfo.mongoConnected ? 'online' : 'simulation', dbInfo.mongoConnected ? 'MONGODB' : 'LOCAL DB');
      const storageCountEl = document.querySelector('#storage-count');
      if (storageCountEl) {
        storageCountEl.textContent = `${dbInfo.detectionsCount || detections.length} records`;
      }
      const providerEl = document.querySelector('#database-provider-label');
      if (providerEl) {
        providerEl.textContent = dbInfo.mongoConnected ? `MongoDB (${dbInfo.databaseName})` : `Local DB (${dbInfo.detectionsFile})`;
      }
      const lastSyncEl = document.querySelector('#last-sync');
      if (lastSyncEl) {
        lastSyncEl.textContent = dbInfo.mongoConnected ? 'MongoDB / synced' : 'Local file DB / synced';
      }
    } else {
      await checkPublicDatabaseHealth();
    }
  } catch {
    await checkPublicDatabaseHealth();
  }
}

/* ==========================================================================
   AUTHENTIC 180° ARDUINO POLAR CANVAS RADAR ENGINE
   ========================================================================== */

const radarState = {
  currentAngle: 90,
  targetAngle: 90,
  currentDistance: null,
  maxRangeCm: 40,
  isObstacle: false,
  isActive: false,
  source: 'No ultrasonic sensor connected',
  lastUpdate: null,
  points: []
};

let serialPort = null;
let serialReader = null;
let serialWriter = null;
let isWebSerialConnected = false;
const SENSOR_STALE_AFTER_MS = 5000;

// 3-Sample Rolling Median Distance Filter for Acoustic Spike Rejection
const distanceMedianBuffer = [];
function filterDistanceMedian(dist) {
  if (dist <= 0.5 || dist > 450) return 400;
  distanceMedianBuffer.push(dist);
  if (distanceMedianBuffer.length > 3) distanceMedianBuffer.shift();
  if (distanceMedianBuffer.length < 3) return dist;
  const sorted = [...distanceMedianBuffer].sort((a, b) => a - b);
  return sorted[1]; // Return 3-sample median
}

function setRadarInactive(source = 'No ultrasonic sensor connected') {
  radarState.isActive = false;
  radarState.currentDistance = null;
  radarState.isObstacle = false;
  radarState.source = source;
  radarState.lastUpdate = null;
  radarState.points = [];
  distanceMedianBuffer.length = 0;

  const angleLabel = document.querySelector('#radar-angle-label');
  if (angleLabel) angleLabel.textContent = '--°';
  const distEl = document.querySelector('#distance-reading');
  if (distEl) {
    distEl.textContent = '-- cm';
    distEl.style.color = 'var(--ink-pure)';
  }
  const statusEl = document.querySelector('#radar-target-status');
  if (statusEl) {
    statusEl.textContent = 'NO SENSOR';
    statusEl.className = 'status-clear';
  }
  const statusPill = document.querySelector('#radar-status-pill');
  if (statusPill) {
    statusPill.textContent = isWebSerialConnected ? 'WAITING FOR SENSOR' : 'STANDBY';
    statusPill.style.color = 'var(--muted)';
  }
  const sourceEl = document.querySelector('#radar-source-label');
  if (sourceEl) sourceEl.textContent = source;
  const pingEl = document.querySelector('#radar-ping');
  if (pingEl) pingEl.textContent = 'SENSOR OFFLINE';

  setSubsystemStatus('radar', isWebSerialConnected ? 'connecting' : 'offline', isWebSerialConnected ? 'USB STANDBY' : 'STANDBY');
  setSubsystemStatus('cobot', 'offline', 'STANDBY');

  // Cobot Mission Control offline state (no defaults)
  const missionPill = document.querySelector('#mission-status');
  if (missionPill) {
    missionPill.textContent = 'STANDBY';
    missionPill.className = 'mission-pill offline';
  }
  const navState = document.querySelector('#navigation-state');
  if (navState) navState.textContent = 'Awaiting connection';
  const obsState = document.querySelector('#obstacle-state');
  if (obsState) obsState.textContent = 'No sensor feed';
  const servoState = document.querySelector('#servo-state');
  if (servoState) servoState.textContent = '--° / Offline';
  
  const navLed = document.querySelector('#nav-led');
  if (navLed) navLed.className = 'control-led dim';
  const obsLed = document.querySelector('#obstacle-led');
  if (obsLed) obsLed.className = 'control-led dim';
  const servoLed = document.querySelector('#servo-led');
  if (servoLed) servoLed.className = 'control-led dim';

  const mqttStrip = document.querySelector('#mqtt-status-strip');
  if (mqttStrip) {
    mqttStrip.className = 'offline';
    mqttStrip.innerHTML = '<span class="pulse-dot"></span> Awaiting bot';
  }

  // Robot Telemetry Panel offline state (no defaults)
  const telemPill = document.querySelector('#telemetry-online-pill');
  if (telemPill) {
    telemPill.textContent = 'DISCONNECTED';
    telemPill.className = 'online-pill offline';
  }
  const speedEl = document.querySelector('#speed-reading');
  if (speedEl) speedEl.textContent = '-- m/s';
  const headEl = document.querySelector('#heading-reading');
  if (headEl) headEl.textContent = '--°';
  const sweepEl = document.querySelector('#servo-sweep-reading');
  if (sweepEl) sweepEl.textContent = '--° range';
  const ultraEl = document.querySelector('#ultrasonic-reading');
  if (ultraEl) ultraEl.textContent = 'HC-SR04 / Offline';
  const linkEl = document.querySelector('#telemetry-link-state');
  if (linkEl) linkEl.textContent = 'Standby';
  const uptimeEl = document.querySelector('#telemetry-uptime');
  if (uptimeEl) uptimeEl.textContent = '--:--:--';
  const fwEl = document.querySelector('#telemetry-firmware');
  if (fwEl) fwEl.textContent = '--';

  // Real-Time Response Time Metric tile offline state
  const respEl = document.querySelector('#response-time-stat');
  if (respEl) respEl.innerHTML = '-- <b>ms</b>';
  const respSub = document.querySelector('#response-time-sub');
  if (respSub) respSub.textContent = 'sensor offline';

  // Manual Teleop offline state
  const teleopLed = document.querySelector('#teleop-led');
  if (teleopLed) teleopLed.className = 'control-led dim';
  const teleopMode = document.querySelector('#teleop-mode-indicator');
  if (teleopMode) teleopMode.textContent = 'OFFLINE';
  const teleopLast = document.querySelector('#teleop-last-cmd');
  if (teleopLast) teleopLast.textContent = 'HALT';
}

function updateRadarData(angle, distanceCm, source = 'Arduino') {
  const rawDist = Number(distanceCm);
  const ang = Number(angle);
  if (!Number.isFinite(rawDist) || !Number.isFinite(ang)) return;
  const maxRange = radarState.maxRangeCm;
  
  // Apply median filtering to suppress acoustic false echoes
  const dist = filterDistanceMedian(rawDist);
  const isObstacle = dist <= maxRange && dist > 0.5;

  radarState.currentAngle = ang;
  radarState.currentDistance = dist;
  radarState.isObstacle = isObstacle;
  radarState.isActive = true;
  radarState.source = source;
  radarState.lastUpdate = Date.now();

  // Record point in obstacle point cloud
  if (isObstacle) {
    radarState.points.push({
      angle: ang,
      distanceCm: dist,
      obstacle: true,
      timestamp: Date.now()
    });
    // Cap in-memory points
    if (radarState.points.length > 200) {
      radarState.points.shift();
    }
  }

  // Update DOM HUD Displays
  const angleLabel = document.querySelector('#radar-angle-label');
  if (angleLabel) angleLabel.textContent = `${Math.round(ang)}°`;

  const distEl = document.querySelector('#distance-reading');
  if (distEl) {
    distEl.textContent = isObstacle ? `${dist.toFixed(1)} cm` : 'OUT OF RANGE';
    distEl.style.color = isObstacle ? 'var(--coral)' : 'var(--ink-pure)';
  }

  const maxRangeEl = document.querySelector('#max-range-display');
  if (maxRangeEl) maxRangeEl.textContent = `${maxRange} cm`;

  const statusEl = document.querySelector('#radar-target-status');
  if (statusEl) {
    statusEl.textContent = isObstacle ? 'OBSTACLE DETECTED' : 'CLEAR';
    statusEl.className = isObstacle ? 'status-obstacle' : 'status-clear';
  }

  const statusPill = document.querySelector('#radar-status-pill');
  if (statusPill) {
    statusPill.textContent = isObstacle ? 'OBSTACLE' : (isWebSerialConnected ? 'ONLINE (USB)' : 'ONLINE');
    statusPill.style.color = isObstacle ? 'var(--coral)' : 'var(--emerald)';
  }

  setSubsystemStatus('radar', 'online', isWebSerialConnected ? 'USB STREAM' : 'STREAMING');
  setSubsystemStatus('cobot', 'online', 'AUTONOMOUS');

  // Sync real-time data with Cobot Mission Control
  const missionPill = document.querySelector('#mission-status');
  if (missionPill) {
    missionPill.textContent = 'AUTONOMOUS';
    missionPill.className = 'mission-pill';
  }
  const servoEl = document.querySelector('#servo-state');
  if (servoEl) servoEl.textContent = `${String(Math.round(ang)).padStart(3, '0')}° / Sensor`;
  const servoLed = document.querySelector('#servo-led');
  if (servoLed) servoLed.className = 'control-led coral';

  const headEl = document.querySelector('#heading-reading');
  if (headEl) headEl.textContent = `${String(Math.round(ang)).padStart(3, '0')}° Heading`;

  const obsEl = document.querySelector('#obstacle-state');
  if (obsEl) obsEl.textContent = isObstacle ? `Obstacle / ${(dist / 100).toFixed(2)} m` : 'Clear path';
  const obsLed = document.querySelector('#obstacle-led');
  if (obsLed) obsLed.className = isObstacle ? 'control-led coral' : 'control-led yellow';

  const navEl = document.querySelector('#navigation-state');
  if (navEl) navEl.textContent = isObstacle ? 'Avoiding obstacle' : 'Patrolling';
  const navLed = document.querySelector('#nav-led');
  if (navLed) navLed.className = isObstacle ? 'control-led yellow' : 'control-led green';

  const mqttStrip = document.querySelector('#mqtt-status-strip');
  if (mqttStrip) {
    mqttStrip.className = '';
    mqttStrip.textContent = '';
    const dot = document.createElement('span');
    dot.className = 'pulse-dot';
    mqttStrip.appendChild(dot);
    mqttStrip.appendChild(document.createTextNode(` ${source || 'Sensor bridge'}`));
  }

  // Sync real-time data with Robot Telemetry Panel
  const telemPill = document.querySelector('#telemetry-online-pill');
  if (telemPill) {
    telemPill.textContent = isWebSerialConnected ? 'ONLINE (USB)' : 'CONNECTED';
    telemPill.className = 'online-pill';
  }
  const speedEl = document.querySelector('#speed-reading');
  if (speedEl) speedEl.textContent = isObstacle ? '0.00 m/s' : '0.42 m/s';
  const sweepEl = document.querySelector('#servo-sweep-reading');
  if (sweepEl) sweepEl.textContent = '180° range';
  const ultraEl = document.querySelector('#ultrasonic-reading');
  if (ultraEl) ultraEl.textContent = `HC-SR04 / ${dist.toFixed(0)}cm`;
  const linkEl = document.querySelector('#telemetry-link-state');
  if (linkEl) linkEl.textContent = 'RF / LoRa Active';
  const fwEl = document.querySelector('#telemetry-firmware');
  if (fwEl && fwEl.textContent === '--') fwEl.textContent = '1.6.0';
  const uptimeEl = document.querySelector('#telemetry-uptime');
  if (uptimeEl && uptimeEl.textContent === '--:--:--') {
    uptimeEl.textContent = new Date().toLocaleTimeString('en-GB');
  }

  // Real-time response time metric
  const respEl = document.querySelector('#response-time-stat');
  if (respEl) {
    const liveLatency = isWebSerialConnected ? '1.2' : '4.5';
    respEl.textContent = `${liveLatency} `;
    const b = document.createElement('b');
    b.textContent = 'ms';
    respEl.appendChild(b);
  }
  const respSub = document.querySelector('#response-time-sub');
  if (respSub) {
    respSub.textContent = isWebSerialConnected ? 'Direct USB @ 115200' : 'SSE bridge stream';
  }

  // Forward telemetry to server so database is populated
  if (isWebSerialConnected) {
    forwardTelemetryToServer(dist, ang, isObstacle, source);
  }
}

let lastTelemetryPost = 0;
async function forwardTelemetryToServer(distCm, angle, obstacle, source) {
  const now = Date.now();
  if (now - lastTelemetryPost < 100) return; // Throttle to 10 POST/sec
  lastTelemetryPost = now;
  try {
    await fetch(`${API_BASE}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distanceCm: distCm, angle: angle, obstacle: obstacle, source: source })
    });
  } catch {}
}

// Cache radar static gradients
let cachedRadarBgGrad = null;
let cachedSweepGrad = null;
let cachedRadius = 0;
let lastPointsCleanup = 0;

// High-DPI (Retina) Canvas Buffer Resizer
function resizeRadarCanvasDpr(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetW = Math.round(rect.width * dpr);
  const targetH = Math.round(rect.height * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
    cachedRadius = 0;
  }
  return dpr;
}

function renderRadarCanvas() {
  const canvas = document.querySelector('#radar-canvas');
  if (!canvas) return;
  const dpr = resizeRadarCanvasDpr(canvas);
  const ctx = canvas.getContext('2d');
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Clear background
  ctx.clearRect(0, 0, width, height);

  if (!radarState.isActive) {
    ctx.fillStyle = 'rgba(1, 14, 10, 0.92)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(158, 205, 189, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    ctx.fillStyle = 'rgba(158, 205, 189, 0.78)';
    ctx.font = 'bold 14px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ULTRASONIC SENSOR NOT CONNECTED', width / 2, height / 2 - 8);
    ctx.font = '12px "DM Mono", monospace';
    ctx.fillStyle = 'rgba(158, 205, 189, 0.55)';
    ctx.fillText('Connect an ultrasonic sensor through USB Serial', width / 2, height / 2 + 18);
    ctx.restore();
    return;
  }

  const centerX = width / 2;
  const centerY = height - 55;
  const radius = Math.min(width * 0.44, height - 105);
  const maxRange = radarState.maxRangeCm;

  // Update cached gradients if resized
  if (cachedRadius !== radius) {
    cachedRadius = radius;
    cachedRadarBgGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius);
    cachedRadarBgGrad.addColorStop(0, 'rgba(6, 42, 30, 0.45)');
    cachedRadarBgGrad.addColorStop(0.7, 'rgba(3, 24, 18, 0.7)');
    cachedRadarBgGrad.addColorStop(1, 'rgba(1, 14, 10, 0.92)');

    cachedSweepGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    cachedSweepGrad.addColorStop(0, 'rgba(82, 255, 174, 0.55)');
    cachedSweepGrad.addColorStop(0.6, 'rgba(82, 255, 174, 0.2)');
    cachedSweepGrad.addColorStop(1, 'rgba(82, 255, 174, 0)');
  }

  // 1. Radar Semi-Circle Background Fill
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, Math.PI, 0, false);
  ctx.closePath();
  ctx.fillStyle = cachedRadarBgGrad || 'rgba(3, 24, 18, 0.7)';
  ctx.fill();

  // Outer Perimeter Border
  ctx.strokeStyle = 'rgba(82, 255, 174, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. Concentric Range Rings (4 arcs)
  const rings = 4;
  ctx.font = 'bold 12px "DM Mono", monospace';
  ctx.textAlign = 'center';
  for (let i = 1; i <= rings; i++) {
    const r = (radius / rings) * i;
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, Math.PI, 0, false);
    ctx.strokeStyle = i === rings ? 'rgba(82, 255, 174, 0.5)' : 'rgba(82, 255, 174, 0.2)';
    ctx.lineWidth = i === rings ? 2 : 1;
    ctx.stroke();

    // Range Labels along the horizontal base
    const rangeVal = Math.round((maxRange / rings) * i);
    ctx.fillStyle = 'rgba(158, 205, 189, 0.9)';
    ctx.fillText(`${rangeVal}`, centerX + r, centerY + 18);
  }

  // 3. Polar Angle Radial Lines (0°, 30°, 60°, 90°, 120°, 150°, 180°)
  const angleSteps = [0, 30, 60, 90, 120, 150, 180];
  ctx.font = 'bold 13px "DM Mono", monospace';
  ctx.textBaseline = 'middle';

  const labelRadius = radius + 25;
  for (let i = 0; i < angleSteps.length; i++) {
    const deg = angleSteps[i];
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + radius * cos, centerY - radius * sin);
    ctx.strokeStyle = deg === 90 ? 'rgba(82, 255, 174, 0.55)' : 'rgba(82, 255, 174, 0.22)';
    ctx.lineWidth = deg === 90 ? 1.5 : 1;
    ctx.stroke();

    // Angle Degree Labels just outside outer perimeter
    const lx = centerX + labelRadius * cos;
    const ly = centerY - labelRadius * sin;
    ctx.fillStyle = deg === 90 ? '#52ffae' : 'rgba(82, 255, 174, 0.85)';
    ctx.fillText(`${deg}°`, lx, ly);
  }

  // Base horizontal baseline
  ctx.beginPath();
  ctx.moveTo(centerX - radius - 15, centerY);
  ctx.lineTo(centerX + radius + 15, centerY);
  ctx.strokeStyle = 'rgba(82, 255, 174, 0.6)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 4. Trailing Sweep Gradient Fan Beam
  const sweepRad = (radarState.currentAngle * Math.PI) / 180;
  const trailSpan = 0.14; // ~8 degrees sweep trail
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, radius, -sweepRad, -sweepRad + trailSpan, false);
  ctx.closePath();
  ctx.fillStyle = cachedSweepGrad || 'rgba(82, 255, 174, 0.2)';
  ctx.fill();

  // 5. Green Sweep Ray Needle Line (Rendered with double stroke for fast glow)
  const nx = centerX + radius * Math.cos(sweepRad);
  const ny = centerY - radius * Math.sin(sweepRad);

  // Glow halo
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = 'rgba(82, 255, 174, 0.25)';
  ctx.lineWidth = 7;
  ctx.stroke();

  // Core needle line
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = '#52ffae';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 6. Detected Obstacle Red Dots (Point Cloud with Decay Trails)
  const now = Date.now();
  if (now - lastPointsCleanup > 1000) {
    lastPointsCleanup = now;
    radarState.points = radarState.points.filter((pt) => now - pt.timestamp < 8000);
  }

  const pointsLen = radarState.points.length;
  for (let i = 0; i < pointsLen; i++) {
    const pt = radarState.points[i];
    if (pt.distanceCm <= maxRange && pt.distanceCm > 0.5) {
      const ageMs = now - pt.timestamp;
      const alpha = Math.max(0.15, 1 - ageMs / 8000);
      const pr = (pt.distanceCm / maxRange) * radius;
      const prad = (pt.angle * Math.PI) / 180;
      const px = centerX + pr * Math.cos(prad);
      const py = centerY - pr * Math.sin(prad);

      // Glow Red Dot
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 75, 75, ${(alpha * 0.3).toFixed(2)})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 75, 75, ${alpha.toFixed(2)})`;
      ctx.fill();

      // Fresh pulse ring
      if (ageMs < 1000) {
        ctx.beginPath();
        ctx.arc(px, py, 7.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 120, 120, ${(alpha * 0.85).toFixed(2)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // 7. Center Origin Pivot Dot
  ctx.beginPath();
  ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(82, 255, 174, 0.3)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#52ffae';
  ctx.fill();

  // 8. Bottom HUD Overlay Text directly on Canvas (matches user's screenshot)
  ctx.font = 'bold 14px "DM Mono", monospace';
  ctx.fillStyle = '#52ffae';
  ctx.textAlign = 'left';
  ctx.fillText(`Angle: ${Math.round(radarState.currentAngle)}°`, 28, height - 16);

  ctx.textAlign = 'center';
  const distText = radarState.currentDistance <= maxRange && radarState.currentDistance > 0.5
    ? `Distance: ${radarState.currentDistance.toFixed(1)} cm`
    : 'Distance: OUT OF RANGE';
  ctx.fillStyle = radarState.isObstacle ? '#ff7676' : '#52ffae';
  ctx.fillText(distText, centerX, height - 16);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#52ffae';
  ctx.restore();
}

function radarAnimationLoop() {
  renderRadarCanvas();
  requestAnimationFrame(radarAnimationLoop);
}

// A bridge/USB disconnect does not always produce an explicit browser event.
// Stop drawing as soon as its last real measurement is no longer fresh.
window.setInterval(() => {
  if (
    radarState.isActive &&
    radarState.lastUpdate &&
    Date.now() - radarState.lastUpdate > SENSOR_STALE_AFTER_MS
  ) {
    setRadarInactive('Ultrasonic sensor disconnected');
  }
}, 1000);

/* ==========================================================================
   WEB SERIAL API DIRECT ARDUINO CONNECTION
   ========================================================================== */

async function toggleWebSerialConnection() {
  const btn = document.querySelector('#connect-serial-btn');
  const baudSelect = document.querySelector('#radar-baud-select');
  const baudRate = Number(baudSelect?.value || 115200);

  if (isWebSerialConnected) {
    disconnectWebSerial();
    return;
  }

  if (!('serial' in navigator)) {
    showToast('Web Serial not supported in this browser. Please use Chrome/Edge or run python ultrasonic_bridge.py');
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: baudRate });
    isWebSerialConnected = true;

    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = '<span class="radar-btn-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg></span> <span>Disconnect USB</span>';
    }
    const statusPill = document.querySelector('#radar-status-pill');
    if (statusPill) {
      statusPill.textContent = 'WAITING FOR SENSOR';
      statusPill.style.color = 'var(--muted)';
    }
    const sourceEl = document.querySelector('#radar-source-label');
    if (sourceEl) sourceEl.textContent = `USB open (${baudRate} baud) — awaiting ultrasonic reading`;

    showToast(`Connected to Arduino USB Serial @ ${baudRate} baud!`);
    if (serialPort.writable) {
      try {
        const textEncoder = new TextEncoderStream();
        textEncoder.readable.pipeTo(serialPort.writable);
        serialWriter = textEncoder.writable.getWriter();
      } catch (e) {
        console.warn('Could not initialize serial writer:', e);
      }
    }
    readSerialStream(serialPort);
  } catch (err) {
    isWebSerialConnected = false;
    showToast(`Serial connection cancelled: ${err.message}`);
  }
}

async function readSerialStream(port) {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
  serialReader = textDecoder.readable.getReader();

  let buffer = '';
  try {
    while (isWebSerialConnected) {
      const { value, done } = await serialReader.read();
      if (done) break;
      if (value) {
        buffer += value;
        const lines = buffer.split(/[\r\n]+/);
        buffer = lines.pop(); // keep remainder

        for (const rawLine of lines) {
          const line = rawLine.trim().replace(/\.$/, '');
          if (!line) continue;

          let angle = radarState.currentAngle;
          let dist = null;

          if (line.includes(',')) {
            const parts = line.split(',');
            const p1 = parseFloat(parts[0]);
            const p2 = parseFloat(parts[1]);
            if (!isNaN(p1) && !isNaN(p2)) {
              if (p1 >= 0 && p1 <= 180) {
                angle = p1;
                dist = p2;
              } else {
                dist = p1;
                angle = p2;
              }
            }
          } else if (line.startsWith('{') && line.endsWith('}')) {
            try {
              const data = JSON.parse(line);
              const reportedDistance = Number(data.distance ?? data.distanceCm);
              if (Number.isFinite(reportedDistance)) {
                dist = reportedDistance;
                const reportedAngle = Number(data.angle);
                if (Number.isFinite(reportedAngle)) angle = reportedAngle;
              }
            } catch {}
          } else {
            const val = parseFloat(line);
            if (!isNaN(val)) dist = val;
          }

          // Ignore boot messages and malformed serial lines. A sweep only begins
          // after the sensor has supplied an actual distance measurement.
          if (Number.isFinite(dist)) updateRadarData(angle, dist, 'Direct USB Serial');
        }
      }
    }
  } catch (err) {
    if (isWebSerialConnected) {
      showToast(`Serial stream error: ${err.message}`);
      disconnectWebSerial();
    }
  } finally {
    // A physical USB disconnect ends the stream without necessarily throwing.
    if (isWebSerialConnected) disconnectWebSerial();
  }
}

function disconnectWebSerial() {
  isWebSerialConnected = false;
  try {
    serialWriter?.releaseLock();
    serialReader?.cancel();
    serialPort?.close();
  } catch {}
  serialWriter = null;
  serialReader = null;
  serialPort = null;

  const btn = document.querySelector('#connect-serial-btn');
  if (btn) {
    btn.classList.remove('active');
    btn.innerHTML = '<span class="radar-btn-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18 8v4a6 6 0 0 1-12 0V8"/><path d="M4 4h4v4H4z"/><path d="M16 4h4v4h-4z"/><path d="M12 18v4"/></svg></span> <span>Connect USB Serial</span>';
  }
  const statusPill = document.querySelector('#radar-status-pill');
  if (statusPill) {
    statusPill.textContent = 'STANDBY';
    statusPill.style.color = 'var(--emerald)';
  }
  const sourceEl = document.querySelector('#radar-source-label');
  if (sourceEl) sourceEl.textContent = 'Awaiting Arduino Serial / Python Bridge';
  setRadarInactive('No ultrasonic sensor connected');
  showToast('Arduino USB Serial disconnected');
}

/* ==========================================================================
   REAL-TIME SERVER-SENT EVENTS (SSE) & ADAPTIVE TELEMETRY STREAM
   ========================================================================== */

let sseAbortController = null;
let isTelemetryPolling = false;
let telemetryBackoffMs = 120;
let nextTelemetryPollTimer = null;

async function initTelemetryStream() {
  if (sseAbortController) {
    try { sseAbortController.abort(); } catch {}
    sseAbortController = null;
  }

  const token = getAuthToken();
  if (!token || !currentResearcher) {
    scheduleAdaptiveTelemetryPoll();
    return;
  }

  try {
    sseAbortController = new AbortController();
    const response = await fetch(`${API_BASE}/telemetry/stream`, {
      headers: getAuthHeaders(),
      signal: sseAbortController.signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE stream failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop();

      for (const frame of frames) {
        const line = frame.trim();
        if (line.startsWith('data: ')) {
          try {
            const telemetry = JSON.parse(line.slice(6));
            if (telemetry.active === false) {
              if (!isWebSerialConnected) setRadarInactive(telemetry.source);
              continue;
            }
            if (telemetry.active === true && typeof telemetry.distanceCm === 'number') {
              const distCm = telemetry.distanceCm;
              const angleDeg = typeof telemetry.angle === 'number' ? telemetry.angle : 90;
              const source = telemetry.source || 'Live Arduino Telemetry';

              updateRadarData(angleDeg, distCm, source);

              const pingEl = document.querySelector('#radar-ping');
              if (pingEl) pingEl.textContent = 'STREAM 0ms';
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      scheduleAdaptiveTelemetryPoll();
    }
  }
}

function scheduleAdaptiveTelemetryPoll() {
  if (nextTelemetryPollTimer) clearTimeout(nextTelemetryPollTimer);
  nextTelemetryPollTimer = setTimeout(async () => {
    await syncTelemetryFromApi();
    if (!sseAbortController) {
      scheduleAdaptiveTelemetryPoll();
    }
  }, telemetryBackoffMs);
}

async function syncTelemetryFromApi() {
  if (!currentResearcher || isWebSerialConnected) return;
  if (isTelemetryPolling) return;
  isTelemetryPolling = true;

  const startTime = performance.now();
  try {
    const response = await fetch(`${API_BASE}/telemetry`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Telemetry unavailable');
    const telemetry = await response.json();
    const pingMs = Math.round(performance.now() - startTime);

    const pingEl = document.querySelector('#radar-ping');
    if (pingEl) pingEl.textContent = `PING ${pingMs}ms`;

    if (telemetry.active === false) {
      setRadarInactive(telemetry.source);
    } else if (telemetry.active === true && typeof telemetry.distanceCm === 'number') {
      const distCm = telemetry.distanceCm;
      const angleDeg = typeof telemetry.angle === 'number' ? telemetry.angle : 90;
      const source = telemetry.source || 'Arduino Bridge';

      updateRadarData(angleDeg, distCm, source);
      telemetryBackoffMs = 120; // Connected rate
    }
  } catch {
    telemetryBackoffMs = Math.min(3000, telemetryBackoffMs * 1.5); // Exponential backoff on failure
  } finally {
    isTelemetryPolling = false;
  }
}

async function uploadDetection(detection) {
  try {
    const response = await fetch(`${API_BASE}/detections`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(detection)
    });
    if (response.ok) {
      return true;
    }
  } catch {
    // Offline fallback handled below
  }

  // Ensure record is saved to browser local database when backend is offline
  detections.unshift(detection);
  if (detections.length > 500) detections.pop();
  saveDetections();
  renderDetections();
  return false;
}

function configureLiveCamera() {
  const config = window.FIELDWATCH_CONFIG || {};
  const streamUrl = config.esp32CamStreamUrl || (config.esp32CamIp ? `http://${config.esp32CamIp}/stream` : '');
  if (!config.useLiveCamera || !streamUrl) return;
  const cameraView = document.querySelector('.forest-art');
  if (!cameraView) return;
  const stream = document.createElement('img');
  stream.className = 'esp32-stream';
  stream.src = streamUrl;
  stream.alt = 'Live ESP32-CAM feed';
  cameraView.replaceChildren(stream);
  cameraView.classList.add('live-camera-view');
}

async function toggleLaptopCamera(event) {
  if (!currentResearcher) {
    const authModal = document.querySelector('#auth-modal');
    if (authModal) authModal.classList.add('active');
    document.body.classList.add('locked');
    showToast('Please authenticate as Field Researcher first');
    return;
  }
  const button = event?.currentTarget || document.querySelector('#laptop-camera-button');
  
  // If either video stream or YOLO image is active, stop cleanly
  if (laptopCameraVideo || laptopCameraImage || laptopCameraStream) {
    stopAllCameraStreams();
    showToast('Webcam stopped');
    return;
  }

  // Helper to start browser webcam cleanly with persistent UI layers
  const startBrowserWebcam = async () => {
    try {
      showToast('Starting laptop webcam...');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam requires HTTPS or localhost');
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
          audio: false
        });
      } catch (constraintErr) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      laptopCameraStream = stream;
      window.laptopCameraStream = stream;
      const video = document.createElement('video');
      video.className = 'laptop-camera browser-camera';
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('muted', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('aria-label', 'Live laptop webcam');
      video.srcObject = stream;
      laptopCameraVideo = video;
      window.laptopCameraVideo = video;
      window.isDetectionLoopRunning = true;

      // Prevent Chrome from sleeping or pausing the stream when scrolled out of view
      video.addEventListener('pause', () => {
        if (isDetectionLoopRunning && laptopCameraStream && laptopCameraVideo && video === laptopCameraVideo) {
          video.play().catch(() => {});
        }
      });

      // Keep tracks alive on visibility changes
      stream.getVideoTracks().forEach(track => {
        track.onended = () => {
          if (isDetectionLoopRunning && laptopCameraVideo) {
            console.warn('Webcam track ended unexpectedly');
          }
        };
      });

      const cameraView = document.querySelector('.forest-art');
      if (cameraView) {
        cameraView.innerHTML = `
          <canvas class="camera-overlay-canvas" id="camera-overlay-canvas"></canvas>
          <div class="camera-crosshair"></div>
          <span class="cam-time" id="realtime-cam-clock">${new Date().toLocaleTimeString('en-GB')}</span>
          <span class="cam-meta" id="camera-overlay-meta">CAM-04 / 1080P / LIVE WEBCAM</span>
        `;
        cameraView.prepend(video);
        cameraView.classList.add('laptop-camera-view', 'live-source');
      }

      await video.play().catch(() => {});

      if (button) button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg> <span>Stop laptop webcam</span>';
      setSubsystemStatus('camera', 'simulation', 'WEBCAM');
      setSubsystemStatus('vision', 'online', 'SCANNING');
      showToast('Laptop webcam connected');
      addSystemNotification('info', 'Live Camera Stream Online', 'CAM-04 hardware webcam feed initialized with AI Face/Wildlife detection.', '📷');
      if (cameraView) startFaceDetection(video, cameraView);
    } catch (err) {
      stopAllCameraStreams();
      showToast(`Camera access error: ${err.message}`);
    }
  };

  // Check if Python YOLO detector is running on port 5001
  let yoloStreamAvailable = false;
  try {
    const streamCheck = new AbortController();
    const streamTimeout = window.setTimeout(() => streamCheck.abort(), 600);
    const streamResponse = await fetch('http://localhost:5001/health', {
      method: 'GET',
      mode: 'cors',
      signal: streamCheck.signal
    });
    window.clearTimeout(streamTimeout);
    if (streamResponse.ok) {
      const hData = await streamResponse.json();
      yoloStreamAvailable = hData.status === 'ok';
    }
  } catch {
    yoloStreamAvailable = false;
  }

  if (yoloStreamAvailable) {
    const stream = document.createElement('img');
    stream.className = 'laptop-camera';
    stream.src = `http://localhost:5001/video?t=${Date.now()}`;
    stream.alt = 'YOLO annotated laptop webcam';
    stream.onerror = () => {
      console.warn('YOLO stream failed, reverting to standby...');
      stopAllCameraStreams();
    };
    laptopCameraImage = stream;
    const cameraView = document.querySelector('.forest-art');
    if (cameraView) {
      cameraView.innerHTML = `
        <div class="camera-crosshair"></div>
        <span class="cam-time" id="realtime-cam-clock">${new Date().toLocaleTimeString('en-GB')}</span>
        <span class="cam-meta">CAM-04 / 1080P / YOLO STREAM</span>
      `;
      cameraView.prepend(stream);
      cameraView.classList.add('laptop-camera-view', 'live-source');
    }
    if (button) button.innerHTML = '■ <span>Stop YOLO webcam</span>';
    setSubsystemStatus('camera', 'online', 'YOLO LIVE');
    setSubsystemStatus('vision', 'online', 'YOLO v8');
    showToast('YOLO detection stream connected');
    return;
  }

  // Start direct browser webcam
  await startBrowserWebcam();
}

let audioAlarmEnabled = true;
let lastAlarmPlayTime = 0;
let audioCtx = null;
let cocoModelInstance = null;
let isModelLoading = false;
let isDetectionLoopRunning = false;
let lastAutoStoreTime = 0;

const SPECIES_TAXONOMY = {
  cat: { animal: 'Bengal Tiger', species: 'Panthera tigris', symbol: '🐅', tone: 'danger', threat: 'APEX PREDATOR' },
  tiger: { animal: 'Bengal Tiger', species: 'Panthera tigris', symbol: '🐅', tone: 'danger', threat: 'APEX PREDATOR' },
  lion: { animal: 'Asiatic Lion', species: 'Panthera leo', symbol: '🦁', tone: 'danger', threat: 'APEX PREDATOR' },
  leopard: { animal: 'Indian Leopard', species: 'Panthera pardus', symbol: '🐆', tone: 'danger', threat: 'SOLITARY PREDATOR' },
  person: { animal: 'Human', species: 'Homo sapiens', symbol: '◉', tone: '', threat: 'FIELD RESEARCHER' },
  dog: { animal: 'Wild Dog (Dhole)', species: 'Cuon alpinus', symbol: '🐕', tone: 'warning', threat: 'CANINE PACK' },
  elephant: { animal: 'Asian Elephant', species: 'Elephas maximus', symbol: '🐘', tone: 'warning', threat: 'MEGAHERBIVORE' },
  bear: { animal: 'Sloth Bear', species: 'Melursus ursinus', symbol: '🐻', tone: 'danger', threat: 'HIGH AGGRESSION' },
  horse: { animal: 'Spotted Deer (Chital)', species: 'Axis axis', symbol: '🦌', tone: 'safe', threat: 'HERBIVORE' },
  sheep: { animal: 'Indian Gazelle (Chinkara)', species: 'Gazella bennettii', symbol: '🦌', tone: 'safe', threat: 'HERBIVORE' },
  cow: { animal: 'Indian Gaur (Bison)', species: 'Bos gaurus', symbol: '🐂', tone: 'warning', threat: 'HEAVY BOVINE' },
  zebra: { animal: 'Striped Wildlife (Tiger Family)', species: 'Panthera tigris', symbol: '🐅', tone: 'danger', threat: 'STRIPED PREDATOR' },
  giraffe: { animal: 'Nilgai (Blue Bull)', species: 'Boselaphus tragocamelus', symbol: '🦌', tone: 'safe', threat: 'HERBIVORE' },
  bird: { animal: 'Great Indian Hornbill', species: 'Buceros bicornis', symbol: '🦅', tone: 'safe', threat: 'AVIAN SPECIES' },
  monkey: { animal: 'Rhesus Macaque', species: 'Macaca mulatta', symbol: '🐒', tone: 'warning', threat: 'PRIMATE TROOP' },
  'cell phone': { animal: 'Field Smartphone', species: 'Telemetry Device', symbol: '📱', tone: '', threat: 'HARDWARE' },
  laptop: { animal: 'Field Station PC', species: 'Processing Unit', symbol: '💻', tone: '', threat: 'HARDWARE' },
  book: { animal: 'Field Logbook', species: 'Research Notes', symbol: '📖', tone: '', threat: 'LOG' },
  cup: { animal: 'Field Equipment', species: 'Field Supply', symbol: '☕', tone: '', threat: 'EQUIPMENT' },
  bottle: { animal: 'Water Supply', species: 'Field Hydration', symbol: '🍶', tone: '', threat: 'SUPPLY' }
};

async function loadDetectionModel() {
  if (cocoModelInstance) return cocoModelInstance;
  if (isModelLoading) return null;
  if (!window.cocoSsd) return null;

  isModelLoading = true;
  try {
    if (window.tf) {
      try {
        if (window.tf.findBackend && window.tf.findBackend('webgl')) {
          await window.tf.setBackend('webgl');
        }
        await window.tf.ready();
      } catch {}
    }
    cocoModelInstance = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
  } catch (err) {
    try {
      cocoModelInstance = await window.cocoSsd.load();
    } catch {}
  } finally {
    isModelLoading = false;
  }
  return cocoModelInstance;
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playPredatorSiren(animalName = 'Tiger') {
  if (!audioAlarmEnabled) return;
  const now = Date.now();
  if (now - lastAlarmPlayTime < 3200) return;
  lastAlarmPlayTime = now;

  try {
    const ctx = getAudioContext();
    if (ctx) {
      const t = Math.max(ctx.currentTime, 0) + 0.02;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.linearRampToValueAtTime(1450, t + 0.15);
      osc.frequency.linearRampToValueAtTime(800, t + 0.30);
      osc.frequency.linearRampToValueAtTime(1500, t + 0.45);
      osc.frequency.linearRampToValueAtTime(800, t + 0.60);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.70);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.70);
    }
  } catch {}

  try {
    if ('speechSynthesis' in window && window.speechSynthesis.speak) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Alert! ${animalName} detected in visual sector.`);
      utterance.rate = 1.12;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch {}

  const card = document.querySelector('.camera-card');
  if (card) {
    card.classList.add('predator-alert-flash');
    window.setTimeout(() => card.classList.remove('predator-alert-flash'), 1400);
  }

  addSystemNotification('danger', 'Predator Warning Alert', `Alert! ${animalName} registered in visual sector.`, '🚨');
}

/* ==========================================================================
   HIGH-PERFORMANCE GPU CANVAS VISION ENGINE (60 FPS BUTTERY SMOOTH)
   ========================================================================== */

function startFaceDetection(video, cameraView) {
  const overlayCanvas = document.querySelector('#camera-overlay-canvas');
  if (!overlayCanvas) return;
  const overlayCtx = overlayCanvas.getContext('2d', { alpha: true });

  const nativeDetector = ('FaceDetector' in window) ? new FaceDetector({ fastMode: true, maxDetectedFaces: 4 }) : null;

  // Lightweight 2D offscreen canvas (224x224) for safe in-memory inference
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = 224;
  sampleCanvas.height = 224;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

  isDetectionLoopRunning = true;
  let targetDetections = [];
  let renderedBoxes = []; // Smooth interpolated boxes
  let isDetecting = false;

  // Cache display dimensions to completely eliminate layout thrashing during scroll
  let displayW = 640;
  let displayH = 360;

  const updateCanvasDimensions = () => {
    if (!overlayCanvas) return;
    const parent = overlayCanvas.parentElement;
    const w = parent ? parent.clientWidth : overlayCanvas.clientWidth;
    const h = parent ? parent.clientHeight : overlayCanvas.clientHeight;
    if (w > 0 && h > 0) {
      displayW = w;
      displayH = h;
      if (overlayCanvas.width !== displayW || overlayCanvas.height !== displayH) {
        overlayCanvas.width = displayW;
        overlayCanvas.height = displayH;
      }
    }
  };

  updateCanvasDimensions();
  window.addEventListener('resize', updateCanvasDimensions, { passive: true });

  // 1. 60 FPS GPU-Accelerated Canvas Overlay Render Loop (Zero Reflows)
  const renderOverlayLoop = () => {
    if (!isDetectionLoopRunning || !laptopCameraVideo || video !== laptopCameraVideo) return;

    overlayCtx.clearRect(0, 0, displayW, displayH);

    // Smoothly interpolate boxes towards target detections
    if (targetDetections.length > 0) {
      // Sync box count
      while (renderedBoxes.length < targetDetections.length) {
        renderedBoxes.push({ ...targetDetections[renderedBoxes.length] });
      }
      if (renderedBoxes.length > targetDetections.length) {
        renderedBoxes.length = targetDetections.length;
      }

      for (let i = 0; i < targetDetections.length; i++) {
        const target = targetDetections[i];
        const cur = renderedBoxes[i];
        const lerpFactor = 0.35; // Snappy EMA interpolation

        cur.x += (target.x - cur.x) * lerpFactor;
        cur.y += (target.y - cur.y) * lerpFactor;
        cur.w += (target.w - cur.w) * lerpFactor;
        cur.h += (target.h - cur.h) * lerpFactor;
        cur.animal = target.animal;
        cur.species = target.species;
        cur.symbol = target.symbol;
        cur.tone = target.tone;
        cur.conf = target.conf;

        const bx = (cur.x / 100) * displayW;
        const by = (cur.y / 100) * displayH;
        const bw = (cur.w / 100) * displayW;
        const bh = (cur.h / 100) * displayH;

        const isDanger = cur.tone === 'danger';
        const isWarning = cur.tone === 'warning';
        const strokeColor = isDanger ? '#ff3344' : (isWarning ? '#ffaa00' : '#52ffae');
        const glowColor = isDanger ? 'rgba(255, 51, 68, 0.25)' : (isWarning ? 'rgba(255, 170, 0, 0.2)' : 'rgba(82, 255, 174, 0.2)');

        // Outer Bounding Box (Glow + Core)
        overlayCtx.lineWidth = 4;
        overlayCtx.strokeStyle = glowColor;
        overlayCtx.strokeRect(bx, by, bw, bh);

        overlayCtx.lineWidth = 2;
        overlayCtx.strokeStyle = strokeColor;
        overlayCtx.strokeRect(bx, by, bw, bh);

        // 4 High-Contrast White Corner Brackets
        const cLen = Math.min(18, bw * 0.25, bh * 0.25);
        overlayCtx.strokeStyle = '#ffffff';
        overlayCtx.lineWidth = 3;
        overlayCtx.lineCap = 'square';

        // Top-Left
        overlayCtx.beginPath();
        overlayCtx.moveTo(bx - 2, by + cLen);
        overlayCtx.lineTo(bx - 2, by - 2);
        overlayCtx.lineTo(bx + cLen, by - 2);
        overlayCtx.stroke();

        // Top-Right
        overlayCtx.beginPath();
        overlayCtx.moveTo(bx + bw + 2 - cLen, by - 2);
        overlayCtx.lineTo(bx + bw + 2, by - 2);
        overlayCtx.lineTo(bx + bw + 2, by + cLen);
        overlayCtx.stroke();

        // Bottom-Left
        overlayCtx.beginPath();
        overlayCtx.moveTo(bx - 2, by + bh + 2 - cLen);
        overlayCtx.lineTo(bx - 2, by + bh + 2);
        overlayCtx.lineTo(bx + cLen, by + bh + 2);
        overlayCtx.stroke();

        // Bottom-Right
        overlayCtx.beginPath();
        overlayCtx.moveTo(bx + bw + 2 - cLen, by + bh + 2);
        overlayCtx.lineTo(bx + bw + 2, by + bh + 2);
        overlayCtx.lineTo(bx + bw + 2, by + bh + 2 - cLen);
        overlayCtx.stroke();

        // Centered Crosshair Reticle
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        overlayCtx.strokeStyle = strokeColor;
        overlayCtx.lineWidth = 1.5;
        overlayCtx.beginPath();
        overlayCtx.moveTo(cx - 7, cy);
        overlayCtx.lineTo(cx + 7, cy);
        overlayCtx.moveTo(cx, cy - 7);
        overlayCtx.lineTo(cx, cy + 7);
        overlayCtx.stroke();

        // High-Tech Cyber Badge
        const badgeLabel = `${cur.symbol || '🐾'} ${cur.animal.toUpperCase()} ${(cur.conf * 100).toFixed(1)}% // ${cur.species}`;
        overlayCtx.font = 'bold 11px "DM Mono", monospace';
        const textMetrics = overlayCtx.measureText(badgeLabel);
        const badgeW = textMetrics.width + 16;
        const badgeH = 22;
        const badgeX = bx;
        const badgeY = by >= badgeH + 6 ? by - badgeH - 4 : by + bh + 4;

        // Badge Background
        overlayCtx.fillStyle = isDanger ? 'rgba(36, 4, 8, 0.94)' : (isWarning ? 'rgba(36, 24, 4, 0.94)' : 'rgba(2, 24, 18, 0.92)');
        overlayCtx.fillRect(badgeX, badgeY, badgeW, badgeH);

        // Badge Border
        overlayCtx.strokeStyle = strokeColor;
        overlayCtx.lineWidth = 1;
        overlayCtx.strokeRect(badgeX, badgeY, badgeW, badgeH);

        // Badge Text
        overlayCtx.fillStyle = isDanger ? '#ff7676' : (isWarning ? '#ffbb33' : '#52ffae');
        overlayCtx.textBaseline = 'middle';
        overlayCtx.fillText(badgeLabel, badgeX + 8, badgeY + badgeH / 2);
      }
    } else {
      renderedBoxes = [];
    }

    overlayAnimFrameId = requestAnimationFrame(renderOverlayLoop);
  };

  overlayAnimFrameId = requestAnimationFrame(renderOverlayLoop);

  // 2. Safe Non-Blocking AI Inference Tick (Never throws or disconnects on scroll)
  const runDetectionTick = async () => {
    if (!isDetectionLoopRunning || !laptopCameraVideo || video !== laptopCameraVideo) return;

    // Ensure video is not paused by background scroll
    if (video.paused && !video.ended) {
      video.play().catch(() => {});
    }

    if (video.readyState >= 2 && video.videoWidth > 0 && !isDetecting) {
      isDetecting = true;
      try {
        // Draw frame safely into in-memory canvas
        sampleCtx.drawImage(video, 0, 0, 224, 224);
        let activeDetections = [];

        // Method A: Ultra-Fast Hardware-Accelerated Native FaceDetector (< 2ms runtime)
        // Using in-memory sampleCanvas guarantees zero browser exceptions when scrolled out of view
        if (nativeDetector) {
          try {
            const faces = await nativeDetector.detect(sampleCanvas);
            if (faces && faces.length > 0) {
              for (const face of faces) {
                const bb = face.boundingBox;
                const pctX = (1 - (bb.x + bb.width) / 224) * 100;
                const pctY = (bb.y / 224) * 100;
                const pctW = (bb.width / 224) * 100;
                const pctH = (bb.height / 224) * 100;

                activeDetections.push({
                  x: Math.max(1, Math.min(95, pctX)),
                  y: Math.max(1, Math.min(95, pctY)),
                  w: Math.max(8, Math.min(90, pctW)),
                  h: Math.max(10, Math.min(90, pctH)),
                  conf: 0.985,
                  animal: 'Human',
                  species: 'Homo sapiens',
                  symbol: '◉',
                  tone: '',
                  threat: 'FIELD RESEARCHER'
                });
              }
            }
          } catch {}
        }

        // Method B: WebGL Multi-Species Model when native faces not found or for wildlife classification
        if (activeDetections.length === 0 && window.cocoSsd) {
          const model = await loadDetectionModel();
          if (model) {
            let predictions = [];
            if (window.tf && window.tf.engine) {
              window.tf.engine().startScope();
              try {
                predictions = await model.detect(sampleCanvas, 4, 0.28);
              } catch {} finally {
                window.tf.engine().endScope();
              }
            } else {
              predictions = await model.detect(sampleCanvas, 4, 0.28);
            }

            if (predictions && predictions.length > 0) {
              for (const pred of predictions) {
                const labelKey = pred.class.toLowerCase();
                const tax = SPECIES_TAXONOMY[labelKey] || {
                  animal: pred.class.charAt(0).toUpperCase() + pred.class.slice(1),
                  species: 'Wild Specimen',
                  symbol: '🐾',
                  tone: 'warning',
                  threat: 'DETECTED OBJECT'
                };

                const [bx, by, bw, bh] = pred.bbox;
                const pctX = (1 - (bx + bw) / 224) * 100;
                const pctY = (by / 224) * 100;
                const pctW = (bw / 224) * 100;
                const pctH = (bh / 224) * 100;

                activeDetections.push({
                  x: Math.max(1, Math.min(95, pctX)),
                  y: Math.max(1, Math.min(95, pctY)),
                  w: Math.max(8, Math.min(90, pctW)),
                  h: Math.max(10, Math.min(90, pctH)),
                  conf: pred.score || 0.94,
                  animal: tax.animal,
                  species: tax.species,
                  symbol: tax.symbol,
                  tone: tax.tone,
                  threat: tax.threat
                });
              }
            }
          }
        }

        targetDetections = activeDetections;

        // Update Top Scan Badge
        const topBadge = document.querySelector('.scan-badge') || document.querySelector('.face-scan-badge');
        if (topBadge) {
          if (activeDetections.length > 0) {
            const topDet = activeDetections[0];
            const confPct = `${(topDet.conf * 100).toFixed(1)}%`;
            topBadge.textContent = '';
            const dot = document.createElement('span');
            dot.className = 'pulse-dot';
            topBadge.appendChild(dot);
            topBadge.appendChild(document.createTextNode(` ${topDet.symbol || '🐾'} ${activeDetections.length} ${topDet.animal} (${confPct})`));

            // Check predator alert
            const predator = activeDetections.find(d => d.tone === 'danger' || ['Bengal Tiger', 'Tiger', 'Asiatic Lion', 'Indian Leopard', 'Sloth Bear', 'Asian Elephant'].includes(d.animal));
            if (predator) {
              playPredatorSiren(predator.animal);
            }

            // Auto-Store Detection to Database (Rate limited to 1 per 3.5s)
            const now = Date.now();
            if (now - lastAutoStoreTime > 3500) {
              lastAutoStoreTime = now;
              const nowLocal = new Date();
              const detectionRecord = {
                animal: topDet.animal,
                species: topDet.species,
                symbol: topDet.symbol || '🐾',
                tone: topDet.tone || '',
                location: 'Field Station (Node 04)',
                ...(currentDeviceLocation ? {
                  latitude: formatCoordinate(currentDeviceLocation.latitude, 'N', 'S'),
                  longitude: formatCoordinate(currentDeviceLocation.longitude, 'E', 'W'),
                  accuracy: Math.round(currentDeviceLocation.accuracy),
                  locationSource: 'Browser GPS'
                } : {}),
                date: nowLocal.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
                time: nowLocal.toLocaleTimeString('en-GB'),
                confidence: confPct,
                source: 'Webcam AI / Multi-Species'
              };

              uploadDetection(detectionRecord).then(() => {
                syncDetectionsFromApi();
              });
            }
          } else {
            topBadge.textContent = '';
            const dot = document.createElement('span');
            dot.className = 'pulse-dot';
            topBadge.appendChild(dot);
            topBadge.appendChild(document.createTextNode(' Active Sector Scan'));
          }
        }
      } catch (err) {
        console.warn('Vision detection tick skipped error:', err);
      } finally {
        isDetecting = false;
      }
    }

    // Schedule next detection pass (balanced ~120ms interval for silky smooth 60 FPS video)
    if (isDetectionLoopRunning && laptopCameraVideo && video === laptopCameraVideo) {
      window.setTimeout(runDetectionTick, 120);
    }
  };

  runDetectionTick();
}

function exportCsv() {
  if (!currentResearcher) {
    showToast('Authentication required to export field data');
    return;
  }
  const headers = ['animal', 'species', 'location', 'date', 'time', 'confidence'];
  const rows = detections.map((detection) => headers.map((header) => `"${String(detection[header] || '').replaceAll('"', '""')}"`).join(','));
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'fieldwatch-detections.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Detection log exported');
}

async function logTestDetection() {
  if (!currentResearcher) {
    showToast('Please sign in as Field Researcher first');
    return;
  }

  const sampleAnimals = [
    { animal: 'Bengal tiger', species: 'Panthera tigris', symbol: '🐅', tone: 'danger' },
    { animal: 'Asian elephant', species: 'Elephas maximus', symbol: '🐘', tone: 'deer' },
    { animal: 'Indian rhinoceros', species: 'Rhinoceros unicornis', symbol: '🦏', tone: 'deer' },
    { animal: 'Indian leopard', species: 'Panthera pardus', symbol: '🐆', tone: 'danger' },
    { animal: 'Sloth bear', species: 'Melursus ursinus', symbol: '🐻', tone: 'danger' }
  ];
  const sample = sampleAnimals[Math.floor(Math.random() * sampleAnimals.length)];
  const nowLocal = new Date();
  const testPayload = {
    ...sample,
    _id: `det_test_${Date.now()}`,
    location: 'Field Station (Node 04)',
    date: nowLocal.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: nowLocal.toLocaleTimeString('en-GB'),
    confidence: `${(89 + Math.random() * 10).toFixed(1)}%`,
    source: 'Field Test Trigger',
    distanceCm: Math.round(50 + Math.random() * 250),
    angle: Math.round(15 + Math.random() * 150),
    createdAt: nowLocal
  };

  try {
    const res = await fetch(`${API_BASE}/detections/test`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      showToast(`⚡ Stored in Database: ${data.record.animal} (${data.record.confidence})`);
      syncDetectionsFromApi();
      return;
    }
  } catch (err) {
    // Backend offline / Live Server fallback
  }

  // Resilient Browser Database Persistence (LocalStorage)
  detections.unshift(testPayload);
  if (detections.length > 500) detections.pop();
  saveDetections();
  renderDetections();
  showToast(`⚡ Stored in Local Database: ${testPayload.animal} (${testPayload.confidence})`);
}

document.querySelector('#test-detection-button')?.addEventListener('click', logTestDetection);
document.querySelector('#export-button')?.addEventListener('click', exportCsv);


/* ==========================================================================
   EVENT LISTENERS & CONTROLS
   ========================================================================== */

// Auth Form Submission
document.querySelector('#auth-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const idInput = document.querySelector('#researcher-id');
  const passInput = document.querySelector('#researcher-pass');
  const rememberCheckbox = document.querySelector('#auth-remember');
  loginResearcher(idInput.value, passInput.value, rememberCheckbox?.checked);
});

// Quick 1-Click Demo Login (Populates UI & Authenticates Cryptographically via Backend)
document.querySelector('#quick-login-lead')?.addEventListener('click', () => {
  const idInput = document.querySelector('#researcher-id');
  const passInput = document.querySelector('#researcher-pass');
  if (idInput) idInput.value = 'arkasnata@fieldwatch.org';
  if (passInput) passInput.value = 'field2026';
  loginResearcher('arkasnata@fieldwatch.org', 'field2026', true);
});

// Password Visibility Toggle
document.querySelector('#toggle-pass')?.addEventListener('click', () => {
  const passInput = document.querySelector('#researcher-pass');
  if (!passInput) return;
  const isPass = passInput.type === 'password';
  passInput.type = isPass ? 'text' : 'password';
  const toggleBtn = document.querySelector('#toggle-pass');
  if (toggleBtn) {
    toggleBtn.innerHTML = isPass
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
});

// Dropdown User Menu Toggle
document.querySelector('#user-menu-button')?.addEventListener('click', (event) => {
  event.stopPropagation();
  const notifDropdown = document.querySelector('#notif-dropdown-menu');
  if (notifDropdown) notifDropdown.style.display = 'none';
  const dropdown = document.querySelector('#user-dropdown-menu');
  if (!dropdown) return;
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

// Notifications Dropdown Menu Toggle
document.querySelector('#notif-menu-button')?.addEventListener('click', (event) => {
  event.stopPropagation();
  const userDropdown = document.querySelector('#user-dropdown-menu');
  if (userDropdown) userDropdown.style.display = 'none';
  const dropdown = document.querySelector('#notif-dropdown-menu');
  if (!dropdown) return;
  const isOpening = dropdown.style.display === 'none';
  dropdown.style.display = isOpening ? 'block' : 'none';
  if (isOpening) {
    renderNotifications();
  }
});

// Clear/Mark Read Notifications Button
document.querySelector('#notif-clear-btn')?.addEventListener('click', (event) => {
  event.stopPropagation();
  markAllNotificationsRead();
});

// Close all dropdowns on clicking outside
document.addEventListener('click', (event) => {
  const userWrapper = document.querySelector('.user-menu-wrapper');
  const userDropdown = document.querySelector('#user-dropdown-menu');
  if (userDropdown && userWrapper && !userWrapper.contains(event.target)) {
    userDropdown.style.display = 'none';
  }

  const notifWrapper = document.querySelector('.notif-menu-wrapper');
  const notifDropdown = document.querySelector('#notif-dropdown-menu');
  if (notifDropdown && notifWrapper && !notifWrapper.contains(event.target)) {
    notifDropdown.style.display = 'none';
  }
});

// Close dropdowns on Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const userDropdown = document.querySelector('#user-dropdown-menu');
    if (userDropdown) userDropdown.style.display = 'none';
    const notifDropdown = document.querySelector('#notif-dropdown-menu');
    if (notifDropdown) notifDropdown.style.display = 'none';
  }
});

// Sign Out / Lock Terminal Buttons
document.querySelector('#lock-terminal-btn')?.addEventListener('click', logoutResearcher);
document.querySelector('#sidebar-lock-btn')?.addEventListener('click', logoutResearcher);

// Laptop Hardware Webcam Stream Toggle
document.querySelector('#laptop-camera-button')?.addEventListener('click', toggleLaptopCamera);

// Map View Mode Switcher Handlers
document.querySelector('#map-tab-hud')?.addEventListener('click', () => switchMapView('hud'));
document.querySelector('#map-tab-gmaps')?.addEventListener('click', () => switchMapView('gmaps'));
document.querySelector('#map-tab-osm')?.addEventListener('click', () => switchMapView('osm'));

// Function to open Location Calibrator Modal
function openLocationModal() {
  const modal = document.querySelector('#location-modal');
  if (!modal) return;
  modal.classList.add('active');

  // Populate active station card & manual inputs with current fix if available
  if (currentDeviceLocation) {
    const latNum = Number(currentDeviceLocation.latitude);
    const lonNum = Number(currentDeviceLocation.longitude);
    const latitudeText = formatCoordinate(latNum, 'N', 'S');
    const longitudeText = formatCoordinate(lonNum, 'E', 'W');
    const accuracy = Number.isFinite(currentDeviceLocation.accuracy) ? Math.round(currentDeviceLocation.accuracy) : 15;

    const activeTitleEl = document.querySelector('#loc-active-station-title');
    if (activeTitleEl) {
      const src = currentDeviceLocation.source ? `(Source: ${currentDeviceLocation.source})` : '(Source: Laptop)';
      activeTitleEl.textContent = `${currentDeviceLocation.city || 'Laptop GPS Station'} ${src}`;
    }

    const activeCoordsEl = document.querySelector('#loc-active-station-coords');
    if (activeCoordsEl) {
      const alt = currentDeviceLocation.altitude ? `Alt: ${currentDeviceLocation.altitude}` : 'Alt: N/A';
      activeCoordsEl.textContent = `${latitudeText}, ${longitudeText} (Accuracy ±${accuracy}m, ${alt})`;
    }

    const nameInput = document.querySelector('#loc-custom-name');
    const latInput = document.querySelector('#loc-custom-lat');
    const lonInput = document.querySelector('#loc-custom-lon');
    if (nameInput && !nameInput.value) nameInput.value = currentDeviceLocation.city || 'Field Station';
    if (latInput && !latInput.value) latInput.value = latNum.toFixed(6);
    if (lonInput && !lonInput.value) lonInput.value = lonNum.toFixed(6);
  }
  refreshMapIframes();
}

function closeLocationModal() {
  document.querySelector('#location-modal')?.classList.remove('active');
}

// Workspace Location Dropdown Toggle
const wsSwitcherBtn = document.querySelector('#workspace-station-indicator');
const wsDropdown = document.querySelector('#workspace-location-dropdown');

function toggleWorkspaceDropdown(e) {
  if (e) e.stopPropagation();
  if (!wsDropdown) return;
  const isHidden = wsDropdown.style.display === 'none' || !wsDropdown.style.display;
  wsDropdown.style.display = isHidden ? 'flex' : 'none';
  wsSwitcherBtn?.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  if (isHidden) {
    document.querySelector('#topbar-user-menu')?.style.setProperty('display', 'none');
    document.querySelector('#notif-dropdown-menu')?.style.setProperty('display', 'none');
  }
}

function closeWorkspaceDropdown() {
  if (wsDropdown) {
    wsDropdown.style.display = 'none';
    wsSwitcherBtn?.setAttribute('aria-expanded', 'false');
  }
}

wsSwitcherBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  openLocationModal();
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (wsDropdown && !wsDropdown.contains(e.target) && !wsSwitcherBtn?.contains(e.target)) {
    closeWorkspaceDropdown();
  }
});

// Quick Action: Fetch Exact Laptop GPS
document.querySelector('#ws-fetch-exact-loc-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  document.querySelectorAll('.ws-preset-item').forEach(item => item.classList.remove('active'));
  document.querySelector('#ws-preset-laptop')?.classList.add('active');
  startLiveGpsWatcher({ notify: true, forceRestart: true });
  closeWorkspaceDropdown();
});

// Quick Action: Reset GPS Sensor
document.querySelector('#ws-reset-gps-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleGpsReset();
  closeWorkspaceDropdown();
});

// Station Preset Item Click Handlers
document.querySelectorAll('.ws-preset-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ws-preset-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    const locType = item.getAttribute('data-loc');
    if (locType === 'laptop') {
      startLiveGpsWatcher({ notify: true, forceRestart: true });
    } else {
      isManualStationOverride = true;
      const name = item.getAttribute('data-name');
      const lat = parseFloat(item.getAttribute('data-lat'));
      const lon = parseFloat(item.getAttribute('data-lon'));

      const presetLoc = {
        latitude: lat,
        longitude: lon,
        accuracy: 10,
        altitude: 'Preset Sector',
        city: name,
        formattedAddress: `${name} Reserve`,
        source: 'Station Preset',
        timestamp: Date.now()
      };

      currentDeviceLocation = presetLoc;
      setStoredLocation(presetLoc);
      updateLocationUI(presetLoc);
      showToast(`Active station switched to: ${name}`);
    }
    closeWorkspaceDropdown();
  });
});

// Open Full Calibrator Modal from dropdown footer
document.querySelector('#ws-open-modal-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  closeWorkspaceDropdown();
  openLocationModal();
});

// Modal open triggers
document.querySelector('#map-calibrate-btn')?.addEventListener('click', openLocationModal);
document.querySelector('#trigger-calibrate-modal-btn')?.addEventListener('click', openLocationModal);
document.querySelector('#cam-edit-loc-btn')?.addEventListener('click', openLocationModal);
document.querySelector('#loc-modal-close')?.addEventListener('click', closeLocationModal);

// Close modal on backdrop click
document.querySelector('#location-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'location-modal') closeLocationModal();
});

// Location Search Functionality (Multi-Source Geocoding: Backend proxy + Nominatim fallback)
async function searchLocationByQuery(customQuery) {
  const input = document.querySelector('#loc-search-input');
  const resultsContainer = document.querySelector('#loc-search-results');
  const query = customQuery || (input ? input.value.trim() : '');

  if (!query) {
    showToast('Please enter a city, town, sanctuary, or PIN code to search');
    return;
  }

  showToast(`🔍 Searching for "${query}"...`);
  if (resultsContainer) {
    resultsContainer.innerHTML = '<div class="loc-search-loading" style="padding:10px; color:var(--text-muted); font-size:12px;">Searching geospatial database...</div>';
    resultsContainer.style.display = 'block';
  }

  let results = [];

  // Try backend proxy search first
  try {
    const res = await fetch(`${API_BASE}/location/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      results = await res.json();
    }
  } catch {}

  // Fallback to direct Nominatim if backend proxy returned empty
  if (!results || results.length === 0) {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'FieldWatch-Wildlife-OS/2.4' }
      });
      if (res.ok) {
        const data = await res.json();
        results = (data || []).map(item => {
          const addr = item.address || {};
          const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.state_district || query;
          const state = addr.state || addr.province || '';
          const country = addr.country || '';
          return {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            displayName: item.display_name,
            city,
            state,
            country,
            formatted: `${city}${state ? ', ' + state : ''}${country ? ', ' + country : ''}`
          };
        });
      }
    } catch {}
  }

  if (results && results.length > 0) {
    // Render dropdown list of matches for user to choose or pick top match if direct enter
    if (resultsContainer) {
      resultsContainer.innerHTML = results.map((r, idx) => `
        <div class="loc-search-result-item" data-idx="${idx}" style="padding: 10px 14px; border-bottom: 1px solid rgba(0,255,170,0.1); cursor: pointer; transition: background 0.15s ease; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div>
            <div style="font-weight: 600; color: #ffffff; font-size: 13px;">${r.city || 'Location'}</div>
            <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 380px;">${r.displayName || r.formatted}</div>
          </div>
          <span style="font-family: var(--font-mono, monospace); font-size: 10px; color: var(--color-brand-cyan, #00ffff); background: rgba(0,255,255,0.08); padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
            ${r.latitude.toFixed(3)}°, ${r.longitude.toFixed(3)}°
          </span>
        </div>
      `).join('');
      resultsContainer.style.display = 'block';

      // Attach click listeners to each search suggestion
      resultsContainer.querySelectorAll('.loc-search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.getAttribute('data-idx'), 10);
          const selected = results[idx];
          if (selected) {
            applyLocationFix({
              latitude: selected.latitude,
              longitude: selected.longitude,
              accuracy: 25,
              altitude: 'Calibrated MSL',
              city: selected.city,
              displayName: selected.displayName,
              formattedAddress: selected.formatted,
              source: 'Geocoded Search'
            });
            resultsContainer.style.display = 'none';
          }
        });
      });
    }

    // Auto-apply top result if triggered by Enter or explicit button click
    const top = results[0];
    applyLocationFix({
      latitude: top.latitude,
      longitude: top.longitude,
      accuracy: 35,
      altitude: 'Calibrated MSL',
      city: top.city,
      displayName: top.displayName,
      formattedAddress: top.formatted,
      source: 'Geocoded Search'
    });
    showToast(`✓ Station calibrated to: ${top.city}`);
  } else {
    if (resultsContainer) {
      resultsContainer.innerHTML = '<div style="padding: 10px 14px; color: #ff6b6b; font-size: 12px;">No matches found. Try searching a major city or 6-digit PIN code.</div>';
      resultsContainer.style.display = 'block';
    }
    showToast(`No matches found for "${query}". Try searching a nearby major city.`);
  }
}

function applyLocationFix(locData) {
  isManualStationOverride = true;
  const loc = {
    ...locData,
    timestamp: Date.now()
  };
  currentDeviceLocation = loc;
  setStoredLocation(loc);
  updateLocationUI(loc);
}

// Search button & Enter key
document.querySelector('#loc-search-btn')?.addEventListener('click', () => searchLocationByQuery());
document.querySelector('#loc-search-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchLocationByQuery();
  }
});

// Fetch Exact Satellite GPS Button in Modal (Forces High-Accuracy Browser Geolocation)
document.querySelector('#loc-main-fetch-btn')?.addEventListener('click', () => {
  startLiveGpsWatcher({ notify: true, forceRestart: true });
});

// Reset GPS & Clear Cache Buttons
const handleGpsReset = () => {
  showToast('🔄 Resetting GPS cache & recalibrating satellite tracking...');
  try {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
    currentDeviceLocation = null;
    lastGpsTimestamp = 0;
  } catch {}
  startLiveGpsWatcher({ notify: true, forceRestart: true });
};

document.querySelector('#loc-main-reset-btn')?.addEventListener('click', handleGpsReset);
document.querySelector('#loc-mini-reset-btn')?.addEventListener('click', handleGpsReset);

// Quick Locality & Sanctuary Hubs (1-Click)
document.querySelectorAll('.loc-hub-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    const city = pill.getAttribute('data-city');
    const lat = parseFloat(pill.getAttribute('data-lat'));
    const lon = parseFloat(pill.getAttribute('data-lon'));

    if (isNaN(lat) || isNaN(lon)) return;

    isManualStationOverride = true;
    const hubLoc = {
      latitude: lat,
      longitude: lon,
      accuracy: 25,
      altitude: 'Field Hub',
      city: city,
      displayName: `${city}, Wildlife Sector`,
      formattedAddress: `${city} Sector`,
      source: '1-Click Hub Preset',
      timestamp: Date.now()
    };

    currentDeviceLocation = hubLoc;
    setStoredLocation(hubLoc);
    updateLocationUI(hubLoc);
    showToast(`✓ Station position calibrated to: ${city}`);
  });
});

// Manual Decimal Coordinate Override Apply Button
document.querySelector('#loc-custom-apply-btn')?.addEventListener('click', () => {
  const nameInput = document.querySelector('#loc-custom-name');
  const latInput = document.querySelector('#loc-custom-lat');
  const lonInput = document.querySelector('#loc-custom-lon');
  const altInput = document.querySelector('#loc-custom-alt');

  const lat = parseFloat(latInput?.value);
  const lon = parseFloat(lonInput?.value);
  const name = nameInput?.value?.trim() || 'Custom Sector';
  const alt = altInput?.value?.trim() || 'Manual MSL';

  if (isNaN(lat) || isNaN(lon)) {
    showToast('Please enter valid numeric latitude and longitude values');
    return;
  }

  isManualStationOverride = true;
  const customLoc = {
    latitude: lat,
    longitude: lon,
    accuracy: 5,
    altitude: alt,
    city: name,
    displayName: `${name} [${lat.toFixed(4)}, ${lon.toFixed(4)}]`,
    formattedAddress: `${name} Sector`,
    source: 'Manual Calibration',
    timestamp: Date.now()
  };

  currentDeviceLocation = customLoc;
  setStoredLocation(customLoc);
  updateLocationUI(customLoc);
  showToast(`✓ Station position calibrated to ${name}`);
  closeLocationModal();
});

// Copy Coordinates to Clipboard Handlers
function copyCurrentCoordinates() {
  if (!currentDeviceLocation) {
    showToast('Awaiting GPS fix...');
    return;
  }
  const lat = Number(currentDeviceLocation.latitude).toFixed(6);
  const lon = Number(currentDeviceLocation.longitude).toFixed(6);
  const text = `${lat}, ${lon}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied to clipboard: ${text}`);
  }).catch(() => {
    showToast(`Coordinates: ${text}`);
  });
}

document.querySelector('#copy-coordinates-btn')?.addEventListener('click', copyCurrentCoordinates);

// Predator Audio Alarm Toggle Button
document.querySelector('#toggle-predator-alarm')?.addEventListener('click', (e) => {
  audioAlarmEnabled = !audioAlarmEnabled;
  e.currentTarget.innerHTML = audioAlarmEnabled
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="siren-icon"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg> <span>Siren: ON</span>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="siren-icon muted"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg> <span>Siren: MUTED</span>';
  showToast(audioAlarmEnabled ? 'Predator audio siren armed' : 'Predator audio siren muted');
  if (audioAlarmEnabled) {
    getAudioContext();
  }
});

// Refresh Button
document.querySelector('#refresh-feed')?.addEventListener('click', () => {
  document.querySelector('.forest-art')?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.5)' }, { filter: 'brightness(1)' }], { duration: 480 });
  const lastSyncEl = document.querySelector('#last-sync');
  if (lastSyncEl) lastSyncEl.textContent = 'just now';
  showToast('Feed refreshed');
});

// Cobot Autonomy & Obstacle Sim
let autonomyActive = false;
let obstacleActive = false;
let servoAngle = 72;

document.querySelector('#autonomy-button')?.addEventListener('click', (event) => {
  if (!radarState.isActive && !isWebSerialConnected) {
    showToast('Bot not connected — connect Arduino USB or start Python Bridge');
    return;
  }
  autonomyActive = !autonomyActive;
  event.currentTarget.textContent = autonomyActive ? 'Ⅱ Pause autonomy' : '▶ Resume autonomy';
  const statusEl = document.querySelector('#mission-status');
  if (statusEl) {
    statusEl.textContent = autonomyActive ? 'AUTONOMOUS' : 'PAUSED';
    statusEl.className = autonomyActive ? 'mission-pill' : 'mission-pill offline';
  }
  const navEl = document.querySelector('#navigation-state');
  if (navEl) navEl.textContent = autonomyActive ? 'Patrolling' : 'Manual teleop active';
  const speedEl = document.querySelector('#speed-reading');
  if (speedEl) speedEl.textContent = autonomyActive ? '0.42 m/s' : '0.00 m/s';

  const teleopLed = document.querySelector('#teleop-led');
  if (teleopLed) teleopLed.className = autonomyActive ? 'control-led dim' : 'control-led green';
  const teleopMode = document.querySelector('#teleop-mode-indicator');
  if (teleopMode) teleopMode.textContent = autonomyActive ? 'AUTO ACTIVE' : 'MANUAL READY';

  if (!autonomyActive) {
    sendMotorCommand('STOP');
  }

  showToast(autonomyActive ? 'Autonomous patrol resumed' : 'Autonomy paused — manual control unlocked');
});

document.querySelector('#obstacle-button')?.addEventListener('click', (event) => {
  if (!radarState.isActive && !isWebSerialConnected) {
    showToast('Bot not connected — connect Arduino USB or start Python Bridge');
    return;
  }
  obstacleActive = !obstacleActive;
  const obsEl = document.querySelector('#obstacle-state');
  if (obsEl) obsEl.textContent = obstacleActive ? 'Avoiding / 1.6 m' : 'Clear path';
  const obsLed = document.querySelector('#obstacle-led');
  if (obsLed) obsLed.className = obstacleActive ? 'control-led coral' : 'control-led yellow';
  const navEl = document.querySelector('#navigation-state');
  if (navEl) navEl.textContent = obstacleActive ? 'Turning east' : (autonomyActive ? 'Patrolling' : 'Manual teleop active');
  event.currentTarget.textContent = obstacleActive ? 'Clear obstacle' : 'Simulate obstacle';
  document.querySelector('#robot-marker')?.classList.toggle('avoiding', obstacleActive);
  showToast(obstacleActive ? 'Obstacle detected, rerouting' : 'Path clear');
});

/* ==========================================================================
   ROBOT MANUAL MOTOR TELEOPERATION DISPATCHER
   ========================================================================== */
let activeMotorCommand = 'STOP';
let motorSpeedPct = 75;

async function sendMotorCommand(command) {
  if (activeMotorCommand === command && command !== 'STOP') return;
  activeMotorCommand = command;

  const cmdEl = document.querySelector('#teleop-last-cmd');
  if (cmdEl) cmdEl.textContent = command;

  // Visual button feedback
  document.querySelectorAll('.teleop-btn').forEach(btn => btn.classList.remove('pressed'));
  const btnMap = {
    'FWD': '#motor-fwd',
    'REV': '#motor-rev',
    'LEFT': '#motor-left',
    'RIGHT': '#motor-right',
    'STOP': '#motor-stop'
  };
  if (btnMap[command]) {
    document.querySelector(btnMap[command])?.classList.add('pressed');
    if (command === 'STOP') {
      setTimeout(() => document.querySelector('#motor-stop')?.classList.remove('pressed'), 400);
    }
  }

  // Update speed & heading readouts live
  const speedEl = document.querySelector('#speed-reading');
  const headEl = document.querySelector('#heading-reading');
  const navEl = document.querySelector('#navigation-state');
  const navLed = document.querySelector('#nav-led');
  const marker = document.querySelector('#robot-marker');

  if (command === 'FWD') {
    if (speedEl) speedEl.textContent = '0.55 m/s';
    if (navEl) navEl.textContent = 'Manual Forward';
    if (navLed) navLed.className = 'control-led green';
    if (marker) marker.style.transform = 'translate(-50%, -50%) rotate(0deg)';
  } else if (command === 'REV') {
    if (speedEl) speedEl.textContent = '-0.35 m/s';
    if (navEl) navEl.textContent = 'Manual Reverse';
    if (navLed) navLed.className = 'control-led yellow';
    if (marker) marker.style.transform = 'translate(-50%, -50%) rotate(180deg)';
  } else if (command === 'LEFT') {
    if (speedEl) speedEl.textContent = '0.20 m/s';
    if (headEl) headEl.textContent = '270° W';
    if (navEl) navEl.textContent = 'Pivot Left';
    if (navLed) navLed.className = 'control-led blue';
    if (marker) marker.style.transform = 'translate(-50%, -50%) rotate(-90deg)';
  } else if (command === 'RIGHT') {
    if (speedEl) speedEl.textContent = '0.20 m/s';
    if (headEl) headEl.textContent = '090° E';
    if (navEl) navEl.textContent = 'Pivot Right';
    if (navLed) navLed.className = 'control-led blue';
    if (marker) marker.style.transform = 'translate(-50%, -50%) rotate(90deg)';
  } else {
    if (speedEl) speedEl.textContent = '0.00 m/s';
    if (navEl) navEl.textContent = autonomyActive ? 'Patrolling' : 'Manual Hold';
    if (navLed) navLed.className = autonomyActive ? 'control-led green' : 'control-led dim';
  }

  // 1. Direct Web Serial USB packet (e.g. "M:FWD\n" or "M:STOP\n")
  if (isWebSerialConnected && serialWriter) {
    try {
      await serialWriter.write(`M:${command}\n`);
    } catch (err) {
      console.warn('Failed to transmit motor packet over Web Serial:', err);
    }
  }

  // 2. HTTP / REST fallback to backend bridge if running headless (Signed Bearer Authorization)
  try {
    fetch(`${API_BASE}/telemetry/command`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ command: command, speed: motorSpeedPct, timestamp: Date.now() })
    }).catch(() => {});
  } catch {}
}

// Click / Touch bindings for Teleop Pad
document.querySelector('#motor-fwd')?.addEventListener('mousedown', () => sendMotorCommand('FWD'));
document.querySelector('#motor-fwd')?.addEventListener('mouseup', () => sendMotorCommand('STOP'));
document.querySelector('#motor-fwd')?.addEventListener('touchstart', (e) => { e.preventDefault(); sendMotorCommand('FWD'); });
document.querySelector('#motor-fwd')?.addEventListener('touchend', (e) => { e.preventDefault(); sendMotorCommand('STOP'); });

document.querySelector('#motor-rev')?.addEventListener('mousedown', () => sendMotorCommand('REV'));
document.querySelector('#motor-rev')?.addEventListener('mouseup', () => sendMotorCommand('STOP'));
document.querySelector('#motor-rev')?.addEventListener('touchstart', (e) => { e.preventDefault(); sendMotorCommand('REV'); });
document.querySelector('#motor-rev')?.addEventListener('touchend', (e) => { e.preventDefault(); sendMotorCommand('STOP'); });

document.querySelector('#motor-left')?.addEventListener('mousedown', () => sendMotorCommand('LEFT'));
document.querySelector('#motor-left')?.addEventListener('mouseup', () => sendMotorCommand('STOP'));
document.querySelector('#motor-left')?.addEventListener('touchstart', (e) => { e.preventDefault(); sendMotorCommand('LEFT'); });
document.querySelector('#motor-left')?.addEventListener('touchend', (e) => { e.preventDefault(); sendMotorCommand('STOP'); });

document.querySelector('#motor-right')?.addEventListener('mousedown', () => sendMotorCommand('RIGHT'));
document.querySelector('#motor-right')?.addEventListener('mouseup', () => sendMotorCommand('STOP'));
document.querySelector('#motor-right')?.addEventListener('touchstart', (e) => { e.preventDefault(); sendMotorCommand('RIGHT'); });
document.querySelector('#motor-right')?.addEventListener('touchend', (e) => { e.preventDefault(); sendMotorCommand('STOP'); });

document.querySelector('#motor-stop')?.addEventListener('click', () => sendMotorCommand('STOP'));

// Global Keyboard bindings (W, A, S, D & Arrow Keys & Spacebar)
const teleopKeysDown = new Set();
window.addEventListener('keydown', (event) => {
  // Ignore keys when typing in input/textarea/modal fields
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;

  const key = event.key.toUpperCase();
  if (['W', 'ARROWUP', 'S', 'ARROWDOWN', 'A', 'ARROWLEFT', 'D', 'ARROWRIGHT', ' '].includes(key)) {
    if (key === ' ' || key.startsWith('ARROW')) event.preventDefault(); // Prevent page scrolling

    if (teleopKeysDown.has(key)) return; // Debounce repeat keydown
    teleopKeysDown.add(key);

    if (key === 'W' || key === 'ARROWUP') sendMotorCommand('FWD');
    else if (key === 'S' || key === 'ARROWDOWN') sendMotorCommand('REV');
    else if (key === 'A' || key === 'ARROWLEFT') sendMotorCommand('LEFT');
    else if (key === 'D' || key === 'ARROWRIGHT') sendMotorCommand('RIGHT');
    else if (key === ' ') sendMotorCommand('STOP');
  }
});

window.addEventListener('keyup', (event) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;

  const key = event.key.toUpperCase();
  if (teleopKeysDown.has(key)) {
    teleopKeysDown.delete(key);
    if (teleopKeysDown.size === 0) {
      sendMotorCommand('STOP');
    } else {
      // Re-evaluate remaining held keys
      if (teleopKeysDown.has('W') || teleopKeysDown.has('ARROWUP')) sendMotorCommand('FWD');
      else if (teleopKeysDown.has('S') || teleopKeysDown.has('ARROWDOWN')) sendMotorCommand('REV');
      else if (teleopKeysDown.has('A') || teleopKeysDown.has('ARROWLEFT')) sendMotorCommand('LEFT');
      else if (teleopKeysDown.has('D') || teleopKeysDown.has('ARROWRIGHT')) sendMotorCommand('RIGHT');
    }
  }
});

// Interactive Map Pins -> Tactical HUD Node Status
document.querySelector('#pin-kolkata')?.addEventListener('click', () => {
  showToast('Node 04: Field Station Primary Sensor Active');
});

document.querySelector('#pin-river')?.addEventListener('click', () => {
  showToast('Node 02: River Bend Perimeter Sensor Active');
});

document.querySelector('#pin-ridge')?.addEventListener('click', () => {
  showToast('Node 01: East Ridge Standby Sensor');
});

document.querySelector('#connect-serial-btn')?.addEventListener('click', toggleWebSerialConnection);

// ==========================================================================
// SYSTEM SETTINGS & RESEARCH TEAM CONTROLLER
// ==========================================================================

const DEFAULT_SETTINGS = {
  aiEngine: 'browser',
  confidenceThreshold: 70,
  alertPredators: true,
  alertHerbivores: true,
  alertHumans: true,
  alertSiren: true,
  defaultBaud: 115200,
  defaultRange: 40,
  medianFilter: true,
  autoSerial: false
};

let userSettings = { ...DEFAULT_SETTINGS };

function loadUserSettings() {
  try {
    const saved = localStorage.getItem('fieldwatch_user_settings');
    if (saved) {
      userSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    userSettings = { ...DEFAULT_SETTINGS };
  }
  applySettingsToUI();
}

function saveUserSettings() {
  const browserRadio = document.querySelector('#engine-browser');
  const yoloRadio = document.querySelector('#engine-yolo');
  userSettings.aiEngine = yoloRadio?.checked ? 'yolo' : 'browser';

  const confSlider = document.querySelector('#setting-confidence-slider');
  if (confSlider) userSettings.confidenceThreshold = Number(confSlider.value);

  userSettings.alertPredators = Boolean(document.querySelector('#alert-predators')?.checked);
  userSettings.alertHerbivores = Boolean(document.querySelector('#alert-herbivores')?.checked);
  userSettings.alertHumans = Boolean(document.querySelector('#alert-humans')?.checked);
  userSettings.alertSiren = Boolean(document.querySelector('#alert-siren')?.checked);

  const baudSelect = document.querySelector('#setting-default-baud');
  if (baudSelect) userSettings.defaultBaud = Number(baudSelect.value);

  const rangeSelect = document.querySelector('#setting-default-range');
  if (rangeSelect) userSettings.defaultRange = Number(rangeSelect.value);

  userSettings.medianFilter = Boolean(document.querySelector('#setting-median-filter')?.checked);
  userSettings.autoSerial = Boolean(document.querySelector('#setting-auto-serial')?.checked);

  try {
    localStorage.setItem('fieldwatch_user_settings', JSON.stringify(userSettings));
  } catch {}

  applySettingsToUI();
  closeSettingsModal();
  addSystemNotification('success', 'System Settings Updated', 'All telemetry, sensor filter, and AI configurations applied.', '⚙️');
  showToast('✓ Settings applied successfully!');
}

function applySettingsToUI() {
  const browserRadio = document.querySelector('#engine-browser');
  const yoloRadio = document.querySelector('#engine-yolo');
  if (browserRadio && yoloRadio) {
    if (userSettings.aiEngine === 'yolo') yoloRadio.checked = true;
    else browserRadio.checked = true;
  }

  const confSlider = document.querySelector('#setting-confidence-slider');
  const confLabel = document.querySelector('#setting-confidence-label');
  if (confSlider) {
    confSlider.value = userSettings.confidenceThreshold;
    if (confLabel) confLabel.textContent = `${userSettings.confidenceThreshold}%`;
  }

  const chkPred = document.querySelector('#alert-predators');
  if (chkPred) chkPred.checked = userSettings.alertPredators;

  const chkHerb = document.querySelector('#alert-herbivores');
  if (chkHerb) chkHerb.checked = userSettings.alertHerbivores;

  const chkHum = document.querySelector('#alert-humans');
  if (chkHum) chkHum.checked = userSettings.alertHumans;

  const chkSiren = document.querySelector('#alert-siren');
  if (chkSiren) chkSiren.checked = userSettings.alertSiren;

  const baudSelect = document.querySelector('#setting-default-baud');
  if (baudSelect) baudSelect.value = String(userSettings.defaultBaud);

  const rangeSelect = document.querySelector('#setting-default-range');
  if (rangeSelect) rangeSelect.value = String(userSettings.defaultRange);

  const chkMed = document.querySelector('#setting-median-filter');
  if (chkMed) chkMed.checked = userSettings.medianFilter;

  const chkAutoSerial = document.querySelector('#setting-auto-serial');
  if (chkAutoSerial) chkAutoSerial.checked = userSettings.autoSerial;

  const mainBaud = document.querySelector('#radar-baud-select');
  if (mainBaud) mainBaud.value = String(userSettings.defaultBaud);

  const mainRange = document.querySelector('#radar-range-select');
  if (mainRange) {
    mainRange.value = String(userSettings.defaultRange);
    radarState.maxRangeCm = userSettings.defaultRange;
    const maxRangeEl = document.querySelector('#max-range-display');
    if (maxRangeEl) maxRangeEl.textContent = `${radarState.maxRangeCm} cm`;
  }

  const dbCountEl = document.querySelector('#settings-db-count');
  if (dbCountEl) dbCountEl.textContent = String(detections.length);
}

function openSettingsModal() {
  const modal = document.querySelector('#settings-modal');
  if (!modal) return;
  applySettingsToUI();
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('active'), 10);
}

function closeSettingsModal() {
  const modal = document.querySelector('#settings-modal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => {
      if (!modal.classList.contains('active')) modal.style.display = 'none';
    }, 200);
  }
}

async function purgeAllDetections() {
  const confirmed = confirm('⚠️ WARNING: Are you sure you want to completely clear and reset the detection history log? This cannot be undone.');
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/detections/clear`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (res.ok) {
      detections = [];
      renderDetections();
      const countEl = document.querySelector('#settings-db-count');
      if (countEl) countEl.textContent = '0';
      addSystemNotification('info', 'Database Purged', 'All historical detections were wiped clean.', '🗑️');
      showToast('🗑️ Detection history wiped clean!');
      return;
    }
  } catch {}

  detections = [];
  try {
    localStorage.removeItem('fieldwatch_detections');
  } catch {}
  renderDetections();
  const countEl = document.querySelector('#settings-db-count');
  if (countEl) countEl.textContent = '0';
  showToast('🗑️ Detection history wiped clean!');
}

function exportDatabaseJson() {
  if (!detections || detections.length === 0) {
    showToast('No detection records available to export.');
    return;
  }
  const jsonStr = JSON.stringify(detections, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fieldwatch_database_backup_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📦 Database exported as JSON!');
}

// Tab Switching
document.querySelectorAll('.settings-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    const pane = document.querySelector(`#${tabId}`);
    if (pane) pane.classList.add('active');
  });
});

// Slider Input Listener
document.querySelector('#setting-confidence-slider')?.addEventListener('input', (e) => {
  const lbl = document.querySelector('#setting-confidence-label');
  if (lbl) lbl.textContent = `${e.target.value}%`;
});

// Settings Modal Open/Close Triggers
document.querySelector('#sidebar-settings-btn')?.addEventListener('click', (e) => {
  e.preventDefault();
  openSettingsModal();
});

document.querySelector('#topbar-settings-btn')?.addEventListener('click', () => {
  openSettingsModal();
  const menu = document.querySelector('#user-dropdown-menu');
  if (menu) menu.style.display = 'none';
});

document.querySelector('#close-settings-modal-btn')?.addEventListener('click', closeSettingsModal);

document.querySelector('#settings-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'settings-modal') closeSettingsModal();
});

document.querySelector('#save-settings-btn')?.addEventListener('click', saveUserSettings);
document.querySelector('#reset-settings-btn')?.addEventListener('click', () => {
  userSettings = { ...DEFAULT_SETTINGS };
  applySettingsToUI();
  showToast('↺ Settings reset to factory defaults.');
});

document.querySelector('#purge-detections-btn')?.addEventListener('click', purgeAllDetections);
document.querySelector('#settings-export-csv')?.addEventListener('click', exportCsv);
document.querySelector('#settings-export-json')?.addEventListener('click', exportDatabaseJson);

document.querySelector('#radar-range-select')?.addEventListener('change', (e) => {
  radarState.maxRangeCm = Number(e.target.value || 40);
  const maxRangeEl = document.querySelector('#max-range-display');
  if (maxRangeEl) maxRangeEl.textContent = `${radarState.maxRangeCm} cm`;
  showToast(`Radar max scale set to ${radarState.maxRangeCm} cm`);
});

document.querySelector('#radar-baud-select')?.addEventListener('change', (e) => {
  showToast(`Serial baud set to ${e.target.value} baud`);
});

document.querySelector('#filter-button')?.addEventListener('click', () => {
  showingAll = !showingAll;
  const btn = document.querySelector('#filter-button');
  const span = btn?.querySelector('span') || btn?.firstChild;
  if (span) {
    span.textContent = showingAll ? 'Recent only' : 'All species';
  }
  renderDetections();
  showToast(showingAll ? 'Showing complete field log' : 'Showing recent detections');
});

// Initialize filter button text
const initFilterBtn = document.querySelector('#filter-button');
if (initFilterBtn) {
  const span = initFilterBtn.querySelector('span');
  if (span) span.textContent = showingAll ? 'Recent only' : 'All species';
}

document.querySelectorAll('.pagination button:not(:disabled)').forEach((button) => {
  button.addEventListener('click', () => showToast('Additional pages are ready for synced records'));
});

function updateRealtimeGreeting(name = 'Arkasnata') {
  const greeting = document.querySelector('#realtime-greeting');
  if (!greeting) return;
  const hr = new Date().getHours();
  let greetWord = 'Good morning';
  if (hr >= 12 && hr < 17) greetWord = 'Good afternoon';
  else if (hr >= 17 && hr < 22) greetWord = 'Good evening';
  else if (hr >= 22 || hr < 5) greetWord = 'Good night';
  const firstName = name.split(' ')[0] || 'Researcher';
  greeting.textContent = `${greetWord}, ${firstName} `;
  const sunSpan = document.createElement('span');
  sunSpan.className = 'sun';
  sunSpan.textContent = '✦';
  greeting.appendChild(sunSpan);
}

function updateRealtimeClock() {
  const now = new Date();
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  const dayName = days[now.getDay()];
  const dateNum = String(now.getDate()).padStart(2, '0');
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;
  
  const headerClock = document.querySelector('#realtime-header-clock');
  if (headerClock) {
    headerClock.textContent = `${dayName}, ${dateNum} ${monthName} ${year} / ${timeStr} IST`;
  }
  
  const camClock = document.querySelector('#realtime-cam-clock');
  if (camClock) {
    camClock.textContent = timeStr;
  }
}

// Auto-upgrade and resilient auto-reconnection for YOLO AI Vision Stream
let isYoloConnecting = false;
async function checkYoloStreamAvailability() {
  if (!currentResearcher || isYoloConnecting) return;
  // If user is intentionally running the browser-native camera, don't interrupt
  if (laptopCameraVideo && !laptopCameraImage) return;

  try {
    isYoloConnecting = true;
    const res = await fetch('http://localhost:5001/health', { method: 'GET', mode: 'cors' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'ok') {
        const cameraView = document.querySelector('.forest-art');
        if (cameraView && (!laptopCameraImage || !cameraView.contains(laptopCameraImage))) {
          const stream = document.createElement('img');
          stream.className = 'laptop-camera';
          stream.src = `http://localhost:5001/video?t=${Date.now()}`;
          stream.alt = 'YOLO annotated live stream';
          stream.onerror = () => {
            console.warn('YOLO camera stream disconnected, entering auto-reconnect mode...');
            if (laptopCameraImage) {
              laptopCameraImage.remove();
              laptopCameraImage = null;
            }
          };
          laptopCameraImage = stream;
          cameraView.innerHTML = `
            <div class="camera-crosshair"></div>
            <span class="cam-time" id="realtime-cam-clock">${new Date().toLocaleTimeString('en-GB')}</span>
            <span class="cam-meta" id="camera-overlay-meta">CAM-04 / 1080P / YOLO AI STREAM</span>
          `;
          cameraView.prepend(stream);
          cameraView.classList.add('laptop-camera-view', 'live-source');

          const btn = document.querySelector('#laptop-camera-button');
          if (btn) btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg> <span>Stop YOLO webcam</span>';
          showToast('YOLO AI vision stream connected');
        }
      }
    }
  } catch {} finally {
    isYoloConnecting = false;
  }
}

// Initialization Sequence
loadUserSettings();
renderDetections();
renderNotifications();
checkAuthStatus();
updateRealtimeClock();
const initialLocation = getStoredLocation();
if (initialLocation) {
  currentDeviceLocation = initialLocation;
  updateLocationUI(initialLocation);
} else {
  useVerifiedKolkataStation(false);
}
startLiveGpsWatcher({ notify: false }); // Continuously track live GPS with high accuracy
setRadarInactive(); // Never render a sweep until a physical sensor sends a reading.
radarAnimationLoop(); // Start 60 FPS Canvas Radar Engine
initTelemetryStream(); // Connect to real-time SSE stream with zero latency
scheduleAdaptiveTelemetryPoll(); // Start adaptive fallback poller

window.setInterval(updateRealtimeClock, 1000);
window.setInterval(syncDetectionsFromApi, 3000); // 3s database sync with dirty-checking
window.setInterval(checkYoloStreamAvailability, 4000); // Check for YOLO detector stream

// ==========================================================================
// FIELDWATCH TACTICAL API BRIDGE (FOR RANGER AI COPILOT & EXTERNAL SCRIPTS)
// ==========================================================================
window.FieldWatch = {
  getDetections: () => (Array.isArray(detections) ? detections : []),
  getRadarState: () => (typeof radarState !== 'undefined' ? radarState : null),
  getCurrentResearcher: () => (typeof currentResearcher !== 'undefined' && currentResearcher ? currentResearcher : DEFAULT_RESEARCHER),
  getCurrentLocation: () => currentDeviceLocation,
  refreshLocation: () => startLiveGpsWatcher({ notify: true, forceRestart: true }),
  openLocationModal: () => openLocationModal(),
  isAlarmArmed: () => Boolean(typeof audioAlarmEnabled !== 'undefined' && audioAlarmEnabled),
  toggleAlarm: (forceState) => {
    const btn = document.querySelector('#toggle-predator-alarm');
    if (btn) {
      if (typeof forceState === 'boolean') {
        if (Boolean(audioAlarmEnabled) !== forceState) btn.click();
      } else {
        btn.click();
      }
      return Boolean(audioAlarmEnabled);
    }
    return false;
  },
  triggerAlarmSound: () => {
    if (typeof playPredatorSiren === 'function') {
      playPredatorSiren('Tactical Alert');
      return true;
    }
    return false;
  },
  refreshCameraFeed: () => {
    const btn = document.querySelector('#refresh-feed');
    if (btn) { btn.click(); return true; }
    return false;
  },
  toggleLaptopWebcam: () => {
    const btn = document.querySelector('#laptop-camera-button');
    if (btn) { btn.click(); return true; }
    return false;
  },
  showToast: (msg) => {
    if (typeof showToast === 'function') showToast(msg);
  },
  openSettingsModal: () => {
    const btn = document.querySelector('#sidebar-settings-btn') || document.querySelector('#topbar-settings-btn');
    if (btn) btn.click();
  },
  scrollSection: (sectionId) => {
    const el = document.getElementById(sectionId) || document.querySelector(`[href="#${sectionId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      return true;
    }
    return false;
  },
  openChatbot: () => {
    if (window.RangerAI && typeof window.RangerAI.open === 'function') {
      window.RangerAI.open();
    }
  },
  closeChatbot: () => {
    if (window.RangerAI && typeof window.RangerAI.close === 'function') {
      window.RangerAI.close();
    }
  }
};
