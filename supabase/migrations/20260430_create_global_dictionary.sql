-- Tạo bảng global_dictionary để lưu trữ toàn bộ từ vựng
CREATE TABLE IF NOT EXISTS global_dictionary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    word TEXT UNIQUE NOT NULL,
    tags TEXT[] DEFAULT '{}', -- Lưu các bộ từ (TOEIC, IELTS, Oxford...)
    data JSONB NOT NULL, -- Dữ liệu từ vựng (bao gồm phát âm, định nghĩa, collocation, ví dụ)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index để tìm kiếm theo từ vựng nhanh hơn
CREATE INDEX IF NOT EXISTS idx_global_dictionary_word ON global_dictionary(word);

-- Kích hoạt Row Level Security (RLS)
ALTER TABLE global_dictionary ENABLE ROW LEVEL SECURITY;

-- Chính sách: Ai cũng có thể đọc (Public read access)
CREATE POLICY "Public read access for global_dictionary"
    ON global_dictionary FOR SELECT
    USING (true);

-- Chính sách: Cho phép INSERT nếu dùng service_role (mặc định service_role bỏ qua RLS nên không cần khai báo quá kỹ, nhưng cứ để an toàn nếu dùng public key)
CREATE POLICY "Allow anon insert for dictionary builder"
    ON global_dictionary FOR INSERT
    WITH CHECK (true); -- Mở tạm để chạy script từ local dễ dàng, hoặc bạn có thể đóng lại và chỉ dùng service_role
