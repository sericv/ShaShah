'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Sparkles, User, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  
  // Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Username check states
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [usernameValError, setUsernameValError] = useState('');

  // Submit states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Live username validation
  useEffect(() => {
    if (!username.trim()) {
      setUsernameTaken(false);
      setUsernameValError('');
      return;
    }

    // Enforce constraints: alphanumeric start, english chars, digits, _ only, length 3-20, no spaces
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
        const { data, error } = await supabase
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
        console.warn('Username uniqueness query error:', err);
      } finally {
        setUsernameChecking(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [username]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim() || !username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMsg('الرجاء تعبئة جميع الحقول');
      return;
    }

    if (usernameValError) {
      setErrorMsg('اسم المعرف (Username) غير مستوف للشروط');
      return;
    }

    if (usernameTaken) {
      setErrorMsg('هذا المعرف مستخدم بالفعل');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('كلمتا المرور غير متطابقتين');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('يجب أن تكون كلمة المرور 6 أحرف على الأقل');
      return;
    }

    setLoading(true);

    try {
      // Sign up inside Supabase Auth
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            name: name.trim(),
            username: username.trim().toLowerCase()
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || 'فشل إنشاء الحساب، يرجى التحقق من البيانات');
      } else {
        setSuccessMsg('تم إنشاء الحساب بنجاح! جاري التوجيه...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
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
          أنشئ حسابك الجديد
          <Sparkles className="w-5 h-5 text-shasha-accent" />
        </h2>
        <p className="text-sm text-shasha-secondary">انضم لعالم شاشة لمشاركة المتعة والسينما مع أصدقائك</p>
      </div>

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        
        {/* Name Input */}
        <div>
          <label className="block text-xs font-semibold text-shasha-secondary mb-2">الأسم</label>
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="فاطمة ، فلاح"
              className="w-full pl-4 pr-10 py-3 rounded-xl glass-input text-right text-sm font-medium"
              required
            />
            <User className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-white/30" />
          </div>
        </div>

        {/* Username Input */}
        <div>
          <label className="block text-xs font-semibold text-shasha-secondary mb-2">اسم المستخدم</label>
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full pl-4 pr-10 py-3 rounded-xl glass-input text-left text-sm font-semibold tracking-wide"
              dir="ltr"
              required
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-white/30 font-bold select-none">@</span>
          </div>
          
          {/* Live validations status check */}
          {usernameChecking && (
            <span className="text-[10px] text-shasha-secondary block mt-1">جاري التحقق من توفر المعرف...</span>
          )}
          {!usernameChecking && username.trim() && !usernameValError && (
            usernameTaken ? (
              <span className="text-[10px] text-shasha-danger flex items-center gap-1 mt-1 justify-end">
                هذا المعرف مستخدم بالفعل
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
            ) : (
              <span className="text-[10px] text-shasha-success flex items-center gap-1 mt-1 justify-end">
                اسم المعرف متاح ومناسب للاستخدام
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            )
          )}
          {usernameValError && (
            <span className="text-[10px] text-shasha-warning block mt-1 leading-relaxed">{usernameValError}</span>
          )}
        </div>

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
          <label className="block text-xs font-semibold text-shasha-secondary mb-2">كلمة المرور</label>
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

        {/* Confirm Password Input */}
        <div>
          <label className="block text-xs font-semibold text-shasha-secondary mb-2">تأكيد كلمة المرور</label>
          <div className="relative">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
          disabled={loading || usernameChecking}
          className="w-full mt-2 py-3.5 rounded-xl bg-shasha-accent text-white font-semibold text-sm transition-all hover:bg-shasha-accent-hover active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-shasha-accent/20 cursor-pointer disabled:opacity-55"
        >
          {loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <>
              إنشاء الحساب
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
        <p className="text-xs text-shasha-secondary">
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="text-shasha-accent hover:text-shasha-accent-hover font-semibold transition-colors">
            سجل دخولك هنا
          </Link>
        </p>
      </div>
    </>
  );
}
