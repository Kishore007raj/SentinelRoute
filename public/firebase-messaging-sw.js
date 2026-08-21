// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
// Note: We need to define this manually or load from ENV somehow, 
// but since SW runs in browser, we can initialize it with the same config.
// Ideally, the client registers the SW and passes the config via URL params or indexedDB.
// For simplicity, we assume process.env variables are injected, but since it's a static file,
// we will listen to a message from the window to initialize it dynamically, or use a fetch to get config.

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebase.initializeApp(event.data.config);
    const messaging = firebase.messaging();
    
    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      // Customize notification here
      const notificationTitle = payload.notification.title;
      const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon-192x192.png'
      };

      self.registration.showNotification(notificationTitle,
        notificationOptions);
    });
  }
});
