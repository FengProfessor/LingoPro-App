// ==UserScript==
// @name         LingoPro Universal Harvester (V2.0)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Cào đa nguồn: AI (Gemini/ChatGPT) & Từ điển (Cambridge).
// @author       Antigravity
// @match        *://gemini.google.com/*
// @match        *://chatgpt.com/*
// @match        *://aistudio.google.com/*
// @match        *://dictionary.cambridge.org/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    if (window.top !== window.self) return;

    const CONFIG = {
        BASE_URL: 'http://localhost:3000',
        BATCH_SIZE: 35,
        MAX_BATCHES: 30
    };

    const host = window.location.hostname;
    const isAI = host.includes('aistudio') || host.includes('gemini') || host.includes('chatgpt');
    const isCambridge = host.includes('dictionary.cambridge.org');

    let isRunning = localStorage.getItem('auto_bot_running') === 'true';
    let harvesterWords = JSON.parse(localStorage.getItem('harvester_words') || '[]');
    let batchCount = parseInt(localStorage.getItem('auto_bot_count') || '0', 10);
    let isReverse = localStorage.getItem('auto_bot_reverse') === 'true';

    // --- MENU LỆNH ---
    GM_registerMenuCommand(`🚀 ${isRunning ? 'BOT ĐANG CHẠY...' : 'BẮT ĐẦU CÀO AI'}`, () => { startAI(); });
    GM_registerMenuCommand("📥 NHẬP DANH SÁCH TỪ (Bulk Harvest)", () => { promptBulkWords(); });
    GM_registerMenuCommand("🛑 DỪNG LẠI", () => { stopBot(); });
    GM_registerMenuCommand(`🔄 ĐẢO CHIỀU AI: ${isReverse ? 'Z-A' : 'A-Z'}`, () => {
        isReverse = !isReverse;
        localStorage.setItem('auto_bot_reverse', isReverse);
        location.reload();
    });

    function promptBulkWords() {
        const input = prompt("Dán danh sách từ (cách nhau bằng dấu phẩy hoặc xuống dòng):");
        if (!input) return;
        const words = input.split(/[\n,]+/).map(w => w.trim()).filter(w => w.length > 0);
        if (words.length > 0) {
            localStorage.setItem('harvester_words', JSON.stringify(words));
            localStorage.setItem('auto_bot_running', 'true');
            window.location.href = `https://dictionary.cambridge.org/dictionary/english/${words[0]}`;
        }
    }

    function startAI() {
        if (isRunning) return;
        isRunning = true; batchCount = 0;
        localStorage.setItem('auto_bot_running', 'true');
        localStorage.setItem('auto_bot_count', '0');
        processNextBatch();
    }

    function stopBot() {
        localStorage.removeItem('auto_bot_running');
        localStorage.removeItem('harvester_words');
        location.reload();
    }

    function updateStatus(msg, wordsLeft = "") {
        document.title = `[Bot: ${msg}] ${wordsLeft ? '- Còn ' + wordsLeft : ''}`;
    }

    // --- ENGINE 1: CAMBRIDGE DICTIONARY ---
    if (isCambridge && isRunning && harvesterWords.length > 0) {
        window.addEventListener('load', async () => {
            await new Promise(r => setTimeout(r, 2000));
            const word = harvesterWords[0];
            const data = extractCambridgeData(word);
            if (data) await saveToLingoPro([data]);

            const remaining = harvesterWords.slice(1);
            localStorage.setItem('harvester_words', JSON.stringify(remaining));
            if (remaining.length > 0) {
                window.location.href = `https://dictionary.cambridge.org/dictionary/english/${remaining[0]}`;
            } else {
                localStorage.removeItem('auto_bot_running');
                GM_notification({ text: "Xong danh sách!", title: "LingoPro" });
            }
        });
    }

    function extractCambridgeData(targetWord) {
        try {
            const headword = document.querySelector('.headword .hw')?.innerText || targetWord;
            const pos = document.querySelector('.pos-header .pos')?.innerText || 'word';
            const ipa = document.querySelector('.pos-header .ipa')?.innerText || '';
            const defBlock = document.querySelector('.def-block');
            if (!defBlock) return null;
            const definition = defBlock.querySelector('.def')?.innerText.replace(/[\n\r]/g, '').trim() || '';
            const examples = Array.from(defBlock.querySelectorAll('.examp .eg')).map(el => el.innerText.trim());
            return {
                word: headword, source: 'cambridge',
                pronunciations: [{ ipa: ipa, audio_uk: '', audio_us: '' }],
                results: [{ meanings: [{ pos: pos, definition: definition, example: examples[0] || '', collocations: [] }] }]
            };
        } catch (e) { return null; }
    }

    // --- ENGINE 2: AI SCRAPER ---
    async function processNextBatch() {
        if (!isRunning || !isAI) return;
        const dir = isReverse ? 'desc' : 'asc';
        GM_xmlhttpRequest({
            method: "GET",
            url: `${CONFIG.BASE_URL}/api/bot/next-batch?size=${CONFIG.BATCH_SIZE}&direction=${dir}`,
            onload: async (res) => {
                const data = JSON.parse(res.responseText);
                await runPrompt(data.words, data.remaining);
            }
        });
    }

    async function runPrompt(words, remaining) {
        if (!words || words.length === 0) { updateStatus("XONG!"); return; }
        const prompt = `SYSTEM ROLE: Từ điển chuyên nghiệp. JSON ARRAY RAW.
        FORMAT: [ { "word": "từ gốc", "familyWords": ["word (từ loại)"], "pronunciations": [{ "ipa": "/phiên âm/" }], "results": [{ "meanings": [{ "pos": "...", "definition": "...", "example": "..." }] }] } ]
        Xử lý: ` + words.join(', ');

        const editor = document.querySelector('textarea, div[contenteditable="true"]');
        if (!editor) return;
        editor.focus();
        document.execCommand('insertText', false, prompt);
        await new Promise(r => setTimeout(r, 1000));
        const btn = document.querySelector('button[aria-label*="Send"], button.send-button');
        if (btn) btn.click();
        updateStatus("Đang rình AI...", remaining);
        pollResult(words);
    }

    async function pollResult(currentWords) {
        let startTime = Date.now();
        while (Date.now() - startTime < 120000) {
            await new Promise(r => setTimeout(r, 2000));
            const text = document.body.innerText;
            if (text.includes('[') && text.includes(']')) {
                const jsonData = findJSON(text, currentWords);
                if (jsonData) {
                    await saveToLingoPro(jsonData);
                    processNextBatch();
                    return;
                }
            }
        }
        location.reload();
    }

    function findJSON(text, words) {
        try {
            const start = text.lastIndexOf('[');
            const end = text.indexOf(']', start);
            const slice = text.substring(start, end + 1);
            const parsed = JSON.parse(slice);
            if (parsed.some(item => words.includes(item.word))) return parsed;
        } catch(e) {}
        return null;
    }

    async function saveToLingoPro(jsonData) {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "POST", url: `${CONFIG.BASE_URL}/api/bot/save-batch`,
                data: JSON.stringify(jsonData), headers: { "Content-Type": "application/json" },
                onload: () => resolve()
            });
        });
    }

    if (isRunning && isAI) setTimeout(processNextBatch, 2000);
})();
