// Mock verification of the Telegram bot formatting logic
const wordData = {
  word: "epicenter",
  translation: "tâm chấn",
  ipa: "ˈɛpɪˌsɛntər",
  pos: "noun",
  example: "The earthquake's epicenter was located several miles off the coast."
};

function formatCloze(sentence, word) {
  if (!sentence) return '';
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  const cloze = sentence.replace(regex, (match) => '`' + '_'.repeat(match.length) + '`');
  if (cloze === sentence) {
    return sentence.replace(new RegExp(word, 'gi'), '`____`');
  }
  return cloze;
}

function mockSendQuestion(currentWordData) {
  const current_index = 0;
  const total = 10;
  const correct = 2;
  const wrong = 1;
  
  const progress = `Từ <b>${current_index + 1}/${total}</b> | ✅ ${correct} ❌ ${wrong}`;
  const posTag = currentWordData.pos ? ` <i>(${currentWordData.pos})</i>` : '';
  const question = `\n\n🔤 <b>${currentWordData.word.toUpperCase()}</b>${posTag}`;
  const ipa = currentWordData.ipa ? `\n<code>${currentWordData.ipa}</code>` : '';
  
  let cloze = '';
  if (currentWordData.example) {
    const hidden = formatCloze(currentWordData.example, currentWordData.word);
    cloze = `\n\n📝 <i>${hidden}</i>`;
  }

  const text = `${progress}${question}${ipa}${cloze}\n\nNghĩa của từ này là gì?`;
  return text;
}

function mockHandleAnswer(current_word, choices, correct_index) {
  const updatedCorrect = 3;
  const updatedWrong = 1;
  const current_index = 0;
  const word_queue_length = 10;
  const labels = ['A', 'B', 'C', 'D'];
  const resultText = `✅ <b>Đúng rồi!</b>`;
  const choicesText = choices.map((c, i) =>
    i === correct_index ? `<b>${labels[i]}. ${c} ✓</b>` : `${labels[i]}. ${c}`
  ).join('\n');

  const progress = `Từ <b>${current_index + 1}/${word_queue_length}</b> | ✅ ${updatedCorrect} ❌ ${updatedWrong}`;
  const posTag = current_word.pos ? ` <i>(${current_word.pos})</i>` : '';
  const wordText = `\n\n🔤 <b>${current_word.word.toUpperCase()}</b>${posTag}`;
  const ipa = current_word.ipa ? `\n<code>${current_word.ipa}</code>` : '';
  
  let exampleFeedback = '';
  if (current_word.example) {
    const regex = new RegExp(`\\b${current_word.word}\\b`, 'gi');
    const bolded = current_word.example.replace(regex, (match) => `<b>${match}</b>`);
    exampleFeedback = `\n\n📝 <i>${bolded}</i>`;
  }

  const resultMsg = `${progress}${wordText}${ipa}${exampleFeedback}\n\n${resultText}\n\n${choicesText}`;
  return resultMsg;
}

console.log("--- QUESTION PREVIEW ---");
console.log(mockSendQuestion(wordData));
console.log("\n--- ANSWER FEEDBACK PREVIEW ---");
const choices = ["tâm chấn", "vùng vịnh", "bờ biển", "động đất"];
console.log(mockHandleAnswer(wordData, choices, 0));
