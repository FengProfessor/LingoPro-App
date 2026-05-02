// ==UserScript==
// @name         AI Auto Dict Bot (Clean Menu - V1.9.6)
// @namespace    http://tampermonkey.net/
// @version      1.9.6
// @description  Gỡ bỏ hoàn toàn giao diện trên màn hình, chỉ sử dụng Menu Tampermonkey cho gọn.
// @author       Antigravity
// @match        *://gemini.google.com/*
// @match        *://chatgpt.com/*
// @match        *://aistudio.google.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    if (window.top !== window.self) return;

    const CONFIG = {
        BASE_URL: 'http://localhost:3000', // Đổi thành URL Vercel khi deploy (e.g., https://your-app.vercel.app)
        BATCH_SIZE: 35,
        MAX_BATCHES: 30
    };

    const isAI = window.location.hostname.includes('aistudio');

    let isRunning = localStorage.getItem('auto_bot_running') === 'true';
    let batchCount = parseInt(localStorage.getItem('auto_bot_count') || '0', 10);
    let isReverse = localStorage.getItem('auto_bot_reverse') === 'true';

    // --- CHỈ DÙNG MENU TAMPERMONKEY ---
    GM_registerMenuCommand(`🚀 ${isRunning ? 'BOT ĐANG CHẠY...' : 'BẮT ĐẦU CÀO'}`, () => { startBot(); });
    GM_registerMenuCommand("🛑 DỪNG LẠI", () => { stopBot(); });
    GM_registerMenuCommand(`🔄 ĐẢO CHIỀU: ${isReverse ? 'Z-A' : 'A-Z'} (Tự reset trang)`, () => {
        isReverse = !isReverse;
        localStorage.setItem('auto_bot_reverse', isReverse);
        location.reload();
    });

    function startBot() {
        if (isRunning) return;
        isRunning = true; batchCount = 0;
        localStorage.setItem('auto_bot_running', 'true');
        localStorage.setItem('auto_bot_count', '0');
        processNextBatch();
    }

    function stopBot() {
        isRunning = false; localStorage.removeItem('auto_bot_running');
        location.reload();
    }

    function updateStatus(msg, wordsLeft = "") {
        document.title = `[Bot: ${msg}] (${batchCount}/${MAX_BATCHES}) ${wordsLeft ? '- Còn ' + wordsLeft : ''}`;
    }

    // --- LOGIC CÀO (GIỮ NGUYÊN) ---

    function deepQuerySelector(root, selector) {
        const el = root.querySelector(selector);
        if (el && el.offsetParent !== null) return el;
        const elements = root.querySelectorAll('*');
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].shadowRoot) {
                const found = deepQuerySelector(elements[i].shadowRoot, selector);
                if (found) return found;
            }
        }
        return null;
    }

    function deepClickRun(root) {
        if (!isAI) return false;
        const buttons = root.querySelectorAll('button, div[role="button"]');
        for (let b of buttons) {
            if (b.offsetParent !== null && b.innerText && b.innerText.includes("Run")) {
                b.click(); return true;
            }
        }
        const all = root.querySelectorAll('*');
        for (let el of all) {
            if (el.shadowRoot) {
                if (deepClickRun(el.shadowRoot)) return true;
            }
        }
        return false;
    }

    async function processNextBatch() {
        if (!isRunning) return;
        if (batchCount >= MAX_BATCHES) {
            localStorage.setItem('auto_bot_count', '0');
            await new Promise(r => setTimeout(r, 2000));
            window.location.reload();
            return;
        }
        try {
            const dir = isReverse ? 'desc' : 'asc';
            GM_xmlhttpRequest({
                method: "GET",
                url: `${CONFIG.BASE_URL}/api/bot/next-batch?size=${CONFIG.BATCH_SIZE}&direction=${dir}`,
                onload: async (res) => {
                    const data = JSON.parse(res.responseText);
                    await runPrompt(data.words, data.remaining);
                },
                onerror: () => { setTimeout(processNextBatch, 5000); }
            });
        } catch (e) { }
    }

    async function runPrompt(words, remaining) {
        if (!words || words.length === 0) { updateStatus("XONG!"); return; }
        const prompt = `SYSTEM ROLE: Từ bây giờ, bạn là một cỗ máy xuất dữ liệu từ điển chuyên nghiệp. Trả về JSON ARRAY RAW, không markdown.
OUTPUT FORMAT: [ { "word": "từ gốc", "familyWords": ["word (từ loại)"], "pronunciations": [{ "ipa": "/phiên âm/", "audio_uk": "...", "audio_us": "..." }], "results": [{ "meanings": [{ "pos": "...", "definition": "...", "example": "...", "collocations": [...] }] }] } ]
Bắt đầu xử lý: ` + words.join(', ');

        const inSelectors = isAI ? ['textarea', 'div[contenteditable="true"]', 'div[role="textbox"]'] : ['rich-textarea p', 'textarea'];
        let editor = null;
        for(let i = 0; i < 15; i++) {
            for(let sel of inSelectors) {
                editor = deepQuerySelector(document.documentElement, sel);
                if (editor) break;
            }
            if (editor) break;
            await new Promise(r => setTimeout(r, 500));
        }
        if (!editor) { isRunning = false; return; }
        editor.focus();
        if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') { editor.value = prompt; }
        else if (editor.isContentEditable) { document.execCommand('insertText', false, prompt); }
        else { editor.textContent = prompt; }
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 1000));
        if (isAI) deepClickRun(document.documentElement);
        else {
            let btn = deepQuerySelector(document.documentElement, '.send-button');
            if (btn) btn.click();
        }
        updateStatus("Đang rình AI...", remaining);
        pollResult(words);
    }

    function findLatestTargetJSON(text, currentWords) {
        let matches = [];
        let start = 0;
        while ((start = text.indexOf('[', start)) !== -1) {
            let end = start;
            while ((end = text.indexOf(']', end + 1)) !== -1) {
                let slice = text.substring(start, end + 1);
                try {
                    let parsed = JSON.parse(slice);
                    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].word && parsed[0].word !== "từ gốc") {
                        matches.push(parsed);
                        break;
                    }
                } catch(e) { }
            }
            start++;
        }
        if (matches.length > 0) {
            let latest = matches[matches.length - 1];
            let isMatch = false;
            for (let expected of currentWords) {
                let exp = expected.toLowerCase().trim();
                if (latest.some(item => item.word && item.word.toLowerCase().trim() === exp)) {
                    isMatch = true; break;
                }
            }
            if (isMatch) return latest;
        }
        return null;
    }

    async function pollResult(currentWords) {
        let startTime = Date.now();
        while (Date.now() - startTime < 120000) {
            await new Promise(r => setTimeout(r, 800));
            const fullText = document.body.innerText.toLowerCase();
            const isRealQuotaError = (fullText.includes("reached your quota") || fullText.includes("rate limit") || fullText.includes("try again later")) 
                                     && !fullText.includes('"word": "quotation"'); 

            if (isRealQuotaError) {
                updateStatus("HẾT QUOTA!");
                isRunning = false; localStorage.removeItem('auto_bot_running');
                GM_notification({ text: "Hết Quota rồi!", timeout: 10000 });
                return;
            }
            if (fullText.includes("bạn đã dừng") || fullText.includes("wrong")) { window.location.reload(); return; }

            const jsonData = findLatestTargetJSON(document.body.innerText, currentWords);
            if (jsonData) {
                await new Promise(resolve => {
                    GM_xmlhttpRequest({
                        method: "POST", url: `${CONFIG.BASE_URL}/api/bot/save-batch`,
                        data: JSON.stringify(jsonData), headers: { "Content-Type": "application/json" },
                        onload: () => resolve()
                    });
                });
                batchCount++;
                localStorage.setItem('auto_bot_count', batchCount.toString());
                await new Promise(r => setTimeout(r, 1000));
                processNextBatch();
                return;
            }
        }
        window.location.reload();
    }

    if (isRunning) setTimeout(processNextBatch, 2000);

})();
