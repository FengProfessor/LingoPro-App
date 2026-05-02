-- 1. Hàm đếm số lượng từ đến hạn (Đã loại bỏ các từ bị lỗi AI)
CREATE OR REPLACE FUNCTION get_due_word_count(p_user_id UUID, p_classroom_id UUID)
RETURNS integer AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT count(*)
    INTO v_count
    FROM words w
    LEFT JOIN srs_progress s ON s.word_id = w.id AND s.user_id = p_user_id
    WHERE w.classroom_id = p_classroom_id
    AND (w.translation IS NULL OR w.translation NOT LIKE '%Analysis failed%') -- Không đếm từ bị lỗi
    AND (
        s.id IS NULL -- Từ mới chưa bao giờ học
        OR s.next_review_date <= (now() AT TIME ZONE 'UTC') -- Từ đã đến hạn ôn tập
    );
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Hàm lấy danh sách từ đến hạn (Đã loại bỏ các từ bị lỗi AI)
CREATE OR REPLACE FUNCTION get_due_words_list(p_user_id UUID, p_classroom_id UUID, p_limit integer)
RETURNS TABLE (
    id UUID,
    word TEXT,
    translation TEXT,
    ipa TEXT,
    pos TEXT,
    example TEXT,
    synonyms TEXT[],
    antonyms TEXT[],
    image_url TEXT,
    review_count integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.word,
        w.translation,
        w.ipa,
        w.pos,
        w.example,
        w.synonyms,
        w.antonyms,
        w.image_url,
        COALESCE(s.review_count, 0) as review_count
    FROM words w
    LEFT JOIN srs_progress s ON s.word_id = w.id AND s.user_id = p_user_id
    WHERE w.classroom_id = p_classroom_id
    AND (w.translation IS NULL OR w.translation NOT LIKE '%Analysis failed%') -- Không lấy từ bị lỗi
    AND (
        s.id IS NULL
        OR s.next_review_date <= (now() AT TIME ZONE 'UTC')
    )
    ORDER BY COALESCE(s.next_review_date, '1970-01-01'::timestamp) ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
