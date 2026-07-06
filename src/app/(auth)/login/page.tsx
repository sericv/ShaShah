'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Sparkles, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('الرجاء تعبئة جميع الحقول');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setErrorMsg(error.message || 'فشل تسجيل الدخول، يرجى التحقق من البيانات');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg('حدث خطأ غير متوقع، يرجى المحاولة لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          مرحباً بك مجدداً
          <Sparkles className="w-5 h-5 text-shasha-accent" />
        </h2>
        <p className="text-sm text-shasha-secondary">سجل دخولك للوصول لغرفتك ومجموعتك المفضلة</p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        {/* Email Input */}
        <div>
          <label className="block text-xs font-semibold text-shasha-secondary mb-2">البريد الإلكتروني</label>
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full pl-4 pr-10 py-3 rounded-xl glass-input text-left text-sm"
              dir="ltr"
              required
            />
            <Mail className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-white/30" />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <Link href="/forgot-password" className="text-xs text-shasha-accent hover:text-shasha-accent-hover transition-colors">
              نسيت كلمة المرور؟
            </Link>
            <label className="block text-xs font-semibold text-shasha-secondary">كلمة المرور</label>
          </div>
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-4 pr-10 py-3 rounded-xl glass-input text-left text-sm"
              dir="ltr"
              required
            />
            <Lock className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-white/30" />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3.5 rounded-xl bg-shasha-accent text-white font-semibold text-sm transition-all hover:bg-shasha-accent-hover active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-shasha-accent/20 cursor-pointer disabled:opacity-55"
        >
          {loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <>
              تسجيل الدخول
              <ArrowLeft className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-xs font-semibold text-shasha-danger bg-shasha-danger/10 border border-shasha-danger/20 px-3 py-2 rounded-lg text-center"
        >
          {errorMsg}
        </motion.div>
      )}

      <div className="mt-6 text-center border-t border-white/5 pt-4">
        <p className="text-xs text-shasha-secondary">
          ليس لديك حساب؟{' '}
          <Link href="/register" className="text-shasha-accent hover:text-shasha-accent-hover font-semibold transition-colors">
            أنشئ حسابك الآن
          </Link>
        </p>
      </div>
    </>
  );
}
