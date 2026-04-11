'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { User, Copy, CheckCircle2, LogOut, Brain, ArrowLeft, Bell, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [telegramId, setTelegramId] = useState('');
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [isTestingTg, setIsTestingTg] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      setUser(user);

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);
      if (prof?.telegram_id) setTelegramId(prof.telegram_id);

      // Count words
      const res = await fetch(`/api/words?userId=${user.id}`);
      const data = await res.json();
      if (data.success) setWordCount(data.data?.length || 0);

      setIsLoading(false);
    };
    load();
  }, []);

  const copyUserId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    toast.success('User ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const saveSettings = async () => {
    if (!user?.id) return;
    setIsSavingTg(true);
    try {
      const { error } = await supabase.from('profiles').update({ 
        telegram_id: telegramId
      }).eq('id', user.id);
      if (error) throw error;
      toast.success('Settings updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings');
    } finally {
      setIsSavingTg(false);
    }
  };

  const testTelegramNotify = async () => {
    if (!user?.id) return;
    setIsTestingTg(true);
    try {
      const res = await fetch('/api/test/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Test notification sent! Check your Telegram.');
      } else {
        throw new Error(data.error || 'Failed to send test message');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error testing Telegram notification');
    } finally {
      setIsTestingTg(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-4">
        {/* Back */}
        <button 
          onClick={() => window.location.href = '/student'}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>

        {/* Profile card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">{profile?.full_name || 'Your Account'}</h1>
              <p className="text-slate-400 text-sm">{user?.email}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-primary">{wordCount}</div>
              <div className="text-xs text-slate-400 mt-0.5">Words saved</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-emerald-400">{profile?.role || 'student'}</div>
              <div className="text-xs text-slate-400 mt-0.5">Role</div>
            </div>
          </div>

          {/* User ID — key feature for Extension setup */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Chrome Extension Setup
            </p>
            <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
              To save words from any website, paste this ID into the Extension Settings:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-slate-300 font-mono bg-black/40 rounded-lg px-3 py-2.5 overflow-hidden text-ellipsis whitespace-nowrap border border-white/5">
                {user?.id}
              </code>
              <button
                onClick={copyUserId}
                className="flex items-center gap-1.5 bg-primary text-white text-xs font-black px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20 shrink-0"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Done!' : 'Copy'}
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2">
               <div className="text-[10px] text-slate-500">
                  <strong>1.</strong> Install Extension
               </div>
               <div className="text-[10px] text-slate-500">
                  <strong>2.</strong> Paste User ID
               </div>
               <div className="text-[10px] text-slate-500">
                  <strong>3.</strong> Set Server URL
               </div>
               <div className="text-[10px] text-slate-500 font-bold text-primary">
                  <strong>4.</strong> Start Catching!
               </div>
            </div>
          </div>
          
          {/* Telegram Notifications */}
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-4 relative overflow-hidden mt-4">
            <div className="absolute top-0 right-0 p-2 opacity-10">
              <Bell className="h-10 w-10 text-indigo-400" />
            </div>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400"></span>
              </span>
              Golden Time Bot Setup
            </p>
            <p className="text-[10px] text-slate-400 mb-3 leading-relaxed">
              Nhận thông báo tự động về Telegram khi tới <strong>Thời Điểm Vàng</strong> cần ôn tập. Điền Chat ID của bạn:
            </p>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Ví dụ: 123456789" 
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                className="flex-1 text-xs text-white font-mono bg-black/40 rounded-lg px-3 py-2.5 outline-none border border-white/5 focus:border-indigo-500 transition-colors placeholder:text-slate-600"
              />
              <button
                onClick={saveSettings}
                disabled={isSavingTg}
                className="flex items-center gap-1.5 bg-indigo-600/80 text-white text-xs font-black px-4 py-2.5 rounded-lg hover:bg-indigo-600 transition-all active:scale-95 border border-indigo-500/50 shadow-lg shadow-indigo-500/20 shrink-0 disabled:opacity-50"
              >
                {isSavingTg ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
              </button>
            </div>


            <button
              onClick={testTelegramNotify}
              disabled={isTestingTg || !telegramId}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold transition-all border border-indigo-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isTestingTg ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending Test...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" /> Test Telegram Notification
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl py-3 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
