'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, ChevronLeft, Shuffle, CheckCircle2, XCircle, Loader2, ArrowRight, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface WordItem {
  id: string;
  word: string;
  translation: string;
  ipa: string;
  pos: string;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildChoices(correct: WordItem, all: WordItem[]): string[] {
  const others = shuffle(all.filter(w => w.id !== correct.id))
    .slice(0, 3)
    .map(w => w.word); // English words as choices
  return shuffle([correct.word, ...others]);
}

function QuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClassroomId = searchParams.get('class');

  const [userId, setUserId] = useState<string | null>(null);
  const [classroomId, setClassroomId] = useState<string | null>(initialClassroomId);
  const [words, setWords] = useState<WordItem[]>([]);
  const [queue, setQueue] = useState<WordItem[]>([]);
  const [current, setCurrent] = useState<WordItem | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth'); return; }
        setUserId(user.id);

        const url = classroomId 
          ? `/api/words?classroomId=${classroomId}&userId=${user.id}`
          : `/api/words?userId=${user.id}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.success && data.data?.length >= 2) {
          if (!classroomId && data.classroomId) setClassroomId(data.classroomId);
          
          const all: WordItem[] = data.data;
          // Only use words with valid AI analysis
          const readyWords = all.filter(w => 
            w.translation && 
            !w.translation.includes('failed') && 
            !w.translation.includes('Analyzing')
          );
          
          if (readyWords.length < 2) {
            toast.error('Cần ít nhất 2 từ đã được AI phân tích để làm Quiz. Hãy Retry AI trước nhé!');
            setIsLoading(false);
            return;
          }
          
          const quizQueue = shuffle(readyWords).slice(0, 20);
          setWords(readyWords);
          setQueue(quizQueue);
          setTotal(quizQueue.length);
          setCurrent(quizQueue[0]);
          setChoices(buildChoices(quizQueue[0], readyWords));
        }
      } catch (err: any) {
        toast.error('Failed to load quiz.');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [initialClassroomId]);

  const handleSelect = async (choice: string) => {
    if (selected) return;
    setSelected(choice);
    const isCorrect = choice === current?.word; // Compare with English word
    const newScore = {
      correct: score.correct + (isCorrect ? 1 : 0),
      wrong: score.wrong + (isCorrect ? 0 : 1),
    };
    setScore(newScore);

    setTimeout(async () => {
      const newQueue = queue.slice(1);
      setQueue(newQueue);
      setCurrent(newQueue[0] || null);
      if (newQueue[0]) setChoices(buildChoices(newQueue[0], words));
      setSelected(null);
      setProgress(prev => prev + 1);

      if (newQueue.length === 0) {
        if (userId && (classroomId || initialClassroomId)) {
          try {
            await supabase.from('quiz_results').insert({
              user_id: userId,
              classroom_id: classroomId || initialClassroomId,
              quiz_type: 'vocabulary',
              score: newScore.correct,
              total_questions: total,
              accuracy: total > 0 ? newScore.correct / total : 0,
            });
          } catch (err) {
            console.error('Failed to save quiz result', err);
          }
        }
        setDone(true);
      }
    }, 1000);
  };

  const accuracy = total > 0 ? Math.round((score.correct / total) * 100) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-violet-600 font-bold animate-pulse text-lg">Generating quiz...</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-violet-50 via-white to-purple-50 p-8 font-sans text-slate-900">
        <div className="text-center space-y-4">
          <div className="text-8xl mb-6">
            {accuracy >= 90 ? '🦁' : accuracy >= 80 ? '🦁' : accuracy >= 60 ? '🦊' : '🐼'}
          </div>
          <h1 className="text-4xl font-black tracking-tight">Quiz Complete!</h1>
          <p className="text-slate-500 text-lg">Your knowledge is growing.</p>
        </div>

        <Card className="w-full max-w-sm border-none shadow-2xl bg-white/70 backdrop-blur-xl rounded-3xl overflow-hidden p-8">
           <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-4xl font-black text-violet-600">{accuracy}%</div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Accuracy</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-slate-800">{score.correct}/{total}</div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Score</div>
              </div>
           </div>
           
           <div className="space-y-3">
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                 <div className="h-full bg-emerald-500" style={{ width: `${(score.correct/total)*100}%` }} />
                 <div className="h-full bg-rose-400" style={{ width: `${(score.wrong/total)*100}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <span>Correct</span>
                <span>Wrong</span>
              </div>
           </div>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Link href="/student" className="flex-1">
            <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-2 hover:bg-slate-50">
              <ChevronLeft className="mr-2 h-5 w-5" /> Dashboard
            </Button>
          </Link>
          <Button className="flex-1 h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-lg shadow-violet-100 transition-all active:scale-95" onClick={() => window.location.reload()}>
            <RotateCcw className="mr-2 h-5 w-5" /> Retake
          </Button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50 font-sans text-center">
        <div className="w-20 h-20 bg-violet-50 rounded-3xl flex items-center justify-center mb-6 mx-auto">
           <Brain className="w-10 h-10 text-violet-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Not enough words</h2>
        <p className="text-slate-500 max-w-xs mx-auto mb-8">You need at least 2 words in your library to start a quiz.</p>
        <Link href="/student">
          <Button className="h-14 px-8 rounded-2xl font-black bg-violet-600">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <header className="flex items-center justify-between p-4 sm:p-6 bg-white/50 backdrop-blur-md sticky top-0 z-10">
        <Link href="/student">
          <Button variant="ghost" size="sm" className="gap-2 text-slate-500 hover:text-violet-600 font-bold rounded-xl transition-colors">
            <ChevronLeft className="h-5 w-5" /> Quit
          </Button>
        </Link>
        <div className="flex items-center gap-2 font-black text-slate-800">
          <Brain className="h-6 w-6 text-violet-600" />
          <span className="tracking-tight">MINIQUIZ</span>
        </div>
        <div className="px-4 py-1.5 bg-violet-600 text-white rounded-full text-xs font-black tracking-widest uppercase">
          {progress + 1} of {total}
        </div>
      </header>

      <div className="px-6 py-2">
        <div className="h-2 w-full bg-white rounded-full overflow-hidden shadow-sm border border-slate-100">
           <div className="h-full bg-violet-600 transition-all duration-700 rounded-full" style={{ width: `${(progress / total) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 gap-10">
        <Card className="w-full max-w-lg border-none shadow-2xl shadow-violet-100/50 rounded-[40px] bg-white overflow-hidden text-center p-12 relative">
           <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase text-slate-300 tracking-[0.2em] w-full">Chọn từ tiếng Anh đúng</div>
           {/* Show Vietnamese meaning as question */}
           <h2 className="text-5xl font-black tracking-tight text-slate-900 break-words w-full mb-6 mt-4">
             {current.translation}
           </h2>
           <div className="flex items-center justify-center gap-3">
             {current.pos && <Badge className="bg-violet-50 text-violet-600 border-none text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full">{current.pos}</Badge>}
             {current.ipa && (
               <span className="text-lg text-slate-400 font-mono tracking-wider">{current.ipa}</span>
             )}
           </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
          {choices.map((choice, i) => {
            const isCorrect = choice === current.word; // Correct English word
            const isSelected = selected === choice;
            
            let btnClasses = "h-20 rounded-3xl text-lg font-black transition-all duration-300 border-2 ";
            
            if (selected) {
              if (isCorrect) {
                 btnClasses += "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xl shadow-emerald-100 scale-105 z-10 ";
              } else if (isSelected) {
                 btnClasses += "bg-rose-50 border-rose-500 text-rose-700 ";
              } else {
                 btnClasses += "opacity-30 border-transparent ";
              }
            } else {
              btnClasses += "bg-white border-slate-100 text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:scale-[1.02] shadow-sm ";
            }

            return (
              <button
                key={`${choice}-${i}`}
                disabled={!!selected}
                onClick={() => handleSelect(choice)}
                className={btnClasses}
              >
                <span className="flex items-center justify-center gap-3">
                  {choice}
                  {selected && isCorrect && <CheckCircle2 className="h-6 w-6 text-emerald-600 animate-in zoom-in-50 duration-300" />}
                  {selected && isSelected && !isCorrect && <XCircle className="h-6 w-6 text-rose-600 animate-in zoom-in-50 duration-300" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
      </div>
    }>
      <QuizContent />
    </Suspense>
  );
}
