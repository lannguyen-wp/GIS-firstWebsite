// SECTION 1: BASEMAP SETUP ==================================================
const BASEMAPS = {
    googleSatellite: L.gridLayer.googleMutant({
        type: 'satellite', // Google Satellite
        maxZoom: 20
    }),
    googleHybrid: L.gridLayer.googleMutant({
        type: 'hybrid', // Google Hybrid
        maxZoom: 20
    }),
    googleStreets: L.gridLayer.googleMutant({
        type: 'roadmap', // Google Streets
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
// SECTION 1: END ============================================================


// SECTION 2: LOCATION & ZOOM BUTTONS ========================================
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
// SECTION 2: END ============================================================


// SECTION 3: ADDRESS SEARCH =================================================
/**
 * Initialize the Google Places Autocomplete
 */
function initializeAutocomplete() {
    const input = document.getElementById('address-search-input');
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
            const latlng = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            };
            map.setView(latlng, 18);
            L.marker(latlng).addTo(map);
        } else {
            alert('No details available for the input: ' + place.name);
        }
        
        // Clear the search input box
        input.value = '';
    });
}

/**
 * Searches for an address using the Google Geocoding API.
 */
function searchAddress() {
    const query = document.getElementById('address-search-input').value;
    if (!query) {
        alert('Please enter an address to search.');
        return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            const latlng = {
                lat: location.lat(),
                lng: location.lng()
            };
            map.setView(latlng, 18);
            L.marker(latlng).addTo(map);
        } else {
            alert('No results found for the address.');
        }
    });
    
    // Clear the search input box
    document.getElementById('address-search-input').value = '';
}
// SECTION 3: END ============================================================


// SECTION 4: DISPLAY LAYERS =================================================
/**
 * Fetches and displays GeoJSON data for Calgary City Limits from the server.
 */
function addGeoJSON_city_limits(data) {
    const cityLimitsData = data.features.filter(feat_geojson => feat_geojson.properties.source === 'Calgary_City_Limits');

    cityLimitsLayer = L.geoJSON(cityLimitsData, {
        style: calgaryCityLimitsStyle
    }).addTo(map);
}

/**
 * Fetches and displays GeoJSON data for Hospitals of Alberta from the server.
 */
function addGeoJSON_hospitals(data) {
    const hospitalsData = data.features.filter(feat_geojson => feat_geojson.properties.source === 'Hospitals_of_Alberta');
    hospitalsLayer = L.geoJSON(hospitalsData, {
        pointToLayer: (feat_geojson, latlng) => L.marker(latlng, { icon: hospitalIcon }),
        onEachFeature: (feat_geojson, feat_leaflet) => {
            if (feat_geojson.properties) {
                // Removed mouseover and mouseout event listeners

                // Add click event to select the feature
                feat_leaflet.on('click', (e) => {
                    e.originalEvent.stopPropagation(); // Prevent map click event from firing
                    if (selected_feat_leaflet) {
                        selected_feat_leaflet.setIcon(hospitalIcon); // Reset the icon of the previously selected layer
                    }
                    if (selected_feat_leaflet === feat_leaflet) {
                        // If clicking the same hospital, deselect it
                        selected_feat_leaflet = null;
                        selected_feat_geojson = null;
                        updateSidebarTable(null);
                    } else {
                        // Select the new hospital
                        selected_feat_leaflet = feat_leaflet;
                        selected_feat_geojson = feat_geojson;
                        feat_leaflet.setIcon(selectedHospitalIcon); // Set the icon of the selected layer
                        updateSidebarTable(feat_geojson.properties); // Update the sidebar table
                    }
                });
            }
        }
    }).addTo(map);
}

/**
 * Fetches and displays GeoJSON data from the server.
 */
function addGeoJSONLayer() {
    return fetch('/geojson')
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            return response.json();
        })
        .then((data) => {
            addGeoJSON_city_limits(data);
            addGeoJSON_hospitals(data);
        })
        .catch((err) => {
            console.error('Error fetching GeoJSON data:', err);
            alert('Error fetching GeoJSON data.');
        });
}

// Call the function to add the GeoJSON layer when the map is initialized
addGeoJSONLayer();
// SECTION 4: END ============================================================



