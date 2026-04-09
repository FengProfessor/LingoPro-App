'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brain, Mail, Lock, Eye, EyeOff, User, Loader2, GraduationCap, BookOpen, AlertCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'login' | 'signup';
type Role = 'student' | 'teacher';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<Role>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [debugError, setDebugError] = useState('');
  const [showManualRedirect, setShowManualRedirect] = useState(false);
  const router = useRouter();

  // Diagnostic check
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setDebugError('Missing Supabase configuration. Please check environment variables.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('Connecting to authentication server...');
    setDebugError('');
    setShowManualRedirect(false);

    // Timeout guard: 20 seconds
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setStatus('');
        setDebugError('Request timed out. Please check your internet connection.');
        toast.error('Authentication timed out.');
      }
    }, 20000);

    try {
      if (mode === 'signup') {
        setStatus('Creating your account...');
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role },
          },
        });
        if (error) throw error;
        toast.success('Account created! Please check your email to confirm.');
        setMode('login');
      } else {
        setStatus('Authenticating credentials...');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) throw error;
        
        setStatus('Success! Persisting session...');
        setShowManualRedirect(true);
        
        // Wait a bit for Supabase to persist the session in cookies/localStorage
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('Session not found after success. This might be a cookie issue.');
          setStatus('Logged in successfully, but session not detected by browser yet.');
          setDebugError('Notice: Your browser has not saved the session yet. Please click the button below or try disabling Incognito.');
        } else {
          setStatus('Session verified! Redirecting...');
          // Hard redirect is often more reliable for auth state transitions in Next.js
          window.location.href = '/student';
        }
      }
    } catch (err: any) {
      console.error('CRITICAL Auth Error:', err);
      const msg = err.message || 'Authentication failed.';
      setDebugError(`ERROR: ${msg}`);
      toast.error(msg);
      setStatus(''); 
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setStatus('Initializing Google sign-in...');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setDebugError(error.message);
      toast.error(error.message);
      setStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 text-white">
            <div className="bg-primary/20 p-2.5 rounded-xl border border-primary/30">
              <Brain className="h-7 w-7 text-primary" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">LingoPro</span>
          </Link>
          <p className="text-slate-400 mt-2 text-sm">
            {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create your account to get started.'}
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl transition-all">
          <div className="flex bg-white/5 rounded-xl p-1 mb-6">
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setDebugError(''); setShowManualRedirect(false); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  mode === m ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {debugError && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-rose-200 leading-relaxed">{debugError}</p>
            </div>
          )}

          {showManualRedirect ? (
            <div className="space-y-4 py-4 animate-in fade-in zoom-in-95 duration-300 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                <ArrowRight className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-white font-bold text-lg">Login Confirmed!</h3>
              <p className="text-slate-400 text-sm">If you're not redirected automatically, click the button below:</p>
              <button
                onClick={() => window.location.href = '/student'}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold h-12 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setStatus('')}
                className="text-slate-500 text-xs hover:text-slate-300 underline"
              >
                Stay here / Logout
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="relative text-white">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary/60"
                  />
                </div>
              )}
              <div className="relative text-white">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary/60"
                />
              </div>
              <div className="relative text-white">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary/60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
                
                {status && (
                  <p className="text-center text-[10px] font-bold text-primary animate-pulse uppercase tracking-widest mt-3">
                    {status}
                  </p>
                )}
              </div>
            </form>
          )}

          {!showManualRedirect && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-slate-500 px-2 font-medium">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <button
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 rounded-xl h-12 text-sm font-semibold text-slate-300 hover:bg-white/10 transition-all active:scale-95"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
