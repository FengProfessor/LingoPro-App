'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { GrammarExercise } from '@/lib/supabase';
import {
  ChevronLeft, Plus, Loader2, Brain, BookOpen, Trash2, BarChart3, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

const TOPICS = [
  'Present Simple', 'Present Continuous', 'Past Simple', 'Past Continuous',
  'Present Perfect', 'Future Simple (will)', 'Future Plans (going to)',
  'Modal Verbs (can/could/should/must)', 'Conditionals (If clauses)', 'Passive Voice',
  'Reported Speech', 'Articles (a/an/the)', 'Prepositions', 'Comparative & Superlative',
  'Relative Clauses',
];

export default function TeacherGrammarPage() {
  const params = useParams();
  const classroomId = params.classroomId as string;
  const [exercises, setExercises] = useState<GrammarExercise[]>([]);
  const [classroom, setClassroom] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [count, setCount] = useState(5);

  useEffect(() => {
    const loadData = async () => {
      const { data: cls } = await supabase.from('classrooms').select('*').eq('id', classroomId).single();
      setClassroom(cls);
      const res = await fetch(`/api/grammar?classroomId=${classroomId}`);
      const data = await res.json();
      if (data.success) setExercises(data.data);
      setIsLoading(false);
    };
    if (classroomId) loadData();
  }, [classroomId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = customTopic.trim() || selectedTopic;
    if (!topic) { toast.error('Please select or enter a topic.'); return; }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/grammar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId, topic, level, count }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setExercises([...data.data, ...exercises]);
      toast.success(`Generated ${data.count} exercises on "${topic}"! 🎉`);
      setCustomTopic('');
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    }
    setIsGenerating(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('grammar_exercises').delete().eq('id', id);
    setExercises(exercises.filter(e => e.id !== id));
    toast.success('Exercise deleted.');
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const groupedByTopic = exercises.reduce((acc, ex) => {
    if (!acc[ex.topic]) acc[ex.topic] = [];
    acc[ex.topic].push(ex);
    return acc;
  }, {} as Record<string, GrammarExercise[]>);

  return (
    <div className="min-h-screen bg-muted/40 font-sans">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b h-14 flex items-center justify-between px-6">
        <Link href="/teacher" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> {classroom?.name || 'Teacher'}
        </Link>
        <div className="flex items-center gap-2 font-bold text-primary">
          <Brain className="h-5 w-5" /> Grammar Exercises
        </div>
        <span className="text-xs text-muted-foreground">{exercises.length} exercises total</span>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Generate form */}
        <div className="bg-background border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary/10 p-2 rounded-xl"><Sparkles className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="font-bold">Generate New Exercises</h2>
              <p className="text-xs text-muted-foreground">AI will create grammar drills for your students.</p>
            </div>
          </div>
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Topic grid */}
            <div>
              <p className="text-sm font-medium mb-2">Choose a topic:</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {TOPICS.map(t => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => { setSelectedTopic(t); setCustomTopic(''); }}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                      selectedTopic === t && !customTopic ? 'bg-primary text-white border-primary' : 'border-muted-foreground/20 hover:border-primary/40 text-muted-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customTopic}
                onChange={e => { setCustomTopic(e.target.value); setSelectedTopic(''); }}
                placeholder="or type a custom topic..."
                className="w-full border rounded-xl px-4 py-2 text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Level</label>
                <select
                  value={level}
                  onChange={e => setLevel(e.target.value as any)}
                  className="w-full border rounded-xl px-4 py-2 text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="beginner">Beginner (A1-A2)</option>
                  <option value="intermediate">Intermediate (B1-B2)</option>
                  <option value="advanced">Advanced (C1-C2)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Number of questions</label>
                <select
                  value={count}
                  onChange={e => setCount(Number(e.target.value))}
                  className="w-full border rounded-xl px-4 py-2 text-sm bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} questions</option>)}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isGenerating || (!selectedTopic && !customTopic)}
              className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
          </form>
        </div>

        {/* Exercise list by topic */}
        {Object.entries(groupedByTopic).map(([topic, exs]) => (
          <div key={topic} className="bg-background border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="font-bold">{topic}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">{exs[0]?.level}</span>
                <span className="text-xs text-muted-foreground">{exs.length} questions</span>
              </div>
            </div>
            <div className="divide-y">
              {exs.map((ex, i) => (
                <div key={ex.id} className="flex items-start gap-4 px-5 py-3 hover:bg-muted/20 group transition-colors">
                  <span className="text-xs font-bold text-muted-foreground mt-1 w-5 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed">{ex.question}</p>
                    <p className="text-xs text-emerald-600 font-semibold mt-1">✓ {ex.correct_answer}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(ex.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-muted-foreground hover:text-destructive rounded-lg"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {exercises.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-semibold">No exercises yet.</p>
            <p className="text-sm">Generate your first grammar drill above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
