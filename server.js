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

// Serve static files from the React app build directory
// This MUST come before the catch-all route
app.use(express.static(buildPath));

// Handle React routing - return all non-file requests to React app
app.get('*', (req, res) => {
  const indexPath = path.join(buildPath, 'index.html');
  res.sendFile(indexPath);
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`✓ Server is running on port ${port}`);
  console.log(`✓ Serving static files from: ${buildPath}`);
});

