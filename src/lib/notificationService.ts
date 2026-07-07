import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, deleteToken as firebaseDeleteToken, onMessage } from 'firebase/messaging';
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: "AIzaSyDKWlgsLaGJH_sCuRm--cd-ZsDINdyr-P0",
  authDomain: "shasha-37224.firebaseapp.com",
  projectId: "shasha-37224",
  storageBucket: "shasha-37224.firebasestorage.app",
  messagingSenderId: "428718764667",
  appId: "1:428718764667:web:af9a53711bc9e30845e8de"
};

const VAPID_PUBLIC_KEY = 'BC9vFud1e4cE5Uj5Qg7xuxnGP9xYNXrocFz8233jx5lrGOJ0cDNOj1SRvXj1lvIFJ2Ov704L_CKRw4aERZWY_VA';

// Initialize Firebase App safely (singleton client-side)
export const getFirebaseApp = () => {
  if (typeof window === 'undefined') return null;
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
};

export const getFirebaseMessaging = () => {
  if (typeof window === 'undefined') return null;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getMessaging(app);
  } catch (err) {
    console.warn('[Firebase] Messaging is not supported in this browser.', err);
    return null;
  }
};

function getBrowserName(ua: string) {
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome') && !ua.includes('Chromium')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return 'Browser';
}

function getDeviceName(ua: string) {
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Windows NT')) return 'Windows PC';
  if (ua.includes('Macintosh')) return 'Mac';
  if (ua.includes('Linux')) return 'Linux';
  return 'Device';
}

export const NotificationService = {
  // Request notification permission
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  // Register service worker specifically for FCM
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('[NotificationService] SW registered scope:', reg.scope);
      // Try updating immediately
      reg.update().catch(() => {});
      return reg;
    } catch (err) {
      console.error('[NotificationService] SW registration failed:', err);
      return null;
    }
  },

  // Retrieve FCM Token
  async getFCMToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    const messaging = getFirebaseMessaging();
    if (!messaging) return null;

    try {
      const reg = await this.registerServiceWorker();
      if (!reg) return null;

      const token = await getToken(messaging, {
        vapidKey: VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: reg
      });
      return token;
    } catch (err) {
      console.error('[NotificationService] Failed to retrieve FCM Token:', err);
      return null;
    }
  },

  // Save the FCM Token in notification_tokens Supabase table
  async saveTokenToSupabase(uid: string, token: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const ua = navigator.userAgent;
      const browser = getBrowserName(ua);
      const platform = /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
      const deviceName = getDeviceName(ua);

      const { error } = await supabase.from('notification_tokens').upsert({
        user_id: uid,
        token: token,
        platform: platform,
        browser: browser,
        device_name: deviceName,
        last_seen: new Date().toISOString()
      }, { onConflict: 'user_id,token' });

      if (error) throw error;
      console.log('[NotificationService] FCM Token saved to Supabase.');
      return true;
    } catch (err) {
      console.error('[NotificationService] Failed to save token to database:', err);
      return false;
    }
  },

  // Refresh token helper (checks permission first, grabs token, saves it)
  async refreshToken(uid: string): Promise<string | null> {
    if (Notification.permission !== 'granted') return null;
    const token = await this.getFCMToken();
    if (token) {
      await this.saveTokenToSupabase(uid, token);
    }
    return token;
  },

  // Delete token from both Firebase client and Supabase DB
  async deleteToken(uid: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const messaging = getFirebaseMessaging();
      if (messaging) {
        await firebaseDeleteToken(messaging);
      }
      
      // Also delete from Supabase table
      const { error } = await supabase
        .from('notification_tokens')
        .delete()
        .eq('user_id', uid);
      
      if (error) throw error;
      console.log('[NotificationService] FCM Token deleted from Supabase.');
      return true;
    } catch (err) {
      console.error('[NotificationService] Failed to delete token:', err);
      return false;
    }
  },

  // Set up in-app foreground message listener
  onForegroundMessage(callback: (payload: any) => void) {
    if (typeof window === 'undefined') return () => {};
    const messaging = getFirebaseMessaging();
    if (!messaging) return () => {};
    return onMessage(messaging, (payload) => {
      console.log('[NotificationService] Foreground message received:', payload);
      callback(payload);
    });
  }
};
