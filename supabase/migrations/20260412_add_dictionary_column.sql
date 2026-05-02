-- Thêm cột lưu trữ dữ liệu từ điển thô để phục vụ tính năng "Chọn nghĩa"
ALTER TABLE words ADD COLUMN IF NOT EXISTS dictionary_data JSONB;

-- Comment giải thích
COMMENT ON COLUMN words.dictionary_data IS 'Stores raw output from Dictionary API (e.g., dict.minhqnd.com) for manual meaning selection.';
