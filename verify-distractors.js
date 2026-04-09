// Simulate distractor generation fix
const dueWords = [{ id: '1', word: 'BACK', translation: 'trở lại' }];
const allWordsInDB = [
  { translation: 'đi' }, { translation: 'đứng' }, { translation: 'ngồi' }, 
  { translation: 'chạy' }, { translation: 'nhảy' }
];

function shuffleArray(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

async function simulateHandleStartQuiz() {
  const wordsWithDistractors = [];
  for (const word of dueWords) {
    let others = dueWords
      .filter(w => w.id !== word.id && w.translation)
      .map(w => w.translation);
    
    console.log('Distractors from due set:', others);
    
    if (others.length < 3) {
      console.log('Not enough distractors! Fetching from DB...');
      const extras = allWordsInDB.filter(w => w.translation !== word.translation).slice(0, 10);
      others = [...others, ...extras.map(e => e.translation)];
    }
    
    const finalDistractors = shuffleArray([...new Set(others)]).slice(0, 3);
    wordsWithDistractors.push({ ...word, distractors: finalDistractors });
  }
  return wordsWithDistractors;
}

simulateHandleStartQuiz().then(result => {
  console.log('Result for 1-word quiz:', JSON.stringify(result, null, 2));
  console.log('Number of distractors:', result[0].distractors.length);
});
