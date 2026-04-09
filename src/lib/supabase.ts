import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-side Service Client
 * Uses SERVICE_ROLE_KEY to bypass RLS. 
 * Use ONLY in trusted server environments (API routes, cron jobs).
 */
export function createServiceClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}


// Type definitions matching the schema
export type UserRole = 'teacher' | 'student';
export type QuizType = 'vocabulary' | 'grammar';
export type GrammarLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  role: UserRole;
  created_at: string;
}

export interface Classroom {
  id: string;
  teacher_id: string;
  name: string;
  description?: string;
  invite_code: string;
  created_at: string;
  // Joined fields
  teacher?: Profile;
  enrollment_count?: number;
}

export interface Word {
  id: string;
  classroom_id: string;
  added_by?: string;
  word: string;
  translation?: string;
  ipa?: string;
  pos?: string;
  example?: string;
  source_url?: string;
  status?: string;
  created_at: string;
  // Joined SRS for current user
  srs?: SRSProgress;
  isDue?: boolean;
  srsLevel?: number;
}

export interface SRSProgress {
  id: string;
  user_id: string;
  word_id: string;
  ease_factor: number;
  interval_days: number;
  review_count: number;
  next_review_date: string;
  last_reviewed_at?: string;
}

export interface QuizResult {
  id: string;
  user_id: string;
  classroom_id: string;
  quiz_type: QuizType;
  score: number;
  total_questions: number;
  accuracy: number;
  completed_at: string;
}

export interface GrammarExercise {
  id: string;
  classroom_id: string;
  topic: string;
  level: GrammarLevel;
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  created_by?: string;
  created_at: string;
}

export interface GrammarResult {
  id: string;
  user_id: string;
  exercise_id: string;
  chosen_answer: string;
  is_correct: boolean;
  time_taken_ms?: number;
  completed_at: string;
}

export interface StudentProgress {
  student_id: string;
  student_name: string;
  email: string;
  classroom_id: string;
  words_reviewed: number;
  avg_review_count: number;
  quizzes_taken: number;
  avg_quiz_accuracy: number;
  last_active?: string;
}
