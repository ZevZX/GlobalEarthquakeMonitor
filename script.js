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
    const minMagnitude = parseFloat(document.getElementById('min-mag-slider').value);
    const maxMagnitude = parseFloat(document.getElementById('max-mag-slider').value);
    
    earthquakeLayer.clearLayers();
    heatmapLayer.clearLayers();
    
    const heatmapPoints = [];
    
    earthquakes.forEach(quake => {
        const {coordinates} = quake.geometry;
        const {mag, place, time} = quake.properties;
        
        if (mag >= minMagnitude && mag <= maxMagnitude) {
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
    updateStatistics(earthquakes, minMagnitude, maxMagnitude);
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
    const minSlider = document.getElementById('min-mag-slider');
    const maxSlider = document.getElementById('max-mag-slider');
    const minOutput = document.getElementById('min-mag-value');
    const maxOutput = document.getElementById('max-mag-value');

    minOutput.innerHTML = minSlider.value;
    maxOutput.innerHTML = maxSlider.value;

    minSlider.oninput = function() {
        minOutput.innerHTML = this.value;
        if (parseFloat(this.value) > parseFloat(maxSlider.value)) {
            maxSlider.value = this.value;
            maxOutput.innerHTML = this.value;
        }
        updateEarthquakeMarkers(earthquakes);
    }

    maxSlider.oninput = function() {
        maxOutput.innerHTML = this.value;
        if (parseFloat(this.value) < parseFloat(minSlider.value)) {
            minSlider.value = this.value;
            minOutput.innerHTML = this.value;
        }
        updateEarthquakeMarkers(earthquakes);
    }
}

function initTimeFilter() {
    const select = document.getElementById('time-select');
    select.onchange = async function() {
        allEarthquakes = await getEarthquakeData(this.value);
        updateEarthquakeMarkers(allEarthquakes);
        updateTimeRangeDisplay(this.value);
    }
}

function updateTimeRangeDisplay(timeRange) {
    const timeRangeDisplay = document.getElementById('time-range-display');
    if (timeRangeDisplay) {
        timeRangeDisplay.textContent = getTimeRangeText(timeRange);
    }
}

function getTimeRangeText(timeRange) {
    switch(timeRange) {
        case 'hour': return 'Past Hour';
        case 'day': return 'Past Day';
        case 'week': return 'Past 7 Days';
        case 'month': return 'Past 30 Days';
        default: return '';
    }
}

function initDepthFilter() {
    const select = document.getElementById('depth-select');
    select.onchange = function() {
        updateEarthquakeMarkers(allEarthquakes);
    }
}
function updateStatistics(earthquakes, minMagnitude, maxMagnitude) {
    const filteredQuakes = earthquakes.filter(quake => 
        quake.properties.mag >= minMagnitude && quake.properties.mag <= maxMagnitude
    );
    const totalQuakes = filteredQuakes.length;
    const avgMagnitude = filteredQuakes.reduce((sum, quake) => sum + quake.properties.mag, 0) / totalQuakes;
    
    const strongestQuake = filteredQuakes.reduce((strongest, quake) => 
        quake.properties.mag > strongest.properties.mag ? quake : strongest
    );
    const weakestQuake = filteredQuakes.reduce((weakest, quake) => 
        quake.properties.mag < weakest.properties.mag ? quake : weakest
    );
    const mostRecentQuake = filteredQuakes.reduce((latest, quake) => 
        quake.properties.time > latest.properties.time ? quake : latest
    );

    const mostRecent = moment(mostRecentQuake.properties.time).fromNow();

    document.getElementById('total-quakes').textContent = totalQuakes;
    document.getElementById('avg-magnitude').textContent = avgMagnitude.toFixed(2);
    document.getElementById('max-magnitude').textContent = strongestQuake.properties.mag.toFixed(2);
    document.getElementById('min-magnitude').textContent = weakestQuake.properties.mag.toFixed(2);
    document.getElementById('most-recent').textContent = mostRecent;

    document.getElementById('most-recent').onclick = function() {
        showEarthquakeOnMap(mostRecentQuake, 'Most Recent Earthquake');
    };

    document.getElementById('max-magnitude').onclick = function() {
        showEarthquakeOnMap(strongestQuake, 'Strongest Earthquake');
    };

    document.getElementById('min-magnitude').onclick = function() {
        showEarthquakeOnMap(weakestQuake, 'Weakest Earthquake');
    };
}

function showEarthquakeOnMap(quake, title) {
    const {coordinates} = quake.geometry;
    map.setView([coordinates[1], coordinates[0]], 8);
    L.popup()
        .setLatLng([coordinates[1], coordinates[0]])
        .setContent(`
            <b>${title}</b><br>
            Magnitude: ${quake.properties.mag}<br>
            Location: ${quake.properties.place}<br>
            Time: ${moment(quake.properties.time).format('MMMM Do YYYY, h:mm:ss a')}
        `)
        .openOn(map);
}

async function initApp() {
    const timeSelect = document.getElementById('time-select');
    const selectedTimeRange = timeSelect.value;
    allEarthquakes = await getEarthquakeData(selectedTimeRange);
    if (allEarthquakes.length === 0) {
        console.log('No earthquake data received');
        return;
    }
    addEarthquakeMarkers(allEarthquakes);
    initMagnitudeFilter(allEarthquakes);
    initTimeFilter();
    initSidebarToggle();
    updateTimeRangeDisplay(selectedTimeRange);
}

function initSidebarToggle() {
    const toggleBtn = document.getElementById('toggle-sidebar');
    const sidebar = document.getElementById('sidebar');
    const map = document.getElementById('map');

    toggleBtn.addEventListener('click', function() {
        sidebar.classList.toggle('active');
        if (sidebar.classList.contains('active')) {
            map.style.marginRight = '0';
        } else {
            map.style.marginRight = '0';
        }
    });
}

initApp();