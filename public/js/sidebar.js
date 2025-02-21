// At the top of the file
let attributeOrder = ['id', 'location', 'hospital_n', 'st_address']; // Define default order
let clickedLocation = null; // Add this at the top with other variables

// Then fetch the actual order from server
function fetchAttributeOrder() {
    return fetch('/attributes-metadata')
        .then(response => response.json())
        .then(data => {
            attributeOrder = data.filter(attr => attr !== 'geom');
        })
        .catch(err => {
            console.error('Error fetching attribute order:', err);
        });
}

// Call this when the page loads
fetchAttributeOrder();

// SECTION 1: LAYERS & LEGEND ================================================
/**
 * Toggles the visibility of a layer.
 * @param {Event} e - The change event object.
 */
function toggleLayerVisibility(e) {
    const layerId = e.target.id;
    if (layerId === 'calgary-city-limits') {
        if (e.target.checked) {
            cityLimitsLayer.addTo(map);
        } else {
            map.removeLayer(cityLimitsLayer);
        }
    } else if (layerId === 'hospitals-of-alberta') {
        if (e.target.checked) {
            hospitalsLayer.addTo(map);
        } else {
            map.removeLayer(hospitalsLayer);
        }
    }
}

/**
 * Applies the style to the legend element.
 * @param {string} legendId - The ID of the legend element.
 * @param {Object} style - The style object.
 */
function applyLegendStyle(legendId, style) {  
    const legendElement = document.getElementById(legendId).querySelector('.sidebar-legend-symbol');
    legendElement.style.border = `${style.weight}px dashed ${style.color}`;
    legendElement.style.backgroundColor = style.fillColor;
    legendElement.style.opacity = 1;
    legendElement.style.backgroundColor = `rgba(${hexToRgb(style.fillColor)}, ${style.fillOpacity})`;
}

/**
 * Converts a hex color to an RGB string.
 * @param {string} hex - The hex color string.
 * @returns {string} - The RGB color string.
 */
function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = (bigint & 255);
    return `${r}, ${g}, ${b}`;
}
// SECTION 1: END ===========================================================


// SECTION 2: MOD BUTTONS ===================================================

function updateSidebarTable(properties, isAddMode = false, isEditMode = false) {
    console.log('Updating table:', { isAddMode, isEditMode, hasProperties: !!properties }); // Debug log
    const tbody = document.querySelector('#sidebar-table tbody');
    tbody.innerHTML = '';

    if (!properties && !isAddMode && !isEditMode) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 2;
        cell.textContent = 'Select a hospital to see details';
        return;
    }

    // Add rows for each property
    attributeOrder.forEach(key => {
        if (['geojson', 'source'].includes(key)) return;
        
        const row = tbody.insertRow();
        const keyCell = row.insertCell();
        const valueCell = row.insertCell();
        
        keyCell.textContent = keyMapping_hospitals[key] || key;
        
        if (isAddMode || isEditMode) {
            valueCell.contentEditable = true;
            valueCell.className = 'editable';
            valueCell.dataset.key = key;
            valueCell.textContent = properties ? (properties[key] || '') : '';

            // Add autocomplete for address field
            if (key === 'st_address') {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'address-autocomplete';
                input.value = valueCell.textContent;
                valueCell.textContent = '';  // Clear the cell
                valueCell.appendChild(input);  // Add input directly

                // Initialize Google Places Autocomplete
                const autocomplete = new google.maps.places.Autocomplete(input);
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place.formatted_address) {
                        input.value = place.formatted_address;
                    }
                });
            }
        } else {
            valueCell.textContent = properties ? (properties[key] || 'N/A') : '';
        }
    });

    // Add save button for add or edit mode
    if (isAddMode || isEditMode) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 2;
        cell.style.textAlign = 'center';
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.onclick = isAddMode ? saveNewHospital : saveEditedHospital;
        cell.appendChild(saveButton);
    }
}

function saveNewHospital() {
    if (!clickedLocation) {
        alert('Error: No location selected');
        return;
    }

    const newHospital = {
        geom: {
            type: 'Point',
            coordinates: [clickedLocation.lng, clickedLocation.lat]
        }
    };

    // Get values from editable cells
    const editableCells = document.querySelectorAll('#sidebar-table .editable');
    editableCells.forEach(cell => {
        const key = cell.dataset.key;
        // Check if it's the address field with input element
        if (key === 'st_address') {
            const input = cell.querySelector('input');
            newHospital[key] = input ? input.value.trim() : null;
        } else {
            newHospital[key] = cell.textContent.trim() || null;
        }
    });

    addHospital(newHospital);
    addMode = false;
    document.getElementById('add-button').classList.remove('button-down');
    updateSidebarTable(null);
    clickedLocation = null;
}

function saveEditedHospital() {
    if (!selected_feat_geojson) {
        alert('Error: No hospital selected');
        return;
    }

    const updatedHospital = {
        ...selected_feat_geojson.properties,
        geom: selected_feat_geojson.geometry
    };

    // Get values from editable cells
    const editableCells = document.querySelectorAll('#sidebar-table .editable');
    editableCells.forEach(cell => {
        const key = cell.dataset.key;
        // Check if it's the address field with input element
        if (key === 'st_address') {
            const input = cell.querySelector('input');
            updatedHospital[key] = input ? input.value.trim() : null;
        } else {
            updatedHospital[key] = cell.textContent.trim() || null;
        }
    });

    updateHospital(selected_feat_geojson.properties.id, updatedHospital)
        .then(() => {
            // Wait for the layer to refresh before updating the UI
            return addGeoJSONLayer();
        })
        .then(() => {
            editMode = false;
            document.getElementById('edit-button').classList.remove('button-down');
            // Only update the table after the layer has been refreshed
            updateSidebarTable(updatedHospital);
        })
        .catch(error => {
            console.error('Failed to update:', error);
            alert('Failed to update hospital');
        });
}

/**
 * Adds a new hospital record to the database.
 * @param {Object} hospitalData - The new hospital data.
 */
function addHospital(hospitalData) {
    fetch('/hospitals', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(hospitalData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error adding hospital');
        }
        alert('Hospital added successfully');
        addGeoJSONLayer(); // Refresh the layer
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error adding hospital');
    });
}

/**
 * Updates a hospital record in the database.
 * @param {number} id - The ID of the hospital to update.
 * @param {Object} hospitalData - The updated hospital data.
 */
function updateHospital(id, hospitalData) {
    return fetch(`/hospitals/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(hospitalData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error updating hospital');
        }
        alert('Hospital updated successfully');
    });
}

/**
 * Deletes a hospital record from the database.
 * @param {number} id - The ID of the hospital to delete.
 */
function deleteHospital(id) {
    fetch(`/hospitals/${id}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Error deleting hospital');
        }
        alert('Hospital deleted successfully');
        // Clear the selected feature
        if (selected_feat_leaflet) {
            map.removeLayer(selected_feat_leaflet);
            selected_feat_leaflet = null;
            selected_feat_geojson = null;
        }
        // Clear the table
        updateSidebarTable(null);
        // Refresh the map layer
        return addGeoJSONLayer();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error deleting hospital');
    });
}


