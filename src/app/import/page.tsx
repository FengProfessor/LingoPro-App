'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Brain, ChevronLeft, Upload, FileText, Camera, Loader2,
  CheckCircle2, XCircle, SkipForward, Trash2, Plus
} from 'lucide-react';

type Tab = 'text' | 'file' | 'ocr';
type WordStatus = 'pending' | 'saving' | 'saved' | 'duplicate' | 'error';

interface ImportWord {
  id: string;
  word: string;
  status: WordStatus;
  message?: string;
}

export default function ImportPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('text');

  // Text import
  const [bulkText, setBulkText] = useState('');
  const [wordList, setWordList] = useState<ImportWord[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // File import
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  // OCR
  const imageRef = useRef<HTMLInputElement>(null);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrImageFile, setOcrImageFile] = useState<File | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrWords, setOcrWords] = useState<ImportWord[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push('/auth'); return; }
      setUserId(session.user.id);

      const res = await fetch(`/api/words?userId=${session.user.id}`);
      const data = await res.json();
      if (data.classroomId) setClassroomId(data.classroomId);
    })();
  }, []);

  // ── Parse bulk text into words ──
  const parseText = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split(/[\n,;]+/).map(l => l.trim()).filter(l => l.length > 0 && l.length < 80);
    const unique = [...new Set(lines.map(l => l.toLowerCase()))];
    setWordList(unique.map((w, i) => ({ id: String(i), word: w, status: 'pending' })));
  };

  // ── Parse Excel/CSV ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Find a column named "word" or use the first column
      const header = rows[0]?.map((h: any) => String(h).toLowerCase()) || [];
      const wordColIdx = header.findIndex((h: string) => h.includes('word') || h.includes('từ')) ?? 0;
      const col = wordColIdx >= 0 ? wordColIdx : 0;

      const words = rows
        .slice(header.length > 0 ? 1 : 0)
        .map((r: any) => String(r[col] || '').trim())
        .filter(w => w.length > 0 && w.length < 80);

      const unique = [...new Set(words)];
      setWordList(unique.map((w, i) => ({ id: String(i), word: w, status: 'pending' })));
      toast.success(`Found ${unique.length} words in ${file.name}`);
    } catch (err: any) {
      toast.error('Failed to read file: ' + err.message);
    }
  };

  // ── OCR from image using Gemini Vision ──
  // Compress image before upload to avoid Vercel 4.5MB payload limit
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200; // Optimal for OCR without losing text
          const MAX_HEIGHT = 1600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG 70% quality (reduces size from 5MB to ~300KB)
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Create immediate basic preview
    const objectUrl = URL.createObjectURL(file);
    setOcrImage(objectUrl); 
    setOcrImageFile(file);
  };

  const runOCR = async () => {
    if (!ocrImageFile) return;
    setIsOcrProcessing(true);
    setOcrWords([]);
    
    try {
      // Compress right before sending
      toast.info('Preparing image...', { id: 'ocr-toast' });
      const compressedDataUrl = await compressImage(ocrImageFile);
      const base64 = compressedDataUrl.split(',')[1];
      const mimeType = 'image/jpeg';

      toast.loading('AI is scanning for vocabulary...', { id: 'ocr-toast' });
      
      const res = await fetch('/api/import/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType }),
      });
      
      if (!res.ok) {
         if (res.status === 413) throw new Error('Image is still too large. Try taking a photo from further away.');
         try {
           const errData = await res.json();
           throw new Error(errData.error || `HTTP Error ${res.status}`);
         } catch(e) {
           throw new Error(`Server returned an error (${res.status}).`);
         }
      }

      const data = await res.json();
      if (data.words && data.words.length > 0) {
        setOcrWords(data.words.map((w: string, i: number) => ({ id: `ocr-${i}`, word: w, status: 'pending' })));
        toast.success(`Found ${data.words.length} words!`, { id: 'ocr-toast' });
      } else {
        toast.info('No vocabulary found. Try a clearer image.', { id: 'ocr-toast' });
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      toast.error(err.message || 'Failed to scan image', { id: 'ocr-toast' });
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // ── Import words to database ──
  const importWords = async (words: ImportWord[], setWords: (fn: (prev: ImportWord[]) => ImportWord[]) => void) => {
    if (!userId || words.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);

    const pending = words.filter(w => w.status === 'pending');
    let done = 0;

    for (const w of pending) {
      setWords(prev => prev.map(p => p.id === w.id ? { ...p, status: 'saving' } : p));

      try {
        const res = await fetch('/api/words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: w.word, userId, classroomId, skipAI: true }), // fast insert
        });
        const data = await res.json();
        const status: WordStatus = data.alreadyExists ? 'duplicate' : (data.success ? 'saved' : 'error');
        setWords(prev => prev.map(p => p.id === w.id ? { ...p, status, message: data.message } : p));
      } catch {
        setWords(prev => prev.map(p => p.id === w.id ? { ...p, status: 'error' } : p));
      }

      done++;
      setImportProgress(Math.round((done / pending.length) * 100));
    }

    if (done > 0 && classroomId) {
      toast.loading(`Running AI batch analysis for ${done} words...`, { id: 'batch-toast' });
      try {
        const refreshRes = await fetch('/api/words/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ classroomId }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          toast.success(`Import complete! AI analyzed ${refreshData.refreshed} words.`, { id: 'batch-toast' });
        } else {
          throw new Error('AI analysis failed');
        }
      } catch (err) {
        toast.error(`Imported ${done} words. AI analysis failed, please click "Retry AI" in Dashboard.`, { id: 'batch-toast' });
      }
    } else if (done > 0) {
      toast.success(`Import complete! ${done} words saved.`);
    }

    setIsImporting(false);
  };

  const removeWord = (id: string, setWords: React.Dispatch<React.SetStateAction<ImportWord[]>>) => {
    setWords(prev => prev.filter(w => w.id !== id));
  };

  const StatusIcon = ({ status }: { status: WordStatus }) => {
    if (status === 'saving') return <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />;
    if (status === 'saved') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (status === 'duplicate') return <SkipForward className="h-4 w-4 text-indigo-400" />;
    if (status === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    return <div className="w-2 h-2 bg-slate-300 rounded-full mt-1" />;
  };

  const WordListPanel = ({
    words,
    setWords,
    label,
  }: {
    words: ImportWord[];
    setWords: React.Dispatch<React.SetStateAction<ImportWord[]>>;
    label: string;
  }) => (
    <div className="space-y-3">
      {words.length > 0 && (
        <>
          {isImporting && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>Importing...</span><span>{importProgress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${importProgress}%` }} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-muted-foreground">{words.length} words ready</span>
            <div className="flex gap-2">
              <button
                onClick={() => setWords([])}
                className="text-xs text-red-500 hover:underline"
              >Clear</button>
              <button
                onClick={() => importWords(words, setWords as any)}
                disabled={isImporting || words.every(w => w.status !== 'pending')}
                className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {isImporting ? 'Importing...' : `Import ${words.filter(w => w.status === 'pending').length}`}
              </button>
            </div>
          </div>

          <div className="bg-background border rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
            {words.map(w => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/30">
                <StatusIcon status={w.status} />
                <span className={`flex-1 text-sm font-medium ${w.status === 'duplicate' ? 'text-muted-foreground line-through' : ''}`}>{w.word}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{w.status}</span>
                {w.status === 'pending' && (
                  <button onClick={() => removeWord(w.id, setWords)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link href="/student">
          <button className="flex items-center gap-2 text-muted-foreground hover:text-indigo-600 font-bold text-sm transition-colors">
            <ChevronLeft className="h-5 w-5" /> Dashboard
          </button>
        </Link>
        <div className="flex items-center gap-2 font-black text-slate-800">
          <Brain className="h-6 w-6 text-indigo-600" />
          <span>Import Words</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Tab switcher */}
        <div className="bg-white border rounded-2xl p-1.5 flex gap-1 shadow-sm">
          {([
            { key: 'text', icon: FileText, label: 'Paste Text' },
            { key: 'file', icon: Upload, label: 'Excel / CSV' },
            { key: 'ocr', icon: Camera, label: 'Scan Image' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                tab === t.key
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── TAB: Paste Text ── */}
        {tab === 'text' && (
          <div className="bg-white border rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="font-black text-lg">Paste or type words</h2>
              <p className="text-sm text-muted-foreground mt-1">
                One word per line, or separate with commas. You can also paste a whole paragraph — AI will extract the words.
              </p>
            </div>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"apple\nbanana, cherry\nOr paste any paragraph here..."}
              className="w-full h-48 border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono"
            />
            <button
              onClick={parseText}
              disabled={!bulkText.trim()}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Parse Words →
            </button>
            <WordListPanel words={wordList} setWords={setWordList} label="Words to import" />
          </div>
        )}

        {/* ── TAB: Excel/CSV ── */}
        {tab === 'file' && (
          <div className="bg-white border rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="font-black text-lg">Upload Excel or CSV</h2>
              <p className="text-sm text-muted-foreground mt-1">
                File should have a column named <code className="bg-muted px-1 rounded text-xs">word</code> or <code className="bg-muted px-1 rounded text-xs">từ</code>. If not found, the first column is used.
              </p>
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-10 flex flex-col items-center gap-3 transition-colors group"
            >
              <div className="w-14 h-14 bg-indigo-50 group-hover:bg-indigo-100 rounded-2xl flex items-center justify-center transition-colors">
                <Upload className="h-7 w-7 text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-sm">{fileName || 'Click to upload file'}</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, .csv supported</p>
              </div>
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            <WordListPanel words={wordList} setWords={setWordList} label="Words from file" />
          </div>
        )}

        {/* ── TAB: OCR ── */}
        {tab === 'ocr' && (
          <div className="bg-white border rounded-2xl p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="font-black text-lg">📸 Scan Image (AI OCR)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a photo of a textbook, worksheet, or any document. AI will extract all vocabulary words — including underlined or highlighted ones.
              </p>
            </div>

            <button
              onClick={() => imageRef.current?.click()}
              className="w-full border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-2xl overflow-hidden transition-colors"
            >
              {ocrImage ? (
                <img src={ocrImage} alt="Preview" className="w-full max-h-64 object-contain" />
              ) : (
                <div className="p-10 flex flex-col items-center gap-3 group">
                  <div className="w-14 h-14 bg-purple-50 group-hover:bg-purple-100 rounded-2xl flex items-center justify-center transition-colors">
                    <Camera className="h-7 w-7 text-purple-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm">Click to upload photo</p>
                    <p className="text-xs text-muted-foreground mt-1">jpg, png, webp — max 10MB</p>
                  </div>
                </div>
              )}
            </button>
            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

            {ocrImage && (
              <button
                onClick={runOCR}
                disabled={isOcrProcessing}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white font-bold py-3 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {isOcrProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                {isOcrProcessing ? 'AI is scanning...' : 'Extract Words with AI'}
              </button>
            )}

            <WordListPanel words={ocrWords} setWords={setOcrWords} label="Words from image" />
          </div>
        )}
      </div>
    </div>
  );
}
