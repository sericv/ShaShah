'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import {
  Home,
  Monitor,
  Search,
  Bell,
  Heart,
  FolderHeart,
  Users,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  X,
  Volume2,
  Sparkles,
  Menu,
  Trash2,
  UserPlus,
  MessageSquare,
  PhoneCall
} from 'lucide-react';
import Link from 'next/link';

interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  banner_url: string;
}

interface Notification {
  id: string;
  content: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface SearchResult {
  id: number | string;
  title: string;
  type: 'movie' | 'tv' | 'friend' | 'room';
  poster_path?: string;
  avatar_url?: string;
  room_id?: string;
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  
  // Realtime active toast notifications
  const [toasts, setToasts] = useState<{ id: string; content: string }[]>([]);
  const [soundMuted, setSoundMuted] = useState(false);

  // Mobile sidebar open state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const notificationMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load Session and Profile
  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      if (active) {
        // Fetch public profile
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!error && data) {
          setProfile(data);
          // Fetch user settings
          const { data: settingsData } = await supabase
            .from('user_settings')
            .select('sound_muted')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (settingsData) {
            setSoundMuted(settingsData.sound_muted);
          }
        } else {
          // Self-heal: Create profile row in Supabase from client if missing
          const defaultName = session.user.user_metadata?.name || (session.user.email ? session.user.email.split('@')[0] : 'مستخدم شاشة');
          const defaultUsername = session.user.user_metadata?.username || (session.user.email ? session.user.email.split('@')[0] + '_' + Math.floor(Math.random() * 1000) : 'user_' + Math.floor(Math.random() * 1000));
          const fallbackProfile = {
            id: session.user.id,
            name: defaultName,
            username: defaultUsername,
            avatar_url: ''
          };

          try {
            const { data: insertedData, error: insertError } = await supabase
              .from('profiles')
              .insert([fallbackProfile])
              .select()
              .maybeSingle();

            if (!insertError && insertedData) {
              setProfile(insertedData);
            } else {
              setProfile({
                ...fallbackProfile,
                banner_url: ''
              });
            }
          } catch (err) {
            setProfile({
              ...fallbackProfile,
              banner_url: ''
            });
          }
        }
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Load notifications
  useEffect(() => {
    if (!profile) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNotifications(data);
        setUnreadNotificationsCount(data.filter((n) => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Synthesize short professional audio chime (C5 -> E5 Discord chime style)
    const playChimeSound = () => {
      if (soundMuted) return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        
        // Note 1 (lower)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now);
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.12);
        
        // Note 2 (higher, delayed)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.08);
        gain2.gain.setValueAtTime(0.12, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.25);
      } catch (err) {
        console.warn('Web Audio synthesis failed:', err);
      }
    };

    // Subscribe to notifications changes
    const channel = supabase
      .channel(`notifications_realtime:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadNotificationsCount((prev) => prev + 1);

          // Push to active toast view
          const toastId = Math.random().toString(36).substring(7);
          setToasts((prev) => [...prev, { id: toastId, content: newNotif.content }]);
          
          // Play Web Audio synthesized sound
          playChimeSound();

          // Auto remove after 5 seconds
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toastId));
          }, 5000);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile, soundMuted]);

  // Handle outside clicks to close notifications and search results
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notificationMenuRef.current && !notificationMenuRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Instant Global Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const results: SearchResult[] = [];

        // 1. Search TMDB Proxy for Movies/TV
        const tmdbRes = await fetch(`/api/tmdb?endpoint=/search/multi&query=${encodeURIComponent(searchQuery)}&language=ar-SA`);
        if (tmdbRes.ok) {
          const tmdbData = await tmdbRes.json();
          if (tmdbData.results) {
            tmdbData.results.slice(0, 5).forEach((item: any) => {
              if (item.media_type === 'movie' || item.media_type === 'tv') {
                const displayTitle = item.media_type === 'movie' 
                  ? (item.original_title || item.title || '') 
                  : (item.original_name || item.name || '');
                results.push({
                  id: item.id,
                  title: displayTitle,
                  type: item.media_type as 'movie' | 'tv',
                  poster_path: item.poster_path
                });
              }
            });
          }
        }

        // 2. Search Profiles in Supabase
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .ilike('name', `%${searchQuery}%`)
          .limit(3);

        if (profilesData) {
          profilesData.forEach((p) => {
            if (p.id !== profile?.id) {
              results.push({
                id: p.id,
                title: p.name,
                type: 'friend',
                avatar_url: p.avatar_url
              });
            }
          });
        }

        // 3. Search Rooms in Supabase
        const { data: roomsData } = await supabase
          .from('persistent_rooms')
          .select('id, name')
          .ilike('name', `%${searchQuery}%`)
          .limit(3);

        if (roomsData) {
          roomsData.forEach((r) => {
            results.push({
              id: r.id,
              title: r.name,
              type: 'room',
              room_id: r.id
            });
          });
        }

        setSearchResults(results);
      } catch (err) {
        console.warn('Search query error:', err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, profile]);

  const handleMarkRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('notifications').delete().eq('id', id);
    
    const deleted = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (deleted && !deleted.is_read) {
      setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllRead = async () => {
    if (!profile) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadNotificationsCount(0);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-shasha-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-shasha-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  const sidebarLinks = [
    { name: 'الرئيسية', icon: Home, href: '/dashboard' },
    { name: 'إدارة الغرف', icon: Monitor, href: '/rooms' },
    { name: 'استكشف الأفلام', icon: Search, href: '/explore' },
    { name: 'المفضلة', icon: Heart, href: '/favorites' },
    { name: 'مكتبتي', icon: FolderHeart, href: '/library' },
    { name: 'الأصدقاء', icon: Users, href: '/friends' },
    { name: 'الحساب الشخصي', icon: User, href: '/profile' },
    { name: 'الإعدادات', icon: Settings, href: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-[#08080a] text-white flex select-none overflow-hidden h-screen max-h-screen">
      
      {/* Backdrop overlay for mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden cursor-pointer"
          />
        )}
      </AnimatePresence>

      {/* 1. Permanent Right Sidebar (Responsive: sliding in on mobile, static on desktop) */}
      <aside
        className={`w-64 border-l border-white/[0.04] bg-[#0c0c0f]/95 flex flex-col justify-between shrink-0 h-full z-50 md:z-20 md:relative fixed top-0 right-0 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col">
          {/* Logo with Close button on mobile */}
          <div className="h-16 flex items-center justify-between md:justify-end px-6 border-b border-white/[0.04]">
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              title="إغلاق القائمة"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="flex items-center">
              <span className="text-lg font-bold tracking-wider font-sans">
                شاشة <span className="text-shasha-accent">Shasha</span>
              </span>
              <div className="w-8 h-8 rounded-lg bg-shasha-accent flex items-center justify-center shadow-lg shadow-shasha-accent/25 ml-3">
                <Monitor className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          {/* Links */}
          <nav className="p-4 flex flex-col gap-1">
            {sidebarLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-end gap-3 px-4 py-3 rounded-xl transition-all font-semibold text-sm hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                    active
                      ? 'bg-shasha-accent/15 text-shasha-accent border-r-4 border-shasha-accent'
                      : 'text-white/60 hover:text-white hover:bg-white/3'
                  }`}
                >
                  <span>{link.name}</span>
                  <link.icon className={`w-4 h-4 ${active ? 'text-shasha-accent' : 'text-white/40'}`} />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile card & Logout */}
        <div className="p-4 border-t border-white/[0.04] flex flex-col gap-2">
          <div className="flex items-center justify-end gap-3 p-2.5 rounded-xl bg-white/3">
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-white">{profile?.name}</span>
              <span className="text-[9px] text-shasha-secondary">نشط</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-shasha-accent/25 border border-shasha-accent/30 flex items-center justify-center font-bold text-sm text-shasha-accent overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                profile?.name.charAt(0)
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setSidebarOpen(false);
              handleLogout();
            }}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-shasha-danger/25 text-shasha-danger hover:bg-shasha-danger hover:text-white transition-all text-xs font-bold cursor-pointer"
          >
            تسجيل الخروج
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* 2. Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        {/* Top Header Controls Bar */}
        <header className="h-16 border-b border-white/[0.04] bg-[#08080a]/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-8 z-10 shrink-0">
          {/* Right: Hamburger button & Search Input Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              title="القائمة"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            <div ref={searchContainerRef} className="relative w-48 sm:w-80">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="ابحث عن أفلام، أصدقاء أو غرف..."
                  className="w-full pl-4 pr-10 py-2 rounded-xl glass-input text-right text-xs"
                />
                <Search className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-white/30" />
              </div>

              {/* Instant Search Results Dropdown */}
              <AnimatePresence>
                {searchFocused && (searchQuery.trim() || searchResults.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-12 right-0 w-72 sm:w-96 max-h-[400px] overflow-y-auto glass-panel p-3 rounded-2xl z-50 text-right flex flex-col gap-2.5 shadow-2xl"
                  >
                    <div className="flex justify-between items-center px-1 border-b border-white/5 pb-1.5">
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-[10px] text-shasha-secondary hover:text-white transition-colors"
                      >
                        مسح
                      </button>
                      <span className="text-[10px] font-bold text-white/40">نتائج البحث الفورية</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {searchResults.map((result) => (
                        <div
                          key={`${result.type}-${result.id}`}
                          onClick={() => {
                            setSearchFocused(false);
                            setSearchQuery('');
                            if (result.type === 'movie' || result.type === 'tv') {
                              router.push(`/explore?movieId=${result.id}`);
                            } else if (result.type === 'friend') {
                              router.push(`/friends?friendId=${result.id}`);
                            } else if (result.type === 'room') {
                              router.push(`/room/${result.room_id}`);
                            }
                          }}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <div className="text-[10px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-white/60">
                            {result.type === 'movie' ? 'فيلم' : result.type === 'tv' ? 'مسلسل' : result.type === 'friend' ? 'صديق' : 'غرفة'}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{result.title}</span>
                            {result.poster_path && (
                              <img
                                src={`https://image.tmdb.org/t/p/w92${result.poster_path}`}
                                alt=""
                                className="w-6 h-8 rounded object-cover"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                      {searchQuery.trim() && searchResults.length === 0 && (
                        <span className="text-center text-xs text-shasha-secondary py-4">لا توجد نتائج مطابقة</span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Left: Notification Bell & Settings shortcuts */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div ref={notificationMenuRef} className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`w-9 h-9 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all relative ${
                  showNotifications ? 'bg-shasha-accent/20 border-shasha-accent/40 text-shasha-accent' : ''
                }`}
              >
                <Bell className="w-4 h-4 text-shasha-secondary" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-shasha-danger text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Notification Menu Dropdown */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-12 left-0 w-80 max-h-[350px] overflow-y-auto glass-panel p-3 rounded-2xl z-50 text-right flex flex-col gap-2.5 shadow-2xl"
                  >
                    <div className="flex justify-between items-center px-1 border-b border-white/5 pb-2">
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-shasha-accent hover:text-shasha-accent-hover font-semibold transition-colors"
                      >
                        تعليم الكل كمقروء
                      </button>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        الإشعارات والتنبيهات
                        <Sparkles className="w-3.5 h-3.5 text-shasha-accent" />
                      </h4>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {notifications.map((notif) => {
                        const IconComponent = notif.type === 'room_invitation' ? Monitor :
                                              notif.type === 'friend_request' ? UserPlus :
                                              notif.type === 'friend_accepted' ? User :
                                              notif.type === 'new_message' ? MessageSquare :
                                              notif.type === 'call_invitation' ? PhoneCall :
                                              Sparkles;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                            className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 text-right cursor-pointer ${
                              notif.is_read
                                ? 'bg-transparent border-white/5 text-white/50'
                                : 'bg-shasha-accent/5 border-shasha-accent/15 text-white font-medium hover:bg-shasha-accent/10'
                            }`}
                          >
                            <button
                              onClick={(e) => handleDeleteNotification(notif.id, e)}
                              className="text-white/30 hover:text-shasha-danger p-0.5 rounded transition-colors shrink-0 cursor-pointer"
                              title="حذف الإشعار"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                              <p className="text-[11px] leading-relaxed break-words">{notif.content}</p>
                              <span className="text-[8px] text-white/30 font-mono mt-1 block">
                                {new Date(notif.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center shrink-0">
                              <IconComponent className="w-3.5 h-3.5 text-shasha-accent" />
                            </div>
                          </div>
                        );
                      })}
                      {notifications.length === 0 && (
                        <span className="text-center text-xs text-shasha-secondary py-6">لا توجد إشعارات حالياً</span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => router.push('/settings')}
              className="w-9 h-9 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
            >
              <Settings className="w-4 h-4 text-shasha-secondary" />
            </button>
          </div>
        </header>

        {/* 3. Page Content Area */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
      </div>

      {/* Realtime Toast Notifications Overlay Container (Fade, Slide Down, Blur) */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100000] flex flex-col gap-3 pointer-events-none items-center max-w-sm w-full px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -25, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -25, filter: 'blur(8px)' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="w-full glass-panel bg-zinc-950/90 border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 pointer-events-auto text-right"
            >
              <div className="w-8 h-8 rounded-full bg-shasha-accent/20 flex items-center justify-center text-xs font-bold text-shasha-accent shrink-0">
                👤
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white leading-normal">
                  إشعار منصة شاشة
                </span>
                <span className="text-[11px] text-shasha-secondary leading-relaxed">
                  {toast.content}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
