/**
 * Migration script: Thêm cột image_url và image_source vào bảng global_dictionary
 * Chạy: node scripts/migrate-add-images.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function runMigration() {
    console.log('🔧 Đang chạy migration: thêm cột image_url và image_source...');

    // Supabase JS không hỗ trợ DDL trực tiếp, ta kiểm tra bằng cách thử upsert
    // Thay vào đó, dùng rpc hoặc kiểm tra bằng select
    try {
        // Thử đọc cột image_url
        const { error } = await supabase
            .from('global_dictionary')
            .select('image_url, image_source')
            .limit(1);

        if (!error) {
            console.log('✅ Cột image_url đã tồn tại! Không cần migration.');
            return;
        }

        if (error.message.includes('image_url') || error.message.includes('column')) {
            console.log('⚠️  Cột chưa tồn tại. Vui lòng chạy SQL sau trong Supabase Dashboard:');
            console.log('');
            console.log('─'.repeat(60));
            console.log(`ALTER TABLE global_dictionary 
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS image_source TEXT DEFAULT 'none';`);
            console.log('─'.repeat(60));
            console.log('');
            console.log('👉 Hướng dẫn:');
            console.log('   1. Vào https://supabase.com/dashboard → dự án của bạn');
            console.log('   2. Click "SQL Editor" ở sidebar trái');
            console.log('   3. Copy câu SQL ở trên vào và bấm "Run"');
            console.log('   4. Sau đó chạy lại script này để xác nhận');
            process.exit(1);
        }

        throw error;
    } catch (e) {
        if (e.message && (e.message.includes('image_url') || e.message.includes('column'))) {
            console.log('⚠️  Cần thêm cột. Xem hướng dẫn ở trên.');
        } else {
            console.error('❌ Lỗi không xác định:', e.message);
        }
        process.exit(1);
    }
}

runMigration();
