const express = require('express');
const path = require('path');

const app = express();
const buildPath = path.join(__dirname, 'build');

// Serve static files from the React app build directory
// Express static middleware will automatically serve files that exist
app.use(express.static(buildPath));

// Handle React routing - return all non-file requests to React app
// This catch-all route only runs if no static file was found
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Serving static files from: ${buildPath}`);
});

