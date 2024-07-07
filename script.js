let earthquakeLayer, heatmapLayer;
let allEarthquakes = [];

const map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

async function getEarthquakeData(timeRange = 'day') {
    showLoading();
    const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_${timeRange}.geojson`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        hideLoading();
        return data.features;
    } catch (error) {
        console.error('Error fetching earthquake data:', error);
        hideLoading();
        return [];
    }
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function getMarkerSize(magnitude) {
    return Math.max(magnitude * 5, 5);
}

function getMarkerColor(magnitude) {
    return magnitude >= 8 ? '#FF0000' :
           magnitude >= 7 ? '#FF4500' :
           magnitude >= 6 ? '#FFA500' :
           magnitude >= 4 ? '#FFD700' :
           magnitude >= 2 ? '#ADFF2F' :
                            '#00FF00';
}

function addEarthquakeMarkers(earthquakes) {
    earthquakeLayer = L.layerGroup().addTo(map);
    heatmapLayer = L.layerGroup().addTo(map);
    updateEarthquakeMarkers(earthquakes);
}

function updateEarthquakeMarkers(earthquakes) {
    const minMagnitude = parseFloat(document.getElementById('mag-slider').value);
    
    earthquakeLayer.clearLayers();
    heatmapLayer.clearLayers();
    
    const heatmapPoints = [];
    
    earthquakes.forEach(quake => {
        const {coordinates} = quake.geometry;
        const {mag, place, time} = quake.properties;
        
        if (mag >= minMagnitude) {
            L.circleMarker([coordinates[1], coordinates[0]], {
                radius: getMarkerSize(mag),
                fillColor: getMarkerColor(mag),
                color: '#000',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(earthquakeLayer).bindPopup(`
                <b>Magnitude ${mag}</b><br>
                Location: ${place}<br>
                Time: ${moment(time).format('MMMM Do YYYY, h:mm:ss a')}
            `);
            
            heatmapPoints.push([coordinates[1], coordinates[0], mag]);
        }
    });
    
    L.heatLayer(heatmapPoints, {radius: 25}).addTo(heatmapLayer);
    updateStatistics(earthquakes, minMagnitude);
}

function isInDepthRange(depth, range) {
    switch(range) {
        case 'shallow': return depth <= 70;
        case 'intermediate': return depth > 70 && depth <= 300;
        case 'deep': return depth > 300;
        default: return true;
    }
}

function initMagnitudeFilter(earthquakes) {
    const slider = document.getElementById('mag-slider');
    const output = document.getElementById('mag-value');
    output.innerHTML = slider.value;

    slider.oninput = function() {
        output.innerHTML = this.value;
        updateEarthquakeMarkers(earthquakes);
    }
}

function initTimeFilter() {
    const select = document.getElementById('time-select');
    select.onchange = async function() {
        allEarthquakes = await getEarthquakeData(this.value);
        updateEarthquakeMarkers(allEarthquakes);
    }
}

function initDepthFilter() {
    const select = document.getElementById('depth-select');
    select.onchange = function() {
        updateEarthquakeMarkers(allEarthquakes);
    }
}

function updateStatistics(earthquakes, minMagnitude) {
    const filteredQuakes = earthquakes.filter(quake => quake.properties.mag >= minMagnitude);
    const totalQuakes = filteredQuakes.length;
    const avgMagnitude = filteredQuakes.reduce((sum, quake) => sum + quake.properties.mag, 0) / totalQuakes;
    const maxMagnitude = Math.max(...filteredQuakes.map(quake => quake.properties.mag));
    const mostRecentQuake = filteredQuakes.reduce((latest, quake) => 
        quake.properties.time > latest.properties.time ? quake : latest
    );
    const mostRecent = moment(mostRecentQuake.properties.time).fromNow();

    document.getElementById('total-quakes').textContent = totalQuakes;
    document.getElementById('avg-magnitude').textContent = avgMagnitude.toFixed(2);
    document.getElementById('max-magnitude').textContent = maxMagnitude.toFixed(2);
    document.getElementById('most-recent').textContent = mostRecent;

    // Add click event to show most recent earthquake
    document.getElementById('most-recent').onclick = function() {
        const {coordinates} = mostRecentQuake.geometry;
        map.setView([coordinates[1], coordinates[0]], 8);
        L.popup()
            .setLatLng([coordinates[1], coordinates[0]])
            .setContent(`
                <b>Most Recent Earthquake</b><br>
                Magnitude: ${mostRecentQuake.properties.mag}<br>
                Location: ${mostRecentQuake.properties.place}<br>
                Time: ${moment(mostRecentQuake.properties.time).format('MMMM Do YYYY, h:mm:ss a')}
            `)
            .openOn(map);
    };
}

async function initApp() {
    allEarthquakes = await getEarthquakeData();
    if (allEarthquakes.length === 0) {
        console.log('No earthquake data received');
        return;
    }
    addEarthquakeMarkers(allEarthquakes);
    initMagnitudeFilter(allEarthquakes);
    initTimeFilter();
}

initApp();