const express = require('express');
const app = express();
const PORT = 3000;

// Basic route
app.get('/', (req, res) => {
    res.send('<h1>Hello from Raspberry Pi</h1><p>Node.js server is live.</p>');
});

// A simple API endpoint for later
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        message: 'Ready for the front-end!'
    });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});