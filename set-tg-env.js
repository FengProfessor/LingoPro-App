const { spawn } = require('child_process');

const token = "8315376031:AAGYIRLn3UBsVOw63UBgXCXJdShSPP1zTyI";

async function run() {
  console.log('--- Removing old env var ---');
  await exec('npx', ['vercel', 'env', 'rm', 'TELEGRAM_BOT_TOKEN', 'production', '--yes']);

  console.log('--- Adding new env var ---');
  const child = spawn('npx', ['vercel', 'env', 'add', 'TELEGRAM_BOT_TOKEN', 'production'], {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true
  });

  child.stdin.write(token + '\n');
  
  // Wait a bit then answer "n" to "Mark as sensitive?"
  setTimeout(() => {
    child.stdin.write('n\n');
    child.stdin.end();
  }, 3000);

  child.on('close', (code) => {
    console.log(`Env add exited with code ${code}`);
    process.exit(code);
  });
}

function exec(cmd, args) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { shell: true, stdio: 'inherit' });
    c.on('close', resolve);
  });
}

run();
