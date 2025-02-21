module.exports = (app, pool) => {
    // Endpoint to list all tables in the database
    app.get('/tables', async (req, res) => {
        try {
            console.log('Fetching list of tables...');
            const client = await pool.connect();
            const result = await client.query(
                `SELECT table_name
                 FROM information_schema.tables
                 WHERE table_schema = 'public'
                 AND table_type = 'BASE TABLE';`
            );
            const tableNames = result.rows.map(row => row.table_name);
            client.release();
            console.log('Tables fetched successfully:', tableNames);
            res.json({ tables: tableNames });
        } catch (err) {
            console.error('Error fetching tables:', err);
            res.status(500).json({ error: 'An error occurred while fetching tables' });
        }
    });

    // Endpoint to get GeoJSON data
    app.get('/geojson', async (req, res) => {
        try {
            console.log('Fetching GeoJSON data...');
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

            console.log('GeoJSON data fetched successfully');
            res.json(geojson);
        } catch (err) {
            console.error('Error querying PostGIS:', err);
            res.status(500).json({ error: 'Error querying PostGIS: ' + err.message });
        }
    });

    // Endpoint to get attributes data
    app.get('/attributes', async (req, res) => {
        try {
            console.log('Fetching attributes data...');
            const result = await pool.query('SELECT * FROM "Hospitals_of_Alberta"');
            console.log('Attributes data fetched successfully');
            res.json(result.rows);
        } catch (err) {
            console.error('Error querying PostGIS:', err);
            res.status(500).json({ error: 'Error querying PostGIS: ' + err.message });
        }
    });

    // Endpoint to get attributes metadata
    app.get('/attributes-metadata', async (req, res) => {
        try {
            console.log('Fetching attributes metadata...');
            const result = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'Hospitals_of_Alberta'
                ORDER BY ordinal_position
            `);
            console.log('Attributes metadata fetched successfully');
            res.json(result.rows.map(row => row.column_name));
        } catch (err) {
            console.error('Error querying PostGIS:', err);
            res.status(500).json({ error: 'Error querying PostGIS: ' + err.message });
        }
    });

    // Endpoint to update a hospital record
    app.put('/hospitals/:id', async (req, res) => {
        const { id } = req.params;
        const { geom, ...attributes } = req.body;

        // Remove geojson and source from attributes as they're not database columns
        const { geojson, source, ...cleanAttributes } = attributes;

        const columns = Object.keys(cleanAttributes);
        const values = Object.values(cleanAttributes);
        const setClause = columns.map((col, idx) => `"${col}" = $${idx + 1}`).join(', ');

        try {
            console.log(`Updating hospital record with id ${id}...`);
            const query = `
                UPDATE "Hospitals_of_Alberta" 
                SET ${setClause}, 
                    geom = ST_SetSRID(ST_GeomFromGeoJSON($${columns.length + 1}), 4326) 
                WHERE id = $${columns.length + 2}
            `;

            await pool.query(query, [...values, JSON.stringify(geom), id]);
            console.log(`Hospital record with id ${id} updated successfully`);
            res.sendStatus(200);
        } catch (err) {
            console.error('Error updating hospital:', err);
            res.status(500).json({ error: 'Error updating hospital: ' + err.message });
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
            console.log('Adding new hospital record...');
            await pool.query(
                `INSERT INTO "Hospitals_of_Alberta" (${columnNames}, geom) VALUES (${valuePlaceholders}, ST_SetSRID(ST_GeomFromGeoJSON($${columns.length + 1}), 4326))`,
                [...values, JSON.stringify(geom)]
            );
            console.log('New hospital record added successfully');
            res.sendStatus(201);
        } catch (err) {
            console.error('Error adding hospital:', err);
            console.error('Request body:', req.body); // Log the request body for debugging
            res.status(500).json({ error: 'Error adding hospital: ' + err.message });
        }
    });

    // Endpoint to delete a hospital record
    app.delete('/hospitals/:id', async (req, res) => {
        const { id } = req.params;
        try {
            console.log(`Deleting hospital record with id ${id}...`);
            await pool.query('DELETE FROM "Hospitals_of_Alberta" WHERE id = $1', [id]);
            console.log(`Hospital record with id ${id} deleted successfully`);
            res.sendStatus(200);
        } catch (err) {
            console.error('Error deleting hospital:', err);
            res.status(500).json({ error: 'Error deleting hospital: ' + err.message });
        }
    });
};
