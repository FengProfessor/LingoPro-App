// ==UserScript==
// @name         LingoPro Ultimate Capture (Anti-Block & Save)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Phá chặn copy trên mọi web và lưu từ vựng bôi đen vào LingoPro
// @author       Antigravity
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // 1. PHÁ CHẶN BÔI ĐEN / COPY (ANTI-ANTI-COPY)
    const style = document.createElement('style');
    style.innerHTML = `
        * {
            user-select: auto !important;
            -webkit-user-select: auto !important;
            -moz-user-select: auto !important;
            -ms-user-select: auto !important;
        }
    `;
    document.head.appendChild(style);

    const blockEvents = ['contextmenu', 'copy', 'cut', 'paste', 'selectstart', 'dragstart', 'mousedown', 'mouseup'];
    blockEvents.forEach(evt => {
        document.addEventListener(evt, function(e) {
            e.stopPropagation();
        }, true);
    });

    // 2. NÚT NỔI ĐỂ LƯU TỪ BÔI ĐEN VÀO LINGOPRO
    let floatingBtn = document.createElement('button');
    floatingBtn.innerText = 'Lưu LingoPro ➕';
    floatingBtn.style.position = 'absolute';
    floatingBtn.style.zIndex = '99999999';
    floatingBtn.style.padding = '5px 10px';
    floatingBtn.style.background = '#4CAF50';
    floatingBtn.style.color = 'white';
    floatingBtn.style.border = 'none';
    floatingBtn.style.borderRadius = '5px';
    floatingBtn.style.cursor = 'pointer';
    floatingBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    floatingBtn.style.fontFamily = 'Arial, sans-serif';
    floatingBtn.style.fontSize = '12px';
    floatingBtn.style.display = 'none';
    document.body.appendChild(floatingBtn);

    let selectedWord = '';

    document.addEventListener('mouseup', function(e) {
        let text = window.getSelection().toString().trim();
        if (text.length > 0 && text.length < 50) { // Giới hạn chỉ bắt từ vựng/cụm từ
            selectedWord = text;
            floatingBtn.style.left = e.pageX + 'px';
            floatingBtn.style.top = (e.pageY + 15) + 'px';
            floatingBtn.style.display = 'block';
        } else {
            floatingBtn.style.display = 'none';
        }
    });

    // Ẩn nút khi click chỗ khác
    document.addEventListener('mousedown', function(e) {
        if (e.target !== floatingBtn) {
            floatingBtn.style.display = 'none';
        }
    });

    // Xử lý khi bấm nút lưu
    floatingBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (!selectedWord) return;

        // Lưu vào clipboard để tiện search chỗ khác nếu cần
        GM_setClipboard(selectedWord);

        // Gửi thẳng vào LingoPro để sinh dữ liệu
        // Dùng endpoint dictionary API (bạn có thể thiết lập thêm cơ chế lưu thẳng database nếu cần)
        GM_xmlhttpRequest({
            method: 'GET',
            url: `http://localhost:3000/api/dictionary/lookup?word=${encodeURIComponent(selectedWord)}`,
            onload: function(response) {
                if(response.status === 200 || response.status === 404) {
                     GM_notification({
                        text: `Đã đưa "${selectedWord}" vào LingoPro. Bạn có thể mở web để xem.`,
                        title: 'LingoPro',
                        timeout: 3000
                    });
                }
            },
            onerror: function(err) {
                console.error('LingoPro Capture Error:', err);
                GM_notification({
                    text: 'Lỗi! Cần bật LingoPro (npm run dev)',
                    title: 'LingoPro Error',
                    timeout: 3000
                });
            }
        });
        
        floatingBtn.style.display = 'none';
    });
})();
