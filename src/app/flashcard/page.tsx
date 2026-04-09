'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, ChevronLeft, Volume2, RotateCcw, CheckCircle2, Loader2, RefreshCw, Snail } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface WordItem {
  id: string;
  word: string;
  translation: string;
  ipa: string;
  pos: string;
  example: string;
  isDue: boolean;
  reviewCount: number;
  srsLevel: number;
  mastery: number;
  srs: any;
}

function FlashcardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClassroomId = searchParams.get('class');

  const [userId, setUserId] = useState<string | null>(null);
  const [classroomId, setClassroomId] = useState<string | null>(initialClassroomId);
  const [queue, setQueue] = useState<WordItem[]>([]);
  const [current, setCurrent] = useState<WordItem | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [sessionResults, setSessionResults] = useState({ easy: 0, hard: 0, forgot: 0 });
  const [isRetryingAI, setIsRetryingAI] = useState(false);
  
  const [spellingInput, setSpellingInput] = useState('');
  const [spellingError, setSpellingError] = useState(false);
  const [hasSpelledCorrectly, setHasSpelledCorrectly] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth'); return; }
        setUserId(user.id);

        // Fetch words (and discover personal classroomId if missing)
        const url = classroomId 
          ? `/api/words?classroomId=${classroomId}&userId=${user.id}`
          : `/api/words?userId=${user.id}`;
        
        const res = await fetch(url);
        const data = await res.json();

        if (data.success && data.data) {
          if (!classroomId && data.classroomId) setClassroomId(data.classroomId);

          const all: WordItem[] = data.data;
          const due = all.filter(w => w.isDue);
          // If no words are due, show all words (no cap)
          const studyQueue = due.length > 0 ? due : all;
          
          if (studyQueue.length === 0) {
            setIsLoading(false);
            return;
          }

          setQueue([...studyQueue]);
          setCurrent(studyQueue[0] || null);
          setTotal(studyQueue.length);
        }
      } catch (err: any) {
        toast.error('Failed to load flashcards.');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [initialClassroomId]);

  const speak = (text: string, rate: number = 1.0) => {
    // Cancel any ongoing speech to avoid overlapping
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate; // 1.0 is normal, 0.6 is slow
    window.speechSynthesis.speak(u);
  };

  const handleRate = async (quality: 0 | 3 | 4 | 5) => {
    if (!current || !userId) return;

    // 1. Snapshot for the background sync
    const currentWordId = current.id;
    const currentWord = current;

    setIsSwapping(true);
    setSessionResults(prev => ({
      easy: (quality === 5 || quality === 4) ? prev.easy + 1 : prev.easy,
      hard: quality === 3 ? prev.hard + 1 : prev.hard,
      forgot: quality === 0 ? prev.forgot + 1 : prev.forgot,
    }));
 
    const newQueue = queue.slice(1);
    if (quality === 0) newQueue.push(currentWord); 
 
    setQueue(newQueue);
    setCurrent(newQueue[0] || null);
    setFlipped(false);
    setProgress(prev => Math.min(prev + 1, total));
    setSpellingInput('');
    setSpellingError(false);
    setHasSpelledCorrectly(false);
    
    // Briefly disable transition to "warp" to front of next card
    setTimeout(() => setIsSwapping(false), 50);

    if (newQueue.length === 0) {
      setDone(true);
    }

    // 3. BACKGROUND SYNC (No 'await' to keep UI fast)
    fetch('/api/words/srs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, wordId: currentWordId, quality: quality as 0|3|4|5 }),
    }).catch(err => {
      console.error('Failed to save SRS result:', err);
      // We don't rollback to avoid UI flickering, just log it.
    });

    if (newQueue.length === 0) {
      // Background save stats
      (async () => {
        try {
          const finalEasy = quality === 5 ? sessionResults.easy + 1 : sessionResults.easy;
          await fetch('/api/quiz/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              classroomId,
              score: finalEasy,
              totalQuestions: total,
              quizType: 'vocabulary'
            }),
          });
        } catch (err) {
          console.error('Failed to save session accuracy', err);
        }
      })();
    }
  };

  const handleRetryAI = async () => {
    if (!classroomId || isRetryingAI) return;
    setIsRetryingAI(true);
    try {
      const res = await fetch('/api/words/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId }),
      });
      const data = await res.json();
      toast.success(`✅ AI refreshed ${data.refreshed} word(s)! Reloading...`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Retry failed. Please try again.');
    } finally {
      setIsRetryingAI(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 font-sans">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-indigo-600 font-bold animate-pulse text-lg">Preparing your session...</p>
        </div>
      </div>
    );
  }

  if (done || !current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-8 font-sans">
        <div className="text-center space-y-3">
          <div className="text-7xl mb-6">✨</div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Session Complete!</h1>
          <p className="text-slate-500 text-lg font-medium">Your progress has been synchronized.</p>
        </div>
        
        <Card className="w-full max-w-sm border-none shadow-2xl bg-white/70 backdrop-blur-xl rounded-3xl overflow-hidden">
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                 { label: 'Easy', val: sessionResults.easy, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                 { label: 'Hard', val: sessionResults.hard, color: 'text-amber-600', bg: 'bg-amber-50' },
                 { label: 'Forgot', val: sessionResults.forgot, color: 'text-rose-600', bg: 'bg-rose-50' }
              ].map(r => (
                <div key={r.label} className={`${r.bg} rounded-2xl p-4 transition-transform hover:scale-105 underline-offset-4`}>
                  <div className={`text-2xl font-black ${r.color}`}>{r.val}</div>
                  <div className={`text-[10px] uppercase font-black tracking-widest ${r.color} mt-1 opacity-70`}>{r.label}</div>
                </div>
              ))}
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-indigo-500 rounded-full" style={{ width: '100%' }} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Button 
            variant="outline" 
            className="flex-1 h-14 rounded-2xl font-bold border-2 hover:bg-slate-50 transition-all"
            onClick={() => {
              setIsLoading(true);
              window.location.href = '/student'; // Force a full fresh load
            }}
          >
            <ChevronLeft className="mr-2 h-5 w-5" /> Dashboard
          </Button>
          <Button className="flex-1 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95" onClick={() => window.location.reload()}>
            <RotateCcw className="mr-2 h-5 w-5" /> Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="flex items-center justify-between p-4 sm:p-6 bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <Link href="/student">
          <Button variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-indigo-600 font-bold rounded-xl transition-colors">
            <ChevronLeft className="h-5 w-5" /> Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-2 font-black text-slate-800">
          <Brain className="h-6 w-6 text-indigo-600" />
          <span className="tracking-tight">FLASHSESSION</span>
        </div>
        <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-black tracking-widest">
          {Math.min(progress + 1, total)} / {total}
        </div>
      </header>

      <div className="px-6 mt-2">
        <div className="h-2.5 w-full bg-white rounded-full overflow-hidden shadow-sm border border-slate-100">
           <div className="h-full bg-indigo-600 transition-all duration-500 rounded-full" style={{ width: `${(progress / total) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div
          className={`w-full max-w-[420px] ${current.srsLevel >= 2 && !hasSpelledCorrectly ? '' : 'cursor-pointer'}`}
          style={{ perspective: '1200px' }}
          onClick={() => {
            if (current.srsLevel < 2 || hasSpelledCorrectly) {
              setFlipped(!flipped);
            }
          }}
        >
          <div
            className={`relative w-full ${isSwapping ? '' : 'transition-transform duration-[200ms] ease-out'}`}
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '480px',
            }}
          >
            {/* Front */}
            <Card className="absolute inset-0 border-none shadow-2xl shadow-indigo-100 flex flex-col items-center justify-center p-10 text-center rounded-[40px] bg-white border-b-8 border-slate-200"
              style={{ backfaceVisibility: 'hidden' }}>
              <CardContent className="p-0 w-full flex flex-col items-center gap-6">
                <Badge className="bg-amber-50 text-amber-600 border-none text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
                  {current.isDue ? '⚡ REVIEW TIME' : '📖 NEW WORD'}
                </Badge>
                {/* Only use typing mode if word is fully analyzed */}
                {current.srsLevel >= 2 && !hasSpelledCorrectly &&
                  current.translation && !current.translation.includes('failed') && !current.translation.includes('Analyzing') ? (
                  // Active Recall Typing Mode (MochiVocab Style)
                  <div className="w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer shadow-inner disabled:opacity-50"
                           onClick={(e) => { e.stopPropagation(); speak(current.word, 1.0); }}>
                        <Volume2 className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer shadow-inner"
                           title="Slow pronunciation"
                           onClick={(e) => { e.stopPropagation(); speak(current.word, 0.6); }}>
                        <Snail className="h-6 w-6 text-amber-600 font-black" />
                      </div>
                    </div>
                    
                     <p className="text-xl font-bold text-slate-800 break-words">{current.translation}</p>
                     {current.ipa && <p className="text-sm font-mono text-slate-400">{current.ipa}</p>}

                    <div className="w-full relative mt-4">
                      <input 
                        type="text" 
                        autoFocus
                        value={spellingInput}
                        onChange={(e) => {
                          setSpellingInput(e.target.value);
                          setSpellingError(false);
                        }}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter') {
                             e.preventDefault();
                             if (spellingInput.trim().toLowerCase() === current.word.toLowerCase()) {
                               setHasSpelledCorrectly(true);
                               speak(current.word, 1.0);
                               toast.success('Perfect! Flip the card to proceed.', { position: 'top-center' });
                               setTimeout(() => setFlipped(true), 600);
                             } else {
                               setSpellingError(true);
                               toast.error('Incorrect, try again!', { position: 'top-center' });
                               // Optional: speak(current.word); if we want to give auditory hint
                             }
                           }
                        }}
                        placeholder="Nghe và gõ lại..."
                        className={`w-full text-center text-3xl font-black p-4 rounded-2xl border-4 focus:outline-none transition-colors
                          ${spellingError ? 'border-rose-400 bg-rose-50 text-rose-600 animate-shake' : 'border-slate-200 bg-slate-50 focus:border-indigo-500'}`}
                      />
                    </div>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (spellingInput.trim().toLowerCase() === current.word.toLowerCase()) {
                           setHasSpelledCorrectly(true);
                           speak(current.word, 1.0);
                           setTimeout(() => setFlipped(true), 600);
                        } else {
                           setSpellingError(true);
                        }
                      }}
                      className="w-full mt-4 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold text-lg shadow-xl shadow-indigo-100"
                    >
                      Kiểm Tra
                    </Button>
                  </div>
                ) : (
                  // Passive Recognition Mode (Level 1) or After Spelled Correctly
                  <>
                    <h2 className="text-5xl font-black tracking-tight text-slate-900 break-words w-full px-2">
                      {current.translation}
                    </h2>
                    
                    <div className="mt-8 flex flex-col items-center opacity-40">
                       <div className="w-8 h-8 rounded-full border-2 border-slate-300 flex items-center justify-center animate-bounce">
                          <div className="w-1 h-3 bg-slate-300 rounded-full" />
                       </div>
                       <p className="text-xs font-black text-slate-400 mt-2 uppercase tracking-tighter">Lật thẻ xem từ tiếng Anh</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Back */}
            <Card className="absolute inset-0 border-none shadow-2xl shadow-indigo-100 flex flex-col items-center justify-center p-10 text-center rounded-[40px] bg-indigo-600 border-b-8 border-indigo-800"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <CardContent className="p-0 w-full flex flex-col items-center gap-4 text-white">
                <div className="flex flex-col items-center gap-2">
                   <h3 className="text-7xl font-black tracking-tight leading-tight mb-2">
                     {current.word}
                   </h3>
                   {current.ipa && <p className="text-2xl text-indigo-200 font-mono tracking-widest">{current.ipa}</p>}
                   <p className="text-lg text-indigo-200 mt-2">{current.translation}</p>
                </div>
                
                <div className="flex items-center gap-4 mb-4">
                  {current.pos && <Badge className="bg-white/20 text-white border-none text-[10px] font-black uppercase tracking-widest px-3">{current.pos}</Badge>}
                  
                  {/* Normal Speed */}
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer group"
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         const englishWord = /[a-zA-Z]/.test(current.word) && !/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/.test(current.word)
                           ? current.word : current.translation;
                         speak(englishWord, 1.0); 
                       }}>
                    <Volume2 className="h-6 w-6 text-white" />
                  </div>

                  {/* Slow Speed */}
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform cursor-pointer group border border-white/20"
                       title="Slow pronunciation"
                       onClick={(e) => { 
                         e.stopPropagation(); 
                         const englishWord = /[a-zA-Z]/.test(current.word) && !/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/.test(current.word)
                           ? current.word : current.translation;
                         speak(englishWord, 0.6); 
                       }}>
                    <Snail className="h-6 w-6 text-white/80" />
                  </div>
                </div>

                {current.example && (
                  <div className="bg-white/10 rounded-3xl p-6 text-left border border-white/10 max-w-sm backdrop-blur-sm">
                    <p className="text-base font-medium leading-relaxed italic border-l-4 border-white/30 pl-4">
                      &quot;{current.example}&quot;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Rating buttons */}
        <div className="w-full max-w-[420px] min-h-[80px]">
          {flipped ? (
            <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-8 duration-500 cubic-bezier(0.16, 1, 0.3, 1)">
              <button
                className="flex-1 h-20 rounded-[28px] bg-white border-b-4 border-rose-200 text-rose-600 font-black text-xs uppercase tracking-tighter hover:bg-rose-50 hover:border-rose-300 transition-all active:translate-y-1 active:border-b-0"
                onClick={() => handleRate(0)}
              >
                Forgot
              </button>
              <button
                className="flex-1 h-20 rounded-[28px] bg-white border-b-4 border-amber-200 text-amber-600 font-black text-xs uppercase tracking-tighter hover:bg-amber-50 hover:border-amber-300 transition-all active:translate-y-1 active:border-b-0"
                onClick={() => handleRate(3)}
              >
                Hard
              </button>
              <button
                className="flex-1 h-20 rounded-[28px] bg-white border-b-4 border-blue-200 text-blue-600 font-black text-xs uppercase tracking-tighter hover:bg-blue-50 hover:border-blue-300 transition-all active:translate-y-1 active:border-b-0"
                onClick={() => handleRate(4)}
              >
                Good
              </button>
              <button
                className="flex-1 h-20 rounded-[28px] bg-indigo-600 border-b-4 border-indigo-800 text-white font-black text-xs uppercase tracking-tighter shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:translate-y-1 active:border-b-0"
                onClick={() => handleRate(5)}
              >
                Mastered
              </button>
            </div>
          ) : (
            <button
              className="w-full h-20 rounded-[28px] bg-white border-b-4 border-slate-200 text-slate-800 font-black text-lg shadow-sm hover:bg-slate-50 transition-all active:translate-y-1 active:border-b-0"
              onClick={() => setFlipped(true)}
            >
              Flip Card
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FlashcardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
      </div>
    }>
      <FlashcardContent />
    </Suspense>
  );
}
