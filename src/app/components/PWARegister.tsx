'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Download, X, Check } from 'lucide-react';
import { NotificationService } from '@/lib/notificationService';

export default function PWARegister() {
  const [userId, setUserId] = useState<string | null>(null);
  
  // Custom dialog flags
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // 1. Register Service Worker on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    NotificationService.registerServiceWorker();
  }, []);

  // 2. Track Supabase Auth Session for FCM Push Registration
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

  // Check and prompt for notification permissions
  const checkNotificationPermission = async (uid: string) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      await registerFCM(uid);
    } else if (Notification.permission === 'default') {
      const dismissed = localStorage.getItem('shasha_notification_dismissed');
      if (!dismissed) {
        setShowPermissionPrompt(true);
      }
    }
  };

  // Retrieve and register FCM token
  const registerFCM = async (uid: string) => {
    try {
      const token = await NotificationService.getFCMToken();
      if (token) {
        await NotificationService.saveTokenToSupabase(uid, token);
      }
    } catch (err) {
      console.warn('[PWA] FCM Token registration failed:', err);
    }
  };

  const handleEnableNotifications = async () => {
    setShowPermissionPrompt(false);
    const granted = await NotificationService.requestPermission();
    if (granted && userId) {
      await registerFCM(userId);
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
