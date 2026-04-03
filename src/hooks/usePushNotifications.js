import { useState, useEffect } from 'react';
import api from '@/api/apiClient';

// Detect if running in Capacitor native app
const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (isNative) {
      setupNativePush();
    } else {
      setIsSupported('serviceWorker' in navigator && 'PushManager' in window);
      checkWebSubscription();
    }
  }, []);

  // ── Native (Capacitor) push ──────────────────────────────
  const setupNativePush = async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      setIsSupported(true);

      const permResult = await PushNotifications.checkPermissions();
      if (permResult.receive === 'granted') {
        setIsSubscribed(true);
      }

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action:', notification);
        const url = notification.notification?.data?.url;
        if (url) window.location.href = url;
      });
    } catch (e) {
      console.log('Native push not available:', e);
      // Fall back to web push
      setIsSupported('serviceWorker' in navigator && 'PushManager' in window);
      checkWebSubscription();
    }
  };

  const subscribeNative = async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return false;

      await PushNotifications.register();

      // Listen for registration token
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration token:', token.value);
        // Save token to backend for FCM/APNs
        try {
          await api.notifications.subscribe({ type: 'native', token: token.value });
        } catch {}
      });

      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('Native push subscribe failed:', e);
      return false;
    }
  };

  // ── Web push ─────────────────────────────────────────────
  const checkWebSubscription = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {}
  };

  const subscribeWeb = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await api.notifications.getVapidKey();
      if (!publicKey) return false;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api.notifications.subscribe(sub.toJSON());
      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('Web push subscribe failed:', e);
      return false;
    }
  };

  const unsubscribeWeb = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.notifications.unsubscribe();
      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error('Unsubscribe failed:', e);
      return false;
    }
  };

  // ── Public API ───────────────────────────────────────────
  const subscribe = isNative ? subscribeNative : subscribeWeb;
  const unsubscribe = unsubscribeWeb;

  return { isSubscribed, isSupported, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
