import { useState, useEffect } from 'react';
import api from '@/api/apiClient';

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'PushManager' in window);
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setIsSubscribed(!!sub);
  };

  const subscribe = async () => {
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
      console.error('Push subscribe failed:', e);
      return false;
    }
  };

  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await api.notifications.unsubscribe();
      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error('Push unsubscribe failed:', e);
      return false;
    }
  };

  return { isSubscribed, isSupported, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
