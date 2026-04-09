import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServiceClient } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// POST - Generate grammar exercises for a classroom using AI
export async function POST(req: Request) {
  try {
    const { classroomId, topic, level = 'beginner', count = 5 } = await req.json();
    if (!classroomId || !topic) {
      return NextResponse.json({ error: 'classroomId and topic are required' }, { status: 400 });
    }

    const prompt = `You are an expert English grammar teacher. Generate ${count} grammar exercises on the topic: "${topic}".
Level: ${level} (beginner = A1-A2, intermediate = B1-B2, advanced = C1-C2)

Return ONLY a valid JSON array (no markdown, no explanation) with this exact format:
[
  {
    "question": "Complete the sentence: She ___ (go) to school every day.",
    "options": ["go", "goes", "going", "went"],
    "correct_answer": "goes",
    "explanation": "With third-person singular subjects (she/he/it), we add -s/-es to the base verb in Present Simple.",
    "type": "fill_blank"
  }
]

Include a mix of:
1. Fill in the blank (type: "fill_blank")
2. Error correction - find the wrong word (type: "error_correction")  
3. Multiple choice (type: "multiple_choice")

Make sure explanations are in ENGLISH, clear and educational. Questions should be practical and relevant.
Return JSON array only, no other text.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json|```/g, '').trim();
    const exercises = JSON.parse(text);

    // Save to Supabase
    const supabase = createServiceClient();
    const toInsert = exercises.map((ex: any) => ({
      classroom_id: classroomId,
      topic,
      level,
      question: ex.question,
      options: ex.options,
      correct_answer: ex.correct_answer,
      explanation: ex.explanation,
    }));

    const { data, error } = await supabase
      .from('grammar_exercises')
      .insert(toInsert)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data, count: data.length });
  } catch (error: any) {
    console.error('Grammar API Error:', error);
    return NextResponse.json({ error: 'Failed to generate exercises', details: error.message }, { status: 500 });
  }
}

// GET - Fetch grammar exercises for a classroom
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const classroomId = searchParams.get('classroomId');

    if (!classroomId) {
      return NextResponse.json({ error: 'classroomId is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('grammar_exercises')
      .select('*')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
