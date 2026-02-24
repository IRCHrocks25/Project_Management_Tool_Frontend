const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || '3001';
const buildDir = path.join(__dirname, '..', 'build');

// Check if build directory exists
if (!fs.existsSync(buildDir)) {
  console.error('❌ Build directory not found!');
  console.error('   Please run: npm run build');
  console.error('   Or for development, use: npm run start:dev');
  process.exit(1);
}

// Check if index.html exists in build
const indexHtml = path.join(buildDir, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('❌ index.html not found in build directory!');
  console.error('   Please run: npm run build');
  process.exit(1);
}

console.log('✅ Serving build directory...');
console.log(`   Local: http://localhost:${port}`);

// Use serve with -s flag for SPA routing (serves index.html for all routes)
const serve = spawn('npx', ['serve', '-s', 'build', '-l', port], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..')
});

serve.on('error', (error) => {
  console.error('Error starting serve:', error);
  process.exit(1);
});

serve.on('exit', (code) => {
  process.exit(code);
});

