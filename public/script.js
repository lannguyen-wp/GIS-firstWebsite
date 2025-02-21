// SECTION 1: BASEMAP SETUP====================================================

// Basemap Configuration => access google basemaps directly: not recommended
const BASEMAPS = {
    googleSatellite: L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Google Maps',
      maxZoom: 20
    }),
    googleHybrid: L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Google Maps',
      maxZoom: 20
    }),
    googleStreets: L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Google Maps',
      maxZoom: 20
    }),
    openStreetMap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }),
    esriTopo: L.esri.basemapLayer('Topographic'),
    esriSatellite: L.layerGroup([
      L.esri.basemapLayer('Imagery'),
      L.esri.basemapLayer('ImageryLabels')
    ]),
    esriStreets: L.esri.basemapLayer('Streets')
};

// Base Layers Dictionary
const BASE_LAYERS = {
    "Google Satellite"  : BASEMAPS.googleSatellite,
    "Google Hybrid"     : BASEMAPS.googleHybrid,
    "Google Streets"    : BASEMAPS.googleStreets,
    "Open Street Map"   : BASEMAPS.openStreetMap,
    "Esri Topographic"  : BASEMAPS.esriTopo,
    "Esri Satellite"    : BASEMAPS.esriSatellite,
    "Esri Streets"      : BASEMAPS.esriStreets
};

// Initialize the map and set its view to a chosen geographical coordinates and zoom level
const map = L.map('map', {
    zoomControl: false,
    layers: [BASEMAPS.googleSatellite]
}).setView([20, 0], 2);

// Add the default basemap to the map
BASE_LAYERS["Google Satellite"].addTo(map);

// SECTION 1: END=============================================================

// SECTION 2: FUNCTION DEFINITIONS ==========================================

/**
 * Handles successful geolocation.
 * @param {Object} e - The geolocation event object.
 */
function onLocationFound(e) {
    map.setView(e.latlng, 15);
}

/**
 * Handles geolocation errors.
 * @param {Object} e - The error event object.
 */
function onLocationError(e) {
    alert(e.message);
    map.setView([20, 0], 2); // Zoom out to show the whole world
}

/**
 * Gets the user's current location using the browser's geolocation API.
 */
function getCurrentLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latlng = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                onLocationFound({ latlng, accuracy: position.coords.accuracy });
            },
            onLocationError,
            {
                enableHighAccuracy: true, // Enable high accuracy
                timeout: 10000, // Set timeout to 10 seconds
                maximumAge: 0 // Do not use cached location
            }
        );
    } else {
        alert("Geolocation is not available.");
        map.setView([20, 0], 2); // Zoom out to show the whole world
    }
}

/**
 * Searches for an address using the OSM Nominatim API.
 */
function searchAddress() {
    const query = document.getElementById('address-search-input').value;
    if (!query) {
        alert('Please enter an address to search.');
        return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    fetch(url)
        .then((response) => response.json())
        .then((data) => {
            if (data.length > 0) {
                const latlng = {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
                map.setView(latlng, 18);
                L.marker(latlng).addTo(map);
            } else {
                alert('No results found for the address.');
            }
        })
        .catch(() => {
            alert('Error occurred while searching for the address.');
        });
}

let cityLimitsLayer;
let hospitalsLayer;
let addMode = false;
let editMode = false;
let selectedFeature = null;
let selectedLayer = null; // Track the selected layer
let attributeOrder = []; // Store the attribute order

/**
 * Style object for Calgary City Limits
 */
const calgaryCityLimitsStyle = {
    color: '#FF0000', // Outline color - red
    weight: 2, // Outline width - 2 pt
    dashArray: '5, 5', // Dashed line
    fillColor: '#FFFFE0', // Fill color - light yellow
    fillOpacity: 0.3 // Opacity - 30%
};

/**
 * Icon for Hospitals of Alberta
 */
const hospitalIcon = L.icon({
    iconUrl: 'images/hospital-64.png',
    iconSize: [24, 24], // size of the icon
    iconAnchor: [12, 12], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -12] // point from which the popup should open relative to the iconAnchor
});

/**
 * Icon for Selected Hospital
 */
const selectedHospitalIcon = L.icon({
    iconUrl: 'images/hospital-64-selected.png',
    iconSize: [24, 24], // size of the icon
    iconAnchor: [12, 12], // point of the icon which will correspond to marker's location
    popupAnchor: [0, -12] // point from which the popup should open relative to the iconAnchor
});

/**
 * Applies the style to the legend element.
 * @param {string} legendId - The ID of the legend element.
 * @param {Object} style - The style object.
 */
function applyLegendStyle(legendId, style) {
    const legendElement = document.getElementById(legendId).querySelector('.legend-symbol');
    legendElement.style.border = `${style.weight}px dashed ${style.color}`;
    legendElement.style.backgroundColor = style.fillColor;
    legendElement.style.opacity = 1; // Ensure the legend's border color remains vivid
    legendElement.style.backgroundColor = `rgba(${hexToRgb(style.fillColor)}, ${style.fillOpacity})`; // Apply fill opacity
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

/**
 * Fetches and displays GeoJSON data from the server.
 */
function addGeoJSONLayer() {
    fetch('/geojson')
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            return response.json();
        })
        .then((data) => {
            const cityLimitsData = data.features.filter(feature => feature.properties.source === 'Calgary_City_Limits');
            const hospitalsData = data.features.filter(feature => feature.properties.source === 'Hospitals_of_Alberta');

            cityLimitsLayer = L.geoJSON(cityLimitsData, {
                style: calgaryCityLimitsStyle
            }).addTo(map);

            // Apply the style to the Calgary City Limits legend
            applyLegendStyle('calgary-city-limits-legend', calgaryCityLimitsStyle);

            const keyMapping = {
                location: "Location",
                hospital_n: "Name",
                st_address: "Address"
            };

            hospitalsLayer = L.geoJSON(hospitalsData, {
                pointToLayer: (feature, latlng) => L.marker(latlng, { icon: hospitalIcon }),
                onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                        let popupContent = '<div class="popup-content"><b>Hospital Details:</b><br>';
                        for (const key in feature.properties) {
                            if (['id', 'geojson', 'source'].includes(key)) continue;
                            const displayKey = keyMapping[key] || key;
                            popupContent += `<span class="popup-key">${displayKey}:</span> <span class="popup-value">${feature.properties[key]}</span><br>`;
                        }
                        popupContent += '</div>';
                        layer.bindPopup(popupContent, { closeButton: false });

                        // Add hover event to show the popup
                        layer.on('mouseover', () => {
                            layer.openPopup();
                        });

                        // Add mouseout event to close the popup
                        layer.on('mouseout', () => {
                            layer.closePopup();
                        });

                        // Add click event to select the feature
                        layer.on('click', (e) => {
                            e.originalEvent.stopPropagation(); // Prevent map click event from firing
                            if (selectedLayer) {
                                selectedLayer.setIcon(hospitalIcon); // Reset the icon of the previously selected layer
                            }
                            selectedFeature = feature;
                            selectedLayer = layer;
                            layer.setIcon(selectedHospitalIcon); // Set the icon of the selected layer
                        });
                    }
                }
            }).addTo(map);
        })
        .catch((err) => {
            console.error('Error fetching GeoJSON data:', err);
            alert('Error fetching GeoJSON data.');
        });
}

/**
 * Fetches the attribute order from the server.
 */
function fetchAttributeOrder() {
    return fetch('/attributes-metadata')
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            return response.json();
        })
        .then((data) => {
            attributeOrder = data.filter(attr => attr !== 'geom'); // Exclude the "geom" attribute
        })
        .catch((err) => {
            console.error('Error fetching attribute order:', err);
            alert('Error fetching attribute order.');
        });
}

/**
 * Handles basemap changes.
 * @param {Event} e - The change event object.
 */
function handleBasemapChange(e) {
    const selectedBasemap = e.target.value;
    if (BASE_LAYERS[selectedBasemap]) {
        // Remove all existing layers
        map.eachLayer((layer) => map.removeLayer(layer));
        // Add the selected basemap
        BASE_LAYERS[selectedBasemap].addTo(map);
        // Re-add the GeoJSON layers
        if (cityLimitsLayer) cityLimitsLayer.addTo(map);
        if (hospitalsLayer) hospitalsLayer.addTo(map);
    }
}

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
 * Creates a custom control container for buttons.
 */
function createButtonContainer() {
    const buttonContainer = L.control({ position: 'bottomleft' });
    buttonContainer.onAdd = () => {
        const div = L.DomUtil.create('div', 'button-container');
        div.innerHTML = `
            <button id="location-button" class="location-button" title="Your Location">
                <img src="map-pin-64.png" alt="Location">
            </button>
            <button id="zoom-in" class="custom-zoom-button">+</button>
            <button id="zoom-out" class="custom-zoom-button">-</button>
        `;
        return div;
    };
    return buttonContainer;
}

/**
 * Toggles the "button down" effect on button click.
 * @param {Event} e - The click event object.
 */
function toggleButtonDownEffect(e) {
    e.target.classList.toggle('button-down');
}

/**
 * Opens a form to add or edit hospital attributes.
 * @param {Object} feature - The GeoJSON feature (null for add mode).
 * @param {Object} latlng - The latitude and longitude of the new hospital (null for edit mode).
 */
function openForm(feature, latlng) {
    const isEditMode = !!feature;
    const attributes = isEditMode ? feature.properties : attributeOrder.reduce((acc, key) => {
        acc[key] = '';
        return acc;
    }, {});
    const formHtml = `
        <form id="hospital-form">
            ${attributeOrder.map(key => `
                <label for="${key}">${key}:</label>
                <input type="text" id="${key}" name="${key}" value="${attributes[key]}">
            `).join('')}
            <button type="submit">${isEditMode ? 'Save' : 'Add'}</button>
        </form>
    `;
    const formContainer = document.createElement('div');
    formContainer.innerHTML = formHtml;
    document.body.appendChild(formContainer);
    if (isEditMode) {
        editMode = true;
        document.getElementById('edit-button').classList.add('button-down');
    } else {
        addMode = true;
        document.getElementById('add-button').classList.add('button-down');
    }

    document.getElementById('hospital-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const hospitalData = attributeOrder.reduce((acc, key) => {
            acc[key] = document.getElementById(key).value || null; // Ensure null values for empty fields
            return acc;
        }, {});
        hospitalData.geom = isEditMode ? feature.geometry : {
            type: 'Point',
            coordinates: [latlng.lng, latlng.lat]
        };
        if (isEditMode) {
            updateHospital(feature.properties.id, hospitalData);
        } else {
            addHospital(hospitalData);
        }
        document.body.removeChild(formContainer);
        if (isEditMode) {
            editMode = false;
            document.getElementById('edit-button').classList.remove('button-down');
        } else {
            addMode = false;
            document.getElementById('add-button').classList.remove('button-down');
        }
    });
}

/**
 * Updates a hospital record in the database.
 * @param {number} id - The ID of the hospital to update.
 * @param {Object} hospitalData - The updated hospital data.
 */
function updateHospital(id, hospitalData) {
    fetch(`/hospitals/${id}`, {
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
        addGeoJSONLayer(); // Refresh the layer
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error updating hospital');
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
        if (selectedLayer) {
            map.removeLayer(selectedLayer); // Remove the hospital icon from the map
            selectedLayer = null;
            selectedFeature = null;
        }
        addGeoJSONLayer(); // Refresh the layer
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error deleting hospital');
    });
}

/**
 * Closes the form and exits add or edit mode.
 */
function closeForm() {
    const formContainer = document.getElementById('hospital-form')?.parentElement;
    if (formContainer) {
        formContainer.remove();
    }
    if (addMode) {
        addMode = false;
        document.getElementById('add-button').classList.remove('button-down');
    }
    if (editMode) {
        editMode = false;
        document.getElementById('edit-button').classList.remove('button-down');
    }
    if (selectedLayer) {
        selectedLayer.setIcon(hospitalIcon); // Reset the icon of the previously selected layer
        selectedLayer.closePopup();
        selectedLayer = null;
        selectedFeature = null;
    }
}

// SECTION 2: END ===========================================================


// SECTION 3: INITIALIZATION AND EVENT LISTENERS ============================

// Add custom button container
createButtonContainer().addTo(map);

// Call the function to add the GeoJSON layer when the map is initialized
addGeoJSONLayer();

// Fetch the attribute order when the page loads
fetchAttributeOrder().then(() => {
    // Check if geolocation is enabled when the page loads
    if ("geolocation" in navigator) {
        getCurrentLocation();
    } else {
        alert("Geolocation is not available.");
        map.setView([20, 0], 2); // Zoom out to show the whole world
    }

    // Add event listeners
    document.getElementById('address-search-button').addEventListener('click', searchAddress);
    document.getElementById('basemap').addEventListener('change', handleBasemapChange);
    document.getElementById('location-button').addEventListener('click', getCurrentLocation);
    document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());

    // Add event listeners for layer visibility toggles
    document.getElementById('calgary-city-limits').addEventListener('change', toggleLayerVisibility);
    document.getElementById('hospitals-of-alberta').addEventListener('change', toggleLayerVisibility);

    // Add event listeners for the sidebar buttons
    document.getElementById('add-button').addEventListener('click', (e) => {
        if (addMode) {
            closeForm();
        } else {
            addMode = true;
            document.getElementById('add-button').classList.add('button-down');
        }
    });
    document.getElementById('edit-button').addEventListener('click', (e) => {
        if (selectedFeature) {
            openForm(selectedFeature, null);
        } else {
            alert('Please select a hospital to edit');
        }
    });
    document.getElementById('remove-button').addEventListener('click', () => {
        if (selectedFeature) {
            deleteHospital(selectedFeature.properties.id);
        } else {
            alert('Please select a hospital to remove');
        }
    });

    // Add event listener for map click to add a new hospital
    map.on('click', (e) => {
        if (addMode) {
            openForm(null, e.latlng);
        } else {
            if (selectedLayer) {
                selectedLayer.setIcon(hospitalIcon); // Reset the icon of the previously selected layer
                selectedLayer = null;
                selectedFeature = null;
            }
        }
    });

    // Add event listener for Escape key to close the form
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeForm();
        }
    });
});

// SECTION 3: END ===========================================================