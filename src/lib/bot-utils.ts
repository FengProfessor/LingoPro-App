import fs from 'fs';
import path from 'path';

export async function getWordSourceMap() {
    const listsDir = path.join(process.cwd(), 'scripts', 'lists');
    
    if (!fs.existsSync(listsDir)) {
        return { wordToTags: {} as Record<string, string[]>, uniqueWords: [] as string[] };
    }

    const files = fs.readdirSync(listsDir).filter(file => file.endsWith('.txt'));
    const wordToTags: Record<string, Set<string>> = {};
    const allWordsRaw: string[] = [];
    
    for (const file of files) {
        const tagName = file.replace('.txt', '');
        const content = fs.readFileSync(path.join(listsDir, file), 'utf-8');
        const words = content.split(/\r?\n|,/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
        
        words.forEach(word => {
            allWordsRaw.push(word);
            if (!wordToTags[word]) wordToTags[word] = new Set();
            wordToTags[word].add(tagName);
        });
    }
    
    const uniqueWords = Array.from(new Set(allWordsRaw));
    
    // Chuyển Set thành Array để dễ dùng trong JSON
    const wordToTagsArray: Record<string, string[]> = {};
    for (const word in wordToTags) {
        wordToTagsArray[word] = Array.from(wordToTags[word]);
    }

    return { wordToTags: wordToTagsArray, uniqueWords };
}
