// Firebase Cloud Messaging & PWA Isomorphic Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDKWlgsLaGJH_sCuRm--cd-ZsDINdyr-P0",
  authDomain: "shasha-37224.firebaseapp.com",
  projectId: "shasha-37224",
  storageBucket: "shasha-37224.firebasestorage.app",
  messagingSenderId: "428718764667",
  appId: "1:428718764667:web:af9a53711bc9e30845e8de"
};

// Initialize Firebase App
console.log('[Firebase SW] Initializing Firebase compatibility SDK...');
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 1. Firebase onBackgroundMessage Handler
messaging.onBackgroundMessage((payload) => {
  console.log('[Firebase SW] onBackgroundMessage event triggered with payload:', payload);

  const title = payload.notification?.title || payload.data?.title || 'إشعار جديد من منصة شاشة';
  const body = payload.notification?.body || payload.data?.body || '';
  const type = payload.data?.type || 'system';
  const roomId = payload.data?.roomId || '';

  const actions = [];
  if (type === 'room_invitation' && roomId) {
    actions.push({
      action: 'join_room',
      title: 'انضمام الآن ✅',
    });
  }
  actions.push({
    action: 'dismiss',
    title: 'تجاهل ❌',
  });

  const options = {
    body: body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    data: {
      roomId: roomId,
      type: type,
      url: roomId ? `/room/${roomId}` : '/dashboard'
    },
    actions: actions,
    tag: roomId ? `room-invitation-${roomId}` : `shasha-notify-${Date.now()}`,
    renotify: true
  };

  console.log('[Firebase SW] onBackgroundMessage showing notification:', title, options);
  return self.registration.showNotification(title, options);
});

// 2. Native Push Event Listener (Bulletproof fallback)
self.addEventListener('push', (event) => {
  console.log('[Firebase SW] Native push event listener triggered.');
  
  if (!event.data) {
    console.warn('[Firebase SW] Push event received but data is empty.');
    return;
  }

  const rawText = event.data.text();
  console.log('[Firebase SW] Push event raw text data:', rawText);

  let title = 'إشعار جديد من منصة شاشة';
  let body = '';
  let type = 'system';
  let roomId = '';
  let parsedPayload = null;

  try {
    parsedPayload = event.data.json();
    console.log('[Firebase SW] Push event parsed JSON:', parsedPayload);

    // FCM payloads can structure notifications in multiple properties (nested or flat)
    const notification = parsedPayload.notification || parsedPayload.data || {};
    title = notification.title || parsedPayload.title || title;
    body = notification.body || parsedPayload.body || body;
    
    const dataObj = parsedPayload.data || parsedPayload || {};
    type = dataObj.type || type;
    roomId = dataObj.roomId || roomId;
  } catch (err) {
    console.warn('[Firebase SW] Push event payload is not JSON. Using raw text as body.', err);
    body = rawText;
  }

  const actions = [];
  if (type === 'room_invitation' && roomId) {
    actions.push({
      action: 'join_room',
      title: 'انضمام الآن ✅',
    });
  }
  actions.push({
    action: 'dismiss',
    title: 'تجاهل ❌',
  });

  const options = {
    body: body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    data: {
      roomId: roomId,
      type: type,
      url: roomId ? `/room/${roomId}` : '/dashboard'
    },
    actions: actions,
    tag: roomId ? `room-invitation-${roomId}` : `shasha-notify-${Date.now()}`,
    renotify: true
  };

  console.log('[Firebase SW] Displaying notification via native push event:', title, options);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[Firebase SW] Native notification displayed successfully.'))
      .catch((showErr) => console.error('[Firebase SW] Failed to display native notification:', showErr))
  );
});

// 3. Handle Click Event on Background Notification
self.addEventListener('notificationclick', (event) => {
  console.log('[Firebase SW] notificationclick event triggered.');
  const notification = event.notification;
  const action = event.action;
  
  notification.close();

  let targetUrl = notification.data?.url || '/dashboard';
  
  if (action === 'dismiss') {
    console.log('[Firebase SW] Notification dismissed by user.');
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus if window is already open at target path
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ==========================================
// 4. PWA Caching / Offline logic & installation logs
// ==========================================
const CACHE_NAME = 'shasha-fcm-cache-v2';
const OFFLINE_URLS = [
  '/dashboard',
  '/explore',
  '/friends',
  '/settings',
  '/icon.svg',
  '/globals.css'
];

self.addEventListener('install', (event) => {
  console.log('[Firebase SW] install event triggered.');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Firebase SW] Pre-caching offline pages...');
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn('[Firebase SW] Pre-cache failed:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Firebase SW] activate event triggered.');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Firebase SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/dashboard');
          }
        });
      })
  );
});
