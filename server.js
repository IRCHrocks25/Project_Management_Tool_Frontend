const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const buildPath = path.join(__dirname, 'build');

// Check if build directory exists
if (!fs.existsSync(buildPath)) {
  console.error(`ERROR: Build directory does not exist at ${buildPath}`);
  console.error('Please run "npm run build" before starting the server.');
  process.exit(1);
}

console.log(`✓ Build directory found at: ${buildPath}`);
console.log(`✓ Current working directory: ${process.cwd()}`);
console.log(`✓ __dirname: ${__dirname}`);

// Explicitly serve static files from build/static directory
const staticPath = path.join(buildPath, 'static');
if (fs.existsSync(staticPath)) {
  console.log(`✓ Static directory found at: ${staticPath}`);
  app.use('/static', express.static(staticPath, {
    maxAge: '1y',
    etag: false
  }));
}

// Serve all other static files from build directory
app.use(express.static(buildPath, {
  maxAge: '1y',
  etag: false,
  index: false // Don't auto-serve index.html for root
}));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Handle React routing - return all non-file requests to React app
app.get('*', (req, res) => {
  // Check if it's a request for a file with extension
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') {
    // It's a file request but wasn't found, return 404
    return res.status(404).send('File not found');
  }
  
  // For all routes, serve index.html for SPA routing
  const indexPath = path.join(buildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    console.error(`ERROR: index.html not found at ${indexPath}`);
    res.status(500).send('index.html not found. Build may have failed.');
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`✓ Server is running on port ${port}`);
  console.log(`✓ Serving static files from: ${buildPath}`);
  console.log(`✓ Ready to serve requests`);
});

