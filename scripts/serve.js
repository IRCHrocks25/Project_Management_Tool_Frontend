const { spawn } = require('child_process');
const port = process.env.PORT || '3001';

const serve = spawn('npx', ['serve', '-s', 'build', '-l', port], {
  stdio: 'inherit',
  shell: true
});

serve.on('error', (error) => {
  console.error('Error starting serve:', error);
  process.exit(1);
});

serve.on('exit', (code) => {
  process.exit(code);
});

