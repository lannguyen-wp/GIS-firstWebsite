const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const app = express();
const basePort = 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/images')));
app.use(bodyParser.json()); // Parse JSON bodies

// Set up the PostGIS database connection
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mysdb',
    password: 'Pp134679.',
    port: 5432,
});

// Import and use routes
require('./routes')(app, pool);

// Simple server start
const startServer = (port = basePort) => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} busy, trying ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
        }
    });
};

startServer();