const CACHE_NAME = 'shasha-cache-v1';
const OFFLINE_URLS = [
  '/dashboard',
  '/explore',
  '/friends',
  '/settings',
  '/icon.svg',
  '/globals.css'
];

// Install Event - Pre-cache assets for offline availability
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline pages');
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn('[Service Worker] Pre-cache failed (expected if some pages dynamic):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old cache storages
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Serve cached assets when network is offline
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for caching
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache valid HTTP responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Return from cache if network fails
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If offline page is not cached, return generic response
          if (event.request.mode === 'navigate') {
            return caches.match('/dashboard');
          }
        });
      })
  );
});

// Push Event - Receive notification event from browser push service
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[Service Worker] Push event received with no payload.');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('[Service Worker] Push notification payload:', payload);

    const title = payload.title || 'إشعار جديد من منصة شاشة';
    const body = payload.body || '';
    const type = payload.type || 'system';
    const roomId = payload.data?.roomId || '';

    // Action buttons depending on notification type
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

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        let isFocused = false;
        let isInsideTargetRoom = false;

        for (const client of windowClients) {
          const clientUrl = new URL(client.url);
          if (client.focused) {
            isFocused = true;
          }
          if (roomId && clientUrl.pathname.includes(`/room/${roomId}`)) {
            isInsideTargetRoom = true;
          }
        }

        // Smart Presence: suppress notification if the app is open and focused anywhere
        if (isFocused) {
          console.log('[Service Worker] Smart Presence: App is open and focused. Suppressing push banner (in-app Toast will show).');
          return;
        }

        return self.registration.showNotification(title, options);
      })
    );
  } catch (err) {
    console.error('[Service Worker] Failed to parse push data:', err);
    
    // Fallback plain text notification
    const fallbackText = event.data.text();
    event.waitUntil(
      self.registration.showNotification('تنبيه من شاشة', {
        body: fallbackText,
        icon: '/icon.svg',
        badge: '/icon.svg',
      })
    );
  }
});

// Notification Click Event - Direct user on click or action press
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  
  notification.close(); // Close alert popup

  let targetUrl = notification.data?.url || '/dashboard';
  
  if (action === 'dismiss') {
    console.log('[Service Worker] Notification dismissed by user.');
    return;
  }

  // Open corresponding app window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open at the target path, focus it
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl) {
          return client.focus();
        }
      }
      // Otherwise, open a new window at the target url
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
