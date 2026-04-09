'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { GrammarExercise } from '@/lib/supabase';
import {
  Brain, ChevronLeft, CheckCircle2, XCircle, Lightbulb, Loader2, Trophy
} from 'lucide-react';
import { toast } from 'sonner';

function GrammarContent() {
  const searchParams = useSearchParams();
  const classroomId = searchParams.get('class');
  const [exercises, setExercises] = useState<GrammarExercise[]>([]);
  const [current, setCurrent] = useState<GrammarExercise | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [done, setDone] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);

      if (!classroomId) { setIsLoading(false); return; }

      const res = await fetch(`/api/grammar?classroomId=${classroomId}`);
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        // Shuffle and take up to 10
        const shuffled = [...data.data].sort(() => Math.random() - 0.5).slice(0, 10);
        setExercises(shuffled);
        setCurrent(shuffled[0]);
      } else {
        toast.error('No grammar exercises available for this class yet.');
      }
      setIsLoading(false);
      setStartTime(Date.now());
    };
    init();
  }, [classroomId]);

  const handleAnswer = async (choice: string) => {
    if (selected) return;
    setSelected(choice);
    setShowExplanation(true);
    const isCorrect = choice === current?.correct_answer;
    setScore(prev => ({ ...prev, correct: prev.correct + (isCorrect ? 1 : 0), wrong: prev.wrong + (isCorrect ? 0 : 1) }));

    // Save result to Supabase
    if (userId && current) {
      await supabase.from('grammar_results').insert({
        user_id: userId,
        exercise_id: current.id,
        chosen_answer: choice,
        time_taken_ms: Date.now() - startTime,
      });
    }
  };

  const handleNext = () => {
    const nextIdx = qIndex + 1;
    if (nextIdx >= exercises.length) {
      setDone(true);
    } else {
      setQIndex(nextIdx);
      setCurrent(exercises[nextIdx]);
      setSelected(null);
      setShowExplanation(false);
      setStartTime(Date.now());
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Loading grammar exercises...</p>
        </div>
      </div>
    );
  }

  if (!classroomId || exercises.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-muted/40">
        <Brain className="h-16 w-16 text-muted-foreground/20" />
        <h2 className="text-xl font-bold">No exercises yet</h2>
        <p className="text-muted-foreground text-sm">Your teacher hasn&apos;t assigned grammar exercises for this class yet.</p>
        <Link href="/student"><button className="bg-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors">Back to Dashboard</button></Link>
      </div>
    );
  }

  const accuracy = score.correct + score.wrong > 0
    ? Math.round(score.correct / (score.correct + score.wrong) * 100)
    : 0;

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-primary/5 to-muted/40 p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">{accuracy >= 80 ? '🏆' : accuracy >= 60 ? '🎯' : '💪'}</div>
          <h1 className="text-3xl font-bold mb-2">Grammar Drill Complete!</h1>
          <p className="text-muted-foreground">Accuracy: <span className="text-primary font-bold text-xl">{accuracy}%</span></p>
        </div>
        <div className="bg-background border rounded-2xl p-6 w-full max-w-sm shadow-xl">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-emerald-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-emerald-600">{score.correct}</div>
              <div className="text-sm text-emerald-700 font-medium mt-1">✅ Correct</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-red-600">{score.wrong}</div>
              <div className="text-sm text-red-700 font-medium mt-1">❌ Wrong</div>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link href={`/student`}>
            <button className="border rounded-xl px-6 py-3 font-semibold hover:bg-muted transition-colors flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" /> Dashboard
            </button>
          </Link>
          <button onClick={() => window.location.reload()} className="bg-primary text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary/90 transition-colors">
            Practice Again
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 to-muted/40">
      {/* Header */}
      <header className="flex items-center justify-between p-4 sm:p-6">
        <Link href="/student">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        </Link>
        <div className="flex items-center gap-2 font-bold text-primary">
          <Brain className="h-5 w-5" /> Grammar Drill
        </div>
        <span className="text-sm font-mono font-bold text-muted-foreground bg-muted px-3 py-1 rounded-xl">
          {qIndex + 1} / {exercises.length}
        </span>
      </header>

      {/* Progress */}
      <div className="px-4 sm:px-8">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(qIndex / exercises.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 gap-6">
        {/* Score badges */}
        <div className="flex gap-3">
          <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> {score.correct}
          </span>
          <span className="bg-red-50 text-red-700 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> {score.wrong}
          </span>
        </div>

        {/* Question card */}
        <div className="w-full max-w-lg bg-background border rounded-2xl p-6 shadow-2xl shadow-primary/10">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">{current.topic} · {current.level}</p>
          <p className="text-lg font-bold text-foreground leading-relaxed">{current.question}</p>
        </div>

        {/* Choices */}
        <div className="grid grid-cols-1 gap-3 w-full max-w-lg">
          {current.options.map((opt, i) => {
            const isCorrect = opt === current.correct_answer;
            const isSelected = selected === opt;
            let cn = 'w-full text-left h-auto py-4 px-5 rounded-xl border text-sm font-medium transition-all duration-200 ';
            if (selected) {
              if (isCorrect) cn += 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-md ';
              else if (isSelected) cn += 'bg-red-50 border-red-400 text-red-800 ';
              else cn += 'opacity-40 border-muted ';
            } else {
              cn += 'bg-background hover:bg-primary/5 hover:border-primary/40 border-muted hover:shadow-sm ';
            }

            return (
              <button
                key={`${opt}-${i}`}
                className={cn}
                onClick={() => handleAnswer(opt)}
                disabled={!!selected}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{['A', 'B', 'C', 'D'][i]}</span>
                  <span>{opt}</span>
                  {selected && isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto shrink-0" />}
                  {selected && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-600 ml-auto shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExplanation && current.explanation && (
          <div className="w-full max-w-lg bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800 mb-1">Explanation</p>
                <p className="text-sm text-amber-900 leading-relaxed">{current.explanation}</p>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <button
            onClick={handleNext}
            className="w-full max-w-lg bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors animate-in fade-in duration-300"
          >
            {qIndex + 1 >= exercises.length ? 'See Results' : 'Next Question →'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function GrammarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <GrammarContent />
    </Suspense>
  );
}
