import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

// Lấy danh sách API Keys
const apiKeys = (process.env.GEMINI_API_KEY || "").split(',').map(k => k.trim()).filter(k => k.length > 0);

export async function POST(req: Request) {
  try {
    const { word } = await req.json();

    if (!word) {
      return NextResponse.json({ success: false, error: "Missing word" }, { status: 400 });
    }

    const cleanWord = word.trim().toLowerCase();
    const supabase = createServiceClient();

    // 1. Kiểm tra Cache trong global_dictionary trước
    const { data: cachedData } = await supabase
      .from('global_dictionary')
      .select('data')
      .eq('word', cleanWord)
      .maybeSingle();

    if (cachedData) {
      return NextResponse.json({ success: true, data: cachedData.data, cached: true });
    }

    // 2. Nếu không có cache, tiến hành gọi AI với cơ chế xoay vòng Key
    if (apiKeys.length === 0) {
      return NextResponse.json({ success: false, error: "No API Keys configured" }, { status: 500 });
    }

    // Trộn ngẫu nhiên danh sách key để phân bổ tải
    const shuffledKeys = [...apiKeys].sort(() => Math.random() - 0.5);
    
    let lastError = "";
    for (const key of shuffledKeys) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `You are an English-Vietnamese dictionary. Provide the dictionary entry for the English word "${cleanWord}".
Return ONLY a valid JSON object with this exact structure:
{
  "pronunciations": [
    { "ipa": "/IPA pronunciation here/" }
  ],
  "results": [
    {
      "meanings": [
        {
          "pos": "Từ loại (e.g. Danh từ, Động từ, Tính từ)",
          "definition": "Vietnamese meaning",
          "example": "An English example sentence",
          "collocations": ["collocation 1", "collocation 2"]
        }
      ]
    }
  ]
}
Include the 3 most common meanings. Do not include markdown tags like \`\`\`json. Just the raw JSON.`;

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        
        if (text.startsWith('```json')) text = text.replace(/```json/g, '');
        if (text.startsWith('```')) text = text.replace(/```/g, '');
        text = text.trim();

        const data = JSON.parse(text);

        // 3. Lưu vào Cache (Không cần đợi vì muốn trả kết quả nhanh)
        supabase.from('global_dictionary').insert({
            word: cleanWord,
            data: data,
            tags: ['ai-generated']
        }).then(({error}) => {
            if (error) console.error("[ai-lookup] Cache save error:", error.message);
        });

        return NextResponse.json({ success: true, data: data, cached: false });
      } catch (err: any) {
        lastError = err.message;
        if (err.message.includes("429")) {
          console.warn(`[ai-lookup] Key hết hạn mức, đang thử Key tiếp theo...`);
          continue; // Thử key tiếp theo trong danh sách
        }
        throw err; // Lỗi khác thì báo luôn
      }
    }

    return NextResponse.json({ success: false, error: `All API keys exhausted. Last error: ${lastError}` }, { status: 429 });

  } catch (error: any) {
    console.error("[ai-lookup] Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
