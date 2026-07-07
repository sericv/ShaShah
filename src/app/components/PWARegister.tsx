'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Download, X, Check } from 'lucide-react';

const VAPID_PUBLIC_KEY = 'BN1UfQkqEo4C8vNr7Zx_HkHCfYIeZa754KdC5_V1HCbtA-f45k2S6LQ__nFUVmQSrcgj4ALP61xncNXWuIwTf7I';

// Convert VAPID key to Uint8Array for PushManager subscription
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getBrowserName(ua: string) {
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome') && !ua.includes('Chromium')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return 'Browser';
}

function getDeviceName(ua: string) {
  if (ua.includes('Android')) return 'Android Device';
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Windows NT')) return 'Windows PC';
  if (ua.includes('Macintosh')) return 'Mac';
  if (ua.includes('Linux')) return 'Linux';
  return 'Device';
}

export default function PWARegister() {
  const [userId, setUserId] = useState<string | null>(null);
  
  // Custom dialog flags
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // 1. Register Service Worker on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.error('[PWA] Service Worker registration failed:', err);
        });
    }
  }, []);

  // 2. Track Supabase Auth Session for Push Subscriptions
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        checkNotificationPermission(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        checkNotificationPermission(session.user.id);
      } else {
        setUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. Catch PWA Install Prompts
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      
      const dismissed = localStorage.getItem('shasha_install_dismissed');
      if (dismissed) return;

      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Check if we should prompt for notifications
  const checkNotificationPermission = async (uid: string) => {
    if (!('Notification' in window)) return;
    
    // If permission was already granted, auto-renew push token registration in DB
    if (Notification.permission === 'granted') {
      await registerPushSubscription(uid);
    } else if (Notification.permission === 'default') {
      // Check if user dismissed notification prompt recently
      const dismissed = localStorage.getItem('shasha_notification_dismissed');
      if (!dismissed) {
        setShowPermissionPrompt(true);
      }
    }
  };

  // Perform VAPID Push Subscription
  const registerPushSubscription = async (uid: string) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }

      // Convert keys
      const p256dh = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!)));
      const auth = btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!)));

      const ua = navigator.userAgent;
      const browser = getBrowserName(ua);
      const platform = /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
      const deviceName = getDeviceName(ua);

      // Upsert subscription details
      await supabase.from('push_subscriptions').upsert({
        user_id: uid,
        endpoint: subscription.endpoint,
        p256dh: p256dh,
        auth: auth,
        platform: platform,
        device_name: deviceName,
        browser: browser,
        last_seen: new Date().toISOString()
      }, { onConflict: 'user_id,endpoint' });

      console.log('[PWA] Push notification subscription registered successfully.');
    } catch (err) {
      console.warn('[PWA] Push subscription registration failed:', err);
    }
  };

  const handleEnableNotifications = async () => {
    setShowPermissionPrompt(false);
    if (!('Notification' in window)) return;

    const permission = await Notification.requestPermission();
    if (permission === 'granted' && userId) {
      await registerPushSubscription(userId);
    } else {
      localStorage.setItem('shasha_notification_dismissed', 'true');
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install choice outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleLaterClick = () => {
    localStorage.setItem('shasha_install_dismissed', 'true');
    setShowInstallPrompt(false);
  };

  return (
    <>
      <AnimatePresence>
        {/* 1. Custom Notification explanation dialog */}
        {showPermissionPrompt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm glass-panel p-6 rounded-[24px] text-right flex flex-col items-center gap-4 relative"
            >
              <div className="w-12 h-12 rounded-full bg-shasha-accent/15 flex items-center justify-center text-shasha-accent">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">تفعيل التنبيهات الفورية</h3>
              <p className="text-xs text-shasha-secondary text-center leading-relaxed">
                ابق على اتصال مع أصدقائك وتلقى دعوات انضمام الغرف وبدء الأفلام لحظياً حتى عندما يكون التطبيق مغلقاً.
              </p>
              
              <div className="flex flex-col gap-2 w-full mt-2">
                <button
                  onClick={handleEnableNotifications}
                  className="w-full py-2.5 rounded-xl bg-shasha-accent hover:bg-shasha-accent-hover text-white text-xs font-bold transition-all cursor-pointer"
                >
                  تفعيل الإشعارات
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('shasha_notification_dismissed', 'true');
                    setShowPermissionPrompt(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-shasha-secondary text-xs font-semibold transition-all cursor-pointer"
                >
                  ليس الآن
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* 2. Custom App Install Prompt dialog */}
        {showInstallPrompt && (
          <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-xs bg-zinc-950/95 border border-white/10 p-5 rounded-[22px] z-[99998] shadow-2xl flex flex-col gap-4 text-right backdrop-blur-lg">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                تثبيت تطبيق شاشة
                <Download className="w-4 h-4 text-shasha-accent" />
              </span>
            </div>

            <div className="flex flex-col gap-1 text-[11px] text-shasha-secondary leading-relaxed">
              <span className="text-xs font-semibold text-white mb-1">هل تود تثبيت شاشة على جهازك؟</span>
              <span className="flex items-center gap-1.5 justify-end">✓ تشغيل أسرع وأداء أفضل <Check className="w-3 h-3 text-shasha-success" /></span>
              <span className="flex items-center gap-1.5 justify-end">✓ إشعارات فورية لحظية <Check className="w-3 h-3 text-shasha-success" /></span>
              <span className="flex items-center gap-1.5 justify-end">✓ ملء الشاشة كالتطبيقات الرسمية <Check className="w-3 h-3 text-shasha-success" /></span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={handleInstallClick}
                className="py-2 rounded-xl bg-shasha-accent text-white text-xs font-bold hover:bg-shasha-accent-hover transition-colors cursor-pointer"
              >
                تثبيت التطبيق
              </button>
              <button
                onClick={handleLaterClick}
                className="py-2 rounded-xl bg-white/5 text-shasha-secondary text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer"
              >
                لاحقاً
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
