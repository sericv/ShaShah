'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Settings, User, Shield, Volume2, Globe, Trash2, Check, AlertCircle, CheckCircle2, Bell, Monitor, Smartphone, MessageSquare, PhoneCall, UserPlus } from 'lucide-react';

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

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form Inputs
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteGenre, setFavoriteGenre] = useState('');
  const [soundMuted, setSoundMuted] = useState(false);
  const [privacy, setPrivacy] = useState('public');

  // Push Notification Settings preferences
  const [notifyRoomInvites, setNotifyRoomInvites] = useState(true);
  const [notifyFriendRequests, setNotifyFriendRequests] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyCalls, setNotifyCalls] = useState(true);
  const [notifySystem, setNotifySystem] = useState(true);

  // Push Subscription Status variables
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default' | 'not_supported'>('default');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [registeredEndpoint, setRegisteredEndpoint] = useState('لا يوجد اشتراك نشط');
  const [lastNotificationReceived, setLastNotificationReceived] = useState<string>('لا يوجد');
  const [testingPush, setTestingPush] = useState(false);

  // Username validation checking states
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [usernameValError, setUsernameValError] = useState('');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load Settings
  useEffect(() => {
    const loadSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Profile details
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (prof) {
        setProfile(prof);
        setName(prof.name || '');
        setUsername(prof.username || '');
        setAvatarUrl(prof.avatar_url || '');
        setBio(prof.bio || '');
        setFavoriteGenre(prof.favorite_genre || 'خيال علمي / تشويق');
      }

      // Settings details
      const { data: sett } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (sett) {
        setSoundMuted(sett.sound_muted);
        setPrivacy(sett.privacy_status || 'public');
        setNotifyRoomInvites(sett.notify_room_invites !== false);
        setNotifyFriendRequests(sett.notify_friend_requests !== false);
        setNotifyMessages(sett.notify_messages !== false);
        setNotifyCalls(sett.notify_calls !== false);
        setNotifySystem(sett.notify_system !== false);
      }

      // Device & Browser status check
      if (typeof window !== 'undefined') {
        const ua = navigator.userAgent;
        const browser = getBrowserName(ua);
        const device = getDeviceName(ua);
        setDeviceInfo(`${device} (${browser})`);

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          setPushStatus('not_supported');
        } else {
          setPushStatus(Notification.permission as any);
          
          navigator.serviceWorker.ready.then(async (registration) => {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
              setRegisteredEndpoint('نشط (Registered)');
            } else {
              setRegisteredEndpoint('غير مسجل (Unsubscribed)');
            }
          });
        }
      }

      setLoading(false);
    };

    loadSettings();
  }, []);

  // Live username validation logic on modification
  useEffect(() => {
    if (!profile || !username.trim() || username.trim().toLowerCase() === profile.username?.toLowerCase()) {
      setUsernameTaken(false);
      setUsernameValError('');
      return;
    }

    const regex = /^[a-zA-Z0-9][a-zA-Z0-9_]{2,19}$/;
    if (!regex.test(username)) {
      setUsernameValError('يجب أن يبدأ بحرف أو رقم، بطول 3 إلى 20 حرفاً إنجليزياً أو أرقام و _ فقط.');
      setUsernameTaken(false);
      return;
    } else {
      setUsernameValError('');
    }

    setUsernameChecking(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username.trim().toLowerCase())
          .maybeSingle();

        if (data) {
          setUsernameTaken(true);
        } else {
          setUsernameTaken(false);
        }
      } catch (err) {
        console.warn('Uniqueness check error:', err);
      } finally {
        setUsernameChecking(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [username, profile]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (usernameValError) {
      setErrorMsg('المعرف غير مستوف للشروط');
      return;
    }

    if (usernameTaken) {
      setErrorMsg('اسم المعرف مستخدم بالفعل من شخص آخر');
      return;
    }

    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      // 1. Update Profile
      await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          avatar_url: avatarUrl.trim(),
          bio: bio.trim(),
          favorite_genre: favoriteGenre.trim()
        })
        .eq('id', profile.id);

      // 2. Update settings
      const { data: existingSettings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      const settingsPayload = {
        sound_muted: soundMuted,
        privacy_status: privacy,
        notify_room_invites: notifyRoomInvites,
        notify_friend_requests: notifyFriendRequests,
        notify_messages: notifyMessages,
        notify_calls: notifyCalls,
        notify_system: notifySystem
      };

      if (existingSettings) {
        await supabase
          .from('user_settings')
          .update(settingsPayload)
          .eq('user_id', profile.id);
      } else {
        await supabase
          .from('user_settings')
          .insert({
            user_id: profile.id,
            ...settingsPayload
          });
      }

      // Update local profile ref
      setProfile((prev: any) => ({
        ...prev,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        avatar_url: avatarUrl.trim(),
        bio: bio.trim(),
        favorite_genre: favoriteGenre.trim()
      }));

      setSuccessMsg('تم حفظ وتحديث الإعدادات بنجاح!');
    } catch (err) {
      setErrorMsg('فشل حفظ الإعدادات، يرجى المحاولة لاحقاً');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTestingPush(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': accessToken ? `Bearer ${accessToken}` : ''
        },
        body: JSON.stringify({
          title: 'تجربة إشعار منصة شاشة 🚀',
          body: 'هذا إشعار تجريبي للتأكد من ربط نظام الـ Web Push ونظام VAPID بالكامل بنجاح.',
          type: 'system',
          data: {}
        })
      });
      if (res.ok) {
        setSuccessMsg('تم إرسال إشعار تجريبي لجهازك بنجاح!');
        setLastNotificationReceived(new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        const errorData = await res.json();
        setErrorMsg(`فشل إرسال الإشعار التجريبي: ${errorData.message || 'خطأ غير معروف'}`);
      }
    } catch (err) {
      setErrorMsg('فشل الاتصال بخادم الإشعارات.');
    } finally {
      setTestingPush(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!profile) return;
    if (!confirm('تحذير: هل أنت متأكد من حذف حسابك بالكامل؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع بياناتك وغرفك.')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id);

      if (error) throw error;

      await supabase.auth.signOut();
      router.push('/');
    } catch (err) {
      alert('حدث خطأ أثناء محاولة حذف الحساب.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-shasha-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-shasha-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-right pb-10 max-w-3xl mx-auto">
      
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center border-b border-white/5 pb-4"
      >
        <span className="text-xs text-shasha-secondary font-semibold">تخصيص حسابك الشخصي ووسائل الخصوصية والأصوات</span>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          الإعدادات
          <Settings className="w-5.5 h-5.5 text-shasha-accent" />
        </h1>
      </motion.div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
        
        {/* Profile Card Section */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white/50 flex items-center justify-end gap-2 border-b border-white/5 pb-2">
            الحساب الشخصي
            <User className="w-4 h-4 text-shasha-accent" />
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Display name */}
            <div>
              <label className="block text-xs font-semibold text-shasha-secondary mb-2">الاسم المعروض</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-right text-xs"
                required
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-shasha-secondary mb-2">اسم المعرف (Username)</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-4 pr-8 py-3 rounded-xl glass-input text-left text-xs font-semibold"
                  dir="ltr"
                  required
                />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-white/30 font-bold select-none">@</span>
              </div>
              
              {usernameChecking && (
                <span className="text-[9px] text-shasha-secondary block mt-1">جاري التحقق...</span>
              )}
              {!usernameChecking && username.trim() && profile && username.trim().toLowerCase() !== profile.username?.toLowerCase() && !usernameValError && (
                usernameTaken ? (
                  <span className="text-[9px] text-shasha-danger flex items-center gap-1 mt-1 justify-end">
                    المعرف مستخدم بالفعل
                    <AlertCircle className="w-3 h-3" />
                  </span>
                ) : (
                  <span className="text-[9px] text-shasha-success flex items-center gap-1 mt-1 justify-end">
                    المعرف متاح ومناسب
                    <CheckCircle2 className="w-3 h-3" />
                  </span>
                )
              )}
              {usernameValError && (
                <span className="text-[9px] text-shasha-warning block mt-1 leading-relaxed">{usernameValError}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Avatar URL */}
            <div>
              <label className="block text-xs font-semibold text-shasha-secondary mb-2">رابط الصورة الشخصية (Avatar URL)</label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-4 py-3 rounded-xl glass-input text-left text-xs"
                dir="ltr"
              />
            </div>
            
            {/* Favorite Genre */}
            <div>
              <label className="block text-xs font-semibold text-shasha-secondary mb-2">التصنيف المفضل</label>
              <input
                type="text"
                value={favoriteGenre}
                onChange={(e) => setFavoriteGenre(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-right text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-shasha-secondary mb-2">النبذة الشخصية (Bio)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass-input text-right text-xs h-20 resize-none"
              placeholder="اكتب نبذة قصيرة عن نفسك..."
            />
          </div>
        </div>

        {/* Preferences Section */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col gap-4">
          <h3 className="text-sm font-bold text-white/50 flex items-center justify-end gap-2 border-b border-white/5 pb-2">
            التفضيلات والخصوصية
            <Shield className="w-4 h-4 text-shasha-accent" />
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sound Muted Toggle */}
            <div>
              <label className="block text-xs font-semibold text-shasha-secondary mb-2">أصوات إشعارات سينما شات</label>
              <button
                type="button"
                onClick={() => setSoundMuted(!soundMuted)}
                className={`w-full p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  soundMuted
                    ? 'bg-shasha-danger/10 border-shasha-danger/25 text-shasha-danger'
                    : 'bg-shasha-success/10 border-shasha-success/25 text-shasha-success'
                }`}
              >
                <span>{soundMuted ? 'كتم أصوات التنبيهات' : 'تفعيل أصوات التنبيهات'}</span>
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* Privacy status */}
            <div>
              <label className="block text-xs font-semibold text-shasha-secondary mb-2">خصوصية الحساب</label>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                className="w-full p-3 rounded-xl bg-white/5 border border-white/8 text-xs font-medium text-white focus:outline-none focus:border-shasha-accent text-right cursor-pointer"
              >
                <option value="public" className="bg-shasha-card text-white">حساب عام (يمكن للجميع البحث عنك)</option>
                <option value="private" className="bg-shasha-card text-white">حساب خاص (مخفي من البحث)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Push Notifications Section */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col gap-5">
          <h3 className="text-sm font-bold text-white/50 flex items-center justify-end gap-2 border-b border-white/5 pb-2">
            إعدادات الإشعارات الفورية (Push Notifications)
            <Bell className="w-4 h-4 text-shasha-accent" />
          </h3>

          {/* Subscriptions Status Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/[0.02] p-4 rounded-2xl border border-white/5 text-xs">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-white/70" dir="ltr">{deviceInfo || 'جاري التحقق...'}</span>
                <span className="text-shasha-secondary font-medium">الجهاز الحالي:</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`font-semibold ${pushStatus === 'granted' ? 'text-shasha-success' : 'text-shasha-danger'}`}>
                  {pushStatus === 'granted' ? 'مسموح (Granted)' :
                   pushStatus === 'denied' ? 'مرفوض (Denied)' :
                   pushStatus === 'not_supported' ? 'غير مدعوم في هذا المتصفح' : 'غير محدد (Default)'}
                </span>
                <span className="text-shasha-secondary font-medium">صلاحية المتصفح:</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-mono text-white/70">{registeredEndpoint}</span>
                <span className="text-shasha-secondary font-medium">حالة الاشتراك في الخدمة:</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-mono text-white/70">{lastNotificationReceived}</span>
                <span className="text-shasha-secondary font-medium">آخر إشعار مستلم:</span>
              </div>
            </div>
          </div>

          {/* Preferences Toggles */}
          <div className="flex flex-col gap-3">
            <label className="block text-xs font-semibold text-shasha-secondary">تفضيلات إرسال التنبيهات</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              <button
                type="button"
                onClick={() => setNotifyRoomInvites(!notifyRoomInvites)}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  notifyRoomInvites
                    ? 'bg-shasha-accent/5 border-shasha-accent/20 text-white'
                    : 'bg-white/2 border-white/5 text-shasha-secondary'
                }`}
              >
                <span>دعوات الغرف (Room Invitations)</span>
                <Monitor className="w-4 h-4 text-shasha-accent" />
              </button>

              <button
                type="button"
                onClick={() => setNotifyFriendRequests(!notifyFriendRequests)}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  notifyFriendRequests
                    ? 'bg-shasha-accent/5 border-shasha-accent/20 text-white'
                    : 'bg-white/2 border-white/5 text-shasha-secondary'
                }`}
              >
                <span>طلبات الصداقة (Friend Requests)</span>
                <UserPlus className="w-4 h-4 text-shasha-accent" />
              </button>

              <button
                type="button"
                onClick={() => setNotifyMessages(!notifyMessages)}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  notifyMessages
                    ? 'bg-shasha-accent/5 border-shasha-accent/20 text-white'
                    : 'bg-white/2 border-white/5 text-shasha-secondary'
                }`}
              >
                <span>الرسائل الجديدة (Messages)</span>
                <MessageSquare className="w-4 h-4 text-shasha-accent" />
              </button>

              <button
                type="button"
                onClick={() => setNotifyCalls(!notifyCalls)}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  notifyCalls
                    ? 'bg-shasha-accent/5 border-shasha-accent/20 text-white'
                    : 'bg-white/2 border-white/5 text-shasha-secondary'
                }`}
              >
                <span>دعوات الاتصال (Calls)</span>
                <PhoneCall className="w-4 h-4 text-shasha-accent" />
              </button>

              <button
                type="button"
                onClick={() => setNotifySystem(!notifySystem)}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                  notifySystem
                    ? 'bg-shasha-accent/5 border-shasha-accent/20 text-white'
                    : 'bg-white/2 border-white/5 text-shasha-secondary'
                }`}
              >
                <span>تحديثات النظام العامة (System Updates)</span>
                <Globe className="w-4 h-4 text-shasha-accent" />
              </button>

              {/* Test Notification Action */}
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={testingPush || pushStatus !== 'granted'}
                className="p-3 rounded-xl border border-shasha-accent/30 text-shasha-accent bg-shasha-accent/5 hover:bg-shasha-accent hover:text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer disabled:opacity-50"
              >
                {testingPush ? (
                  <>
                    <span>جاري الإرسال...</span>
                    <div className="w-4 h-4 rounded-full border border-shasha-accent border-t-transparent animate-spin" />
                  </>
                ) : (
                  <>
                    <span>إرسال إشعار تجريبي (Test Push)</span>
                    <Smartphone className="w-4 h-4" />
                  </>
                )}
              </button>

            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={saving || usernameChecking}
            className="w-full py-3.5 rounded-xl bg-shasha-accent text-white font-semibold text-xs transition-all hover:bg-shasha-accent-hover active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-shasha-accent/20 cursor-pointer disabled:opacity-55"
          >
            {saving ? (
              <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <>
                حفظ التغييرات
                <Check className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </form>

      {/* Message Notifications */}
      {successMsg && (
        <div className="text-xs font-semibold text-shasha-success bg-shasha-success/10 border border-shasha-success/20 px-3 py-2 rounded-lg text-center">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="text-xs font-semibold text-shasha-danger bg-shasha-danger/10 border border-shasha-danger/20 px-3 py-2 rounded-lg text-center">
          {errorMsg}
        </div>
      )}

      {/* Danger Zone Section */}
      <div className="glass-panel p-6 rounded-3xl border border-shasha-danger/15 flex flex-col gap-4 bg-shasha-danger/[0.02]">
        <h3 className="text-sm font-bold text-shasha-danger flex items-center justify-end gap-2 border-b border-shasha-danger/10 pb-2">
          منطقة الخطر (Danger Zone)
          <AlertCircle className="w-4 h-4 text-shasha-danger" />
        </h3>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <button
            onClick={handleDeleteAccount}
            className="px-5 py-3 rounded-xl bg-shasha-danger/10 hover:bg-shasha-danger border border-shasha-danger/30 text-shasha-danger hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            حذف الحساب نهائياً
          </button>
          <div className="text-right flex flex-col gap-1">
            <span className="text-xs font-bold text-white/90">حذف هذا الحساب نهائياً</span>
            <span className="text-[10px] text-shasha-secondary leading-relaxed">
              سيؤدي هذا إلى حذف حسابك بالكامل وجميع الأفلام المحفوظة وقائمة الأصدقاء، ولن تتمكن من استعادتها.
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
