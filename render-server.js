require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const app = express();
const basePort = 3000;

console.log("DATABASE_URL:", process.env.DATABASE_URL); // verify the DATABASE_URL is set

// Serve static files and parse JSON bodies
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/images')));
app.use(bodyParser.json());

// PostgreSQL connection configuration
const connectionString = process.env.DATABASE_URL;

// Create a PostgreSQL pool
const renderPool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Render's free tier
  }
});

// Test database connection
renderPool.connect()
    .then(() => console.log('Connected to Render PostgreSQL database'))
    .catch(err => {
        console.error('Error connecting to Render PostgreSQL:', err);
        // Do not exit the process, continue running the server
    });

// Import and use routes
require('./routes')(app, renderPool);

// Simple server start
const startServer = (port = basePort) => {
    app.listen(port, () => {
        console.log(`Server running at https://gis-firstwebsite.onrender.com`);
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


