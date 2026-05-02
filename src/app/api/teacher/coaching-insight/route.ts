import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { studentName, vms, lcs, tag, msg } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key is not configured" }, { status: 500 });
    }

    // Try gemini-flash-latest which often has higher free tier quota
    const model = genAI.getGenerativeModel({ model: "models/gemini-flash-latest" });

    const prompt = `
      Bạn là một trợ lý giáo viên tiếng Anh cao cấp trên nền tảng LingoPro. 
      Nhiệm vụ của bạn là soạn một tin nhắn tư vấn và khuyến khích học sinh dựa trên dữ liệu học tập sau:
      - Tên học sinh: ${studentName}
      - Chỉ số Thành thạo (VMS): ${vms}%
      - Chỉ số Chăm chỉ (LCS): ${lcs}%
      - Phân loại hiện tại (Tag): ${tag}
      - Nhận định sơ bộ: ${msg}

      Yêu cầu tin nhắn:
      1. Ngôn ngữ: Tiếng Việt, văn phong thân thiện, chuyên nghiệp, truyền cảm hứng.
      2. Nội dung: Đề cập trực tiếp các chỉ số này một cách khéo léo. Đưa ra 1 lời khuyên cụ thể để cải thiện.
      3. Độ dài: Xuống dòng hợp lý, ngắn gọn (dưới 100 từ).
      4. Hãy gọi tên học sinh một cách gần gũi (ví dụ: "Chào Tâm", "Chào An").

      Chỉ trả về nội dung tin nhắn, không thêm lời dẫn.
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      return NextResponse.json({ suggestion: text });
    } catch (apiError: any) {
      console.warn("Gemini API Tier Error, using fallback:", apiError.message);
      // Fallback to a high-quality template if API fails
      const fallback = `Chào ${studentName.split(' ')[0]}! Thầy thấy chỉ số thành thạo của bạn đang ở mức ${vms}%. Hãy cố gắng duy trì việc ôn tập ${lcs > 50 ? 'đều đặn như hiện tại' : 'thêm một chút mỗi ngày'} để đạt kết quả tốt nhất nhé!`;
      return NextResponse.json({ suggestion: fallback, isFallback: true });
    }
  } catch (error: any) {
    console.error("Critical API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
