'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Sparkles, Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('الرجاء إدخال البريد الإلكتروني');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setErrorMsg(error.message || 'فشل إرسال طلب استعادة كلمة المرور');
      } else {
        setSuccessMsg('تم إرسال رابط استعادة كلمة المرور لبريدك الإلكتروني بنجاح!');
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
          استعادة كلمة المرور
          <Sparkles className="w-5 h-5 text-shasha-accent" />
        </h2>
        <p className="text-sm text-shasha-secondary">أدخل بريدك الإلكتروني وسنرسل لك رابط استعادة كلمة المرور</p>
      </div>

      <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
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
              إرسال رابط الاستعادة
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

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-xs font-semibold text-shasha-success bg-shasha-success/10 border border-shasha-success/20 px-3 py-2 rounded-lg text-center"
        >
          {successMsg}
        </motion.div>
      )}

      <div className="mt-6 text-center border-t border-white/5 pt-4">
        <Link href="/login" className="text-xs text-shasha-secondary hover:text-white transition-colors flex items-center justify-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          العودة لتسجيل الدخول
        </Link>
      </div>
    </>
  );
}
