document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded, initializing layers...');
});

// SECTION 1: for map.js ========================================================================================================
// Check if geolocation is enabled when the page loads
if ("geolocation" in navigator) {
    getCurrentLocation();
} else {
    alert("Geolocation is not available.");
    map.setView([20, 0], 2); // Zoom out to show the whole world
}

const calgaryCityLimitsStyle = {
    color: '#FF0000', // Outline color - red
    weight: 2, // Outline width - 2 pt
    dashArray: '5, 5', // Dashed line
    fillColor: '#FFFFE0', // Fill color - light yellow
    fillOpacity: 0.3 // Opacity - 30%
};

/**
 * Style object for Calgary City Limits
 */
const keyMapping_hospitals = {
    id: "ID",
    location: "Location",
    hospital_n: "Name",
    st_address: "Address"
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

let selected_feat_geojson = null; // Track the selected geojson feature
let selected_feat_leaflet = null; // Track the selected leaflet feature

document.getElementById('basemap').addEventListener('change', handleBasemapChange);
document.getElementById('my-location').addEventListener('click', getCurrentLocation);
document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());

// Call the initializeAutocomplete function when the page loads
window.addEventListener('load', initializeAutocomplete);
document.getElementById('address-search-button').addEventListener('click', searchAddress);

// SECTION 1: END ================================================================================================================


// SECTION 2: sidebar.js ========================================================================================================
let cityLimitsLayer;
let hospitalsLayer;
let addMode = false;
let editMode = false;

// Add event listeners for layer visibility toggles
document.getElementById('calgary-city-limits').addEventListener('change', toggleLayerVisibility);
document.getElementById('hospitals-of-alberta').addEventListener('change', toggleLayerVisibility);

applyLegendStyle('sidebar-legend-cityLimits', calgaryCityLimitsStyle);

// Add event listeners for the sidebar buttons
document.getElementById('add-button').addEventListener('click', () => {
    if (addMode) {
        addMode = false;
        document.getElementById('add-button').classList.remove('button-down');
        updateSidebarTable(null);
    } else {
        addMode = true;
        document.getElementById('add-button').classList.add('button-down');
        const tbody = document.querySelector('#sidebar-table tbody');
        tbody.innerHTML = '<tr><td colspan="2">Click on the map to add a new hospital</td></tr>';
    }
});

// Modify map click handler
map.on('click', (e) => {
    if (addMode) {
        clickedLocation = e.latlng;
        updateSidebarTable(null, true); // Show editable table for new point
    } else if (selected_feat_leaflet) {
        selected_feat_leaflet.setIcon(hospitalIcon);
        selected_feat_leaflet = null;
        selected_feat_geojson = null;
        updateSidebarTable(null);
    }
});

// Modify the edit button click handler
document.getElementById('edit-button').addEventListener('click', (e) => {
    if (editMode) {
        // Turn off edit mode
        editMode = false;
        e.target.classList.remove('button-down');
        updateSidebarTable(selected_feat_geojson ? selected_feat_geojson.properties : null); // Reset table to non-editable state
    } else {
        if (selected_feat_geojson) {
            console.log('Entering edit mode for:', selected_feat_geojson); // Debug log
            editMode = true;
            e.target.classList.add('button-down');
            updateSidebarTable(selected_feat_geojson.properties, false, true); // Show editable table for edit mode
        } else {
            alert('Please select a hospital to edit');
        }
    }
});

// And remove button event listener
document.getElementById('remove-button').addEventListener('click', () => {
    if (selected_feat_geojson) {
        deleteHospital(selected_feat_geojson.properties.id);
    } else {
        alert('Please select a hospital to remove');
    }
});

// Add event listener for Escape key to close the form
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeForm();
    }
});

// SECTION 2: END ================================================================================================================