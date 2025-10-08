// Service Worker para PWA - SIN funcionalidad offline
// El sistema requiere conexión constante para funcionar

const CACHE_NAME = 'control-puerta-v' + Date.now();
const STATIC_CACHE_URLS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cache abierto');
        // Solo cachear recursos estáticos críticos
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('✅ Service Worker: Instalación completada');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Service Worker: Error en instalación:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Activación completada');
      return self.clients.claim();
    })
  );
});

// Interceptar requests - DESHABILITADO para desarrollo
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // En desarrollo, NO interceptar NADA - usar fetch normal
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return; // No interceptar, usar fetch normal
  }
  
  // Solo para producción, cachear recursos estáticos
  if (request.method === 'GET' && 
      (url.pathname.startsWith('/static/') || 
       url.pathname === '/' || 
       url.pathname === '/manifest.json')) {
    
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            console.log('📦 Service Worker: Sirviendo desde cache:', url.pathname);
            return response;
          }
          
          // Si no está en cache, hacer fetch y cachear
          return fetch(request)
            .then((response) => {
              // Solo cachear respuestas exitosas
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseClone);
                    console.log('💾 Service Worker: Guardado en cache:', url.pathname);
                  });
              }
              return response;
            });
        })
        .catch((error) => {
          console.error('❌ Service Worker: Error en fetch:', error);
          // Para recursos críticos, intentar servir desde cache
          return caches.match(request);
        })
    );
  }
  // Para todas las demás requests (API, etc.), usar fetch normal
  // NO cachear datos dinámicos - el sistema requiere conexión
});

// Manejar notificaciones push
self.addEventListener('push', (event) => {
  console.log('🔔 Service Worker: Notificación push recibida');
  
  if (event.data) {
    const data = event.data.json();
    console.log('📨 Service Worker: Datos de notificación:', data);
    
    const options = {
      body: data.body || 'Nueva notificación del sistema',
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Abrir App',
          icon: '/logo192.png'
        },
        {
          action: 'close',
          title: 'Cerrar',
          icon: '/logo192.png'
        }
      ],
      requireInteraction: true,
      tag: 'control-puerta-notification'
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Control de Puerta', options)
    );
  }
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Service Worker: Click en notificación');
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  console.log('💬 Service Worker: Mensaje recibido:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Limpiar cache periódicamente
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cleanup-cache') {
    event.waitUntil(cleanupCache());
  }
});

async function cleanupCache() {
  console.log('🧹 Service Worker: Limpiando cache...');
  
  try {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name => name !== CACHE_NAME);
    
    await Promise.all(
      oldCaches.map(name => {
        console.log('🗑️ Service Worker: Eliminando cache:', name);
        return caches.delete(name);
      })
    );
    
    console.log('✅ Service Worker: Limpieza completada');
  } catch (error) {
    console.error('❌ Service Worker: Error en limpieza:', error);
  }
}
