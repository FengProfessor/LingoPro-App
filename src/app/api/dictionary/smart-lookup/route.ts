import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * POST /api/dictionary/smart-lookup
 * Body: { word: string, context: string, meanings: Array<{definition: string, pos: string}> }
 * Returns: { bestIndex: number } — index of the most context-appropriate meaning
 */
export async function POST(req: Request) {
  try {
    const { word, context, meanings } = await req.json();

    if (!word || !context || !meanings?.length) {
      return NextResponse.json({ bestIndex: 0 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ bestIndex: 0 });
    }

    // Build numbered list of meanings for the prompt
    const meaningList = meanings
      .slice(0, 6) // Cap at 6 to keep prompt small & fast
      .map((m: any, i: number) => `${i + 1}. [${m.pos || "?"}] ${m.definition}`)
      .join("\n");

    const prompt = `You are an expert linguist. A user selected the word "${word}" in this exact context:

"${context}"

Available definitions:
${meaningList}

Task:
1. Analyze the grammatical role (Part of Speech) of "${word}" in the context (noun, verb, etc.).
2. Select the ONE definition that makes the most logical sense in this specific context.
3. Reply with ONLY the NUMBER (1, 2, 3...) of the correct definition. No explanations, no text, just the number.`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const picked = parseInt(text, 10);
      
      if (!isNaN(picked) && picked >= 1 && picked <= meanings.length) {
        return NextResponse.json({ bestIndex: picked - 1 }); // Convert to 0-based
      }
    } catch (apiErr: any) {
      console.warn("[smart-lookup] Gemini error, defaulting to 0:", apiErr.message);
    }

    return NextResponse.json({ bestIndex: 0 });
  } catch (error: any) {
    console.error("[smart-lookup] Error:", error.message);
    return NextResponse.json({ bestIndex: 0 });
  }
}
