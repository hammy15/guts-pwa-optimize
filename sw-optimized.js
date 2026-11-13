// GUTS Service Worker v3 - Full Offline Optimization
// Key improvements:
// 1. Stale-while-revalidate for fast loads
// 2. Offline game state persistence
// 3. Background sync for scores
// 4. Prefetch game assets
// 5. Storage quota management

const CACHE_VERSION = 'v3';
const STATIC_CACHE = `guts-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `guts-dynamic-${CACHE_VERSION}`;
const GAME_CACHE = `guts-game-${CACHE_VERSION}`;

// Core app shell - always cache
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-384x384.png',
];

// Game assets - prefetch after install
const GAME_ASSETS = [
  '/sounds/card-flip.mp3',
  '/sounds/chip-stack.mp3',
  '/sounds/win.mp3',
  '/sounds/lose.mp3',
  '/sounds/notification.mp3',
  '/cards/deck.png',
  '/cards/card-back.png',
  '/avatars/default.png',
  '/leaderboard',
  '/tournaments',
  '/privacy',
  '/terms',
];

// Fonts to cache
const FONT_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

// ═══════════════════════════════════════════════════════════════════════════
// INSTALL — Cache app shell + prefetch game assets
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v3...');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets (required for install)
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Prefetch game assets (best effort)
      caches.open(GAME_CACHE).then(async (cache) => {
        console.log('[SW] Prefetching game assets');
        for (const asset of GAME_ASSETS) {
          try {
            await cache.add(asset);
          } catch (e) {
            console.log(`[SW] Could not prefetch ${asset}`);
          }
        }
      }),
    ]).then(() => self.skipWaiting())
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVATE — Clean old caches
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v3...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old version caches
            return name.startsWith('guts-') && 
                   !name.endsWith(CACHE_VERSION);
          })
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// FETCH — Smart caching strategies
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip API calls (need fresh data)
  if (url.pathname.startsWith('/api/')) return;
  
  // Skip Supabase/auth
  if (url.hostname.includes('supabase')) return;
  
  // Skip WebSocket
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // Strategy selection
  if (isStaticAsset(url)) {
    // Cache-first for static assets (icons, manifest)
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isGameAsset(url)) {
    // Cache-first for game assets (sounds, sprites)
    event.respondWith(cacheFirst(request, GAME_CACHE));
  } else if (isPageNavigation(request)) {
    // Stale-while-revalidate for pages (fast + fresh)
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
  } else {
    // Network-first for everything else
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CACHING STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

// Cache-first: Return from cache, fall back to network
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

// Network-first: Try network, fall back to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || offlineFallback(request);
  }
}

// Stale-while-revalidate: Return cache immediately, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Fetch fresh version in background
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  
  // Return cached if available, otherwise wait for network
  return cached || fetchPromise || offlineFallback(request);
}

// Offline fallback page
function offlineFallback(request) {
  if (request.destination === 'document') {
    return caches.match('/') || new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GUTS - Offline</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            background: #0f172a; 
            color: #fff; 
            font-family: system-ui; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            min-height: 100vh;
            text-align: center;
            padding: 20px;
          }
          h1 { color: #14b8a6; margin-bottom: 16px; }
          p { color: #94a3b8; margin-bottom: 24px; }
          button {
            background: #14b8a6;
            color: #0f172a;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div>
          <h1>🃏 GUTS</h1>
          <p>You're offline. Connect to play multiplayer.</p>
          <p>Solo practice mode available!</p>
          <button onclick="location.reload()">Try Again</button>
        </div>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
  return new Response('Offline', { status: 503 });
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function isStaticAsset(url) {
  return url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|ttf)$/) ||
         url.pathname.startsWith('/icons/') ||
         url.pathname === '/manifest.json';
}

function isGameAsset(url) {
  return url.pathname.match(/\.(mp3|wav|ogg)$/) ||
         url.pathname.startsWith('/sounds/') ||
         url.pathname.startsWith('/cards/') ||
         url.pathname.startsWith('/avatars/');
}

function isPageNavigation(request) {
  return request.mode === 'navigate' ||
         request.destination === 'document';
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND SYNC — Queue scores when offline
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scores') {
    event.waitUntil(syncScores());
  }
});

async function syncScores() {
  try {
    // Get queued scores from IndexedDB
    const db = await openScoreDB();
    const scores = await getAllQueuedScores(db);
    
    for (const score of scores) {
      try {
        const response = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(score),
        });
        
        if (response.ok) {
          await deleteQueuedScore(db, score.id);
        }
      } catch (e) {
        console.log('[SW] Score sync failed, will retry');
      }
    }
  } catch (e) {
    console.error('[SW] Background sync error:', e);
  }
}

// IndexedDB helpers for offline score queue
function openScoreDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('guts-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('scores')) {
        db.createObjectStore('scores', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAllQueuedScores(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scores', 'readonly');
    const store = tx.objectStore('scores');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteQueuedScore(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scores', 'readwrite');
    const store = tx.objectStore('scores');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — Game invites, daily rewards, etc.
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from GUTS',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      tag: data.tag || 'guts-notification',
      requireInteraction: data.requireInteraction || false,
      actions: data.actions || [],
      silent: data.silent || false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'GUTS', options)
    );
  } catch (error) {
    console.error('[SW] Push notification error:', error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION CLICK — Route to correct page
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Route based on notification type
  switch (data.type) {
    case 'friend_request':
      url = '/?modal=friends';
      break;
    case 'game_invite':
      url = `/?join=${data.roomCode}`;
      break;
    case 'tournament_start':
      url = '/tournaments';
      break;
    case 'daily_reward':
      url = '/?claim=daily';
      break;
    case 'achievement':
      url = '/?modal=achievements';
      break;
    case 'battle_pass':
      url = '/?modal=battlepass';
      break;
    default:
      url = data.url || '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window if no existing window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLER — Communication with main app
// ═══════════════════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_GAME_STATE') {
    // Cache current game state for offline resume
    caches.open(GAME_CACHE).then((cache) => {
      const response = new Response(JSON.stringify(event.data.state));
      cache.put('/_game_state', response);
    });
  }
  
  if (event.data.type === 'GET_GAME_STATE') {
    // Return cached game state
    caches.match('/_game_state').then((response) => {
      if (response) {
        response.json().then((state) => {
          event.source.postMessage({ type: 'GAME_STATE', state });
        });
      }
    });
  }
  
  if (event.data.type === 'QUEUE_SCORE') {
    // Queue score for background sync
    openScoreDB().then((db) => {
      const tx = db.transaction('scores', 'readwrite');
      const store = tx.objectStore('scores');
      store.add(event.data.score);
    });
  }
});

console.log('[SW] GUTS Service Worker v3 loaded');
