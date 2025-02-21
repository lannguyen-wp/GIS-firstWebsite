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

// Endpoint to get GeoJSON data
app.get('/geojson', async (req, res) => {
    try {
        const cityLimitsResult = await pool.query('SELECT *, ST_AsGeoJSON(geom) AS geojson FROM "Calgary_City_Limits"');
        const hospitalsResult = await pool.query('SELECT *, ST_AsGeoJSON(geom) AS geojson FROM "Hospitals_of_Alberta"');

        if (cityLimitsResult.rows.length === 0 && hospitalsResult.rows.length === 0) {
            throw new Error('No data found in Calgary_City_Limits or Hospitals_of_Alberta tables');
        }

        const geojson = {
            type: 'FeatureCollection',
            features: [
                ...cityLimitsResult.rows.map(row => {
                    const { geom, ...properties } = row;
                    return {
                        type: 'Feature',
                        geometry: JSON.parse(row.geojson),
                        properties: { ...properties, source: 'Calgary_City_Limits' },
                    };
                }),
                ...hospitalsResult.rows.map(row => {
                    const { geom, ...properties } = row;
                    return {
                        type: 'Feature',
                        geometry: JSON.parse(row.geojson),
                        properties: { ...properties, source: 'Hospitals_of_Alberta' },
                    };
                }),
            ],
        };

        res.json(geojson);
    } catch (err) {
        console.error('Error querying PostGIS:', err);
        res.status(500).send('Error querying PostGIS: ' + err.message);
    }
});

// Endpoint to get attributes data
app.get('/attributes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM "Hospitals_of_Alberta"');
        res.json(result.rows);
    } catch (err) {
        console.error('Error querying PostGIS:', err);
        res.status(500).send('Error querying PostGIS: ' + err.message);
    }
});

// Endpoint to get attributes metadata
app.get('/attributes-metadata', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'Hospitals_of_Alberta'
            ORDER BY ordinal_position
        `);
        res.json(result.rows.map(row => row.column_name));
    } catch (err) {
        console.error('Error querying PostGIS:', err);
        res.status(500).send('Error querying PostGIS: ' + err.message);
    }
});

// Endpoint to update a hospital record
app.put('/hospitals/:id', async (req, res) => {
    const { id } = req.params;
    const { geom, ...attributes } = req.body;
    
    // Remove geojson and source from attributes as they're not database columns
    const { geojson, source, ...cleanAttributes } = attributes;
    
    // console.log('Cleaned update request:', { id, attributes: cleanAttributes, geom });  // Commented out

    const columns = Object.keys(cleanAttributes);
    const values = Object.values(cleanAttributes);
    const setClause = columns.map((col, idx) => `"${col}" = $${idx + 1}`).join(', ');
    
    try {
        const query = `
            UPDATE "Hospitals_of_Alberta" 
            SET ${setClause}, 
                geom = ST_SetSRID(ST_GeomFromGeoJSON($${columns.length + 1}), 4326) 
            WHERE id = $${columns.length + 2}
        `;
        // console.log('Executing query:', query);  // Commented out
        // console.log('With values:', [...values, JSON.stringify(geom), id]);  // Commented out

        await pool.query(query, [...values, JSON.stringify(geom), id]);
        res.sendStatus(200);
    } catch (err) {
        console.error('Detailed error:', err);  // Keep this one for error tracking
        res.status(500).send(err.message);
    }
});

// Endpoint to add a new hospital record
app.post('/hospitals', async (req, res) => {
    const { geom, ...attributes } = req.body;
    const columns = Object.keys(attributes);
    const values = Object.values(attributes);
    const columnNames = columns.map(col => `"${col}"`).join(', ');
    const valuePlaceholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
    try {
        await pool.query(
            `INSERT INTO "Hospitals_of_Alberta" (${columnNames}, geom) VALUES (${valuePlaceholders}, ST_SetSRID(ST_GeomFromGeoJSON($${columns.length + 1}), 4326))`,
            [...values, JSON.stringify(geom)]
        );
        res.sendStatus(201);
    } catch (err) {
        console.error('Error adding hospital:', err);
        console.error('Request body:', req.body); // Log the request body for debugging
        res.status(500).send('Error adding hospital: ' + err.message);
    }
});

// Endpoint to delete a hospital record
app.delete('/hospitals/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM "Hospitals_of_Alberta" WHERE id = $1', [id]);
        res.sendStatus(200);
    } catch (err) {
        console.error('Error deleting hospital:', err);
        res.status(500).send('Error deleting hospital: ' + err.message);
    }
});

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