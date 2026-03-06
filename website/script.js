// Load JSON files
Promise.all([
    fetch("data/predictions.json").then(res => res.json()),
    fetch("data/hotspots.json").then(res => res.json()),
    fetch("data/city_data.json").then(res => res.json())
]).then(([predictions, hotspots, cityData]) => {

    // India map center
    var map = L.map("map").setView([22.9734, 78.6569], 5);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(map);

    // -----------------------------
    // AI Recommendation Engine
    // -----------------------------
    function getAIAdvice(aqi) {
        if (aqi > 300) {
            return `
            <b>🛑 Health Precautions:</b><br>
            • Stay indoors.<br>
            • Wear N95/KN95 masks.<br>
            • Avoid outdoor exercise.<br><br>

            <b>🌱 Eco-Friendly Suggestions:</b><br>
            • Avoid vehicles.<br>
            • Encourage carpooling.<br><br>

            <b>🚗 Emission Reduction:</b><br>
            • Avoid burning waste.<br>
            • Reduce generator usage.
            `;
        }
        if (aqi > 200) {
            return `
            <b>⚠ Health Precautions:</b><br>
            • Wear a mask outdoors.<br>
            • Limit outdoor time.<br><br>

            <b>🌱 Eco-Friendly Tips:</b><br>
            • Use public transport.<br><br>

            <b>🚗 Emission Reduction:</b><br>
            • Service vehicles regularly.
            `;
        }
        if (aqi > 150) {
            return `
            <b>❗ Health Precautions:</b><br>
            • Sensitive groups avoid going out.<br><br>

            <b>🌱 Eco-Friendly Tips:</b><br>
            • Save electricity.<br><br>

            <b>🚗 Emission Reduction:</b><br>
            • Avoid unnecessary driving.
            `;
        }
        if (aqi > 100) {
            return `
            <b>⚠ Moderate:</b> Safe for most.<br>
            Avoid long outdoor exercise.
            `;
        }
        return `
        ✔ Good Air Quality — Safe for all!
        `;
    }

    // -----------------------------
    // Dominant Pollutant
    // -----------------------------
    function getDominantPollutant(data) {
        let gases = {
            "PM2.5": data.PM25,
            "PM10": data.PM10,
            "NO₂": data.NO2,
            "SO₂": data.SO2,
            "CO": data.CO,
            "O₃": data.O3
        };

        let maxGas = Object.entries(gases).sort((a,b) => b[1] - a[1])[0];
        return `${maxGas[0]} (${maxGas[1]})`;
    }

    // -----------------------------
    // Gas Insights
    // -----------------------------
    function getGasInsights(data) {
        let messages = [];

        if (data.PM25 > 120) messages.push("⚠ High PM2.5 — wear N95 mask.");
        if (data.PM10 > 150) messages.push("⚠ High PM10 — avoid outdoor activity.");
        if (data.NO2 > 60)  messages.push("⚠ High NO₂ — traffic pollution.");
        if (data.SO2 > 40)  messages.push("⚠ High SO₂ — industrial emissions.");
        if (data.CO > 1.5)  messages.push("⚠ High CO — avoid vehicle-heavy roads.");
        if (data.O3 > 70)   messages.push("⚠ High Ozone — avoid exercise in sunlight.");

        if (messages.length === 0)
            return "✔ No major pollutant spikes.";

        return messages.join("<br>");
    }

    // -----------------------------
    // CITY LIST (40 cities)
    // -----------------------------
    const cities = {
        "Delhi": [28.7041, 77.1025],
        "Mumbai": [19.0760, 72.8777],
        "Bengenci": [12.9716, 77.5946],
        "Chennai": [13.0827, 80.2707],
        "Hyderabad": [17.3850, 78.4867],
        "Kolkata": [22.5726, 88.3639],
        "Ahmedabad": [23.0225, 72.5714],
        "Pune": [18.5204, 73.8567],
        "Jaipur": [26.9124, 75.7873],
        "Lucknow": [26.8467, 80.9462],
        "Kanpur": [26.4499, 80.3319],
        "Nagpur": [21.1458, 79.0882],
        "Indore": [22.7196, 75.8577],
        "Bhopal": [23.2599, 77.4126],
        "Patna": [25.5941, 85.1376],
        "Vadodara": [22.3072, 73.1812],
        "Surat": [21.1702, 72.8311],
        "Visakhapatnam": [17.6868, 83.2185],
        "Thiruvananthapuram": [8.5241, 76.9366],
        "Kochi": [9.9312, 76.2673],
        "Coimbatore": [11.0168, 76.9558],
        "Madurai": [9.9252, 78.1198],
        "Vijayawada": [16.5062, 80.6480],
        "Rajkot": [22.3039, 70.8022],
        "Jodhpur": [26.2389, 73.0243],
        "Guwahati": [26.1445, 91.7362],
        "Chandigarh": [30.7333, 76.7794],
        "Noida": [28.5355, 77.3910],
        "Gurugram": [28.4595, 77.0266],
        "Ghaziabad": [28.6692, 77.4538],
        "Agra": [27.1767, 78.0081],
        "Varanasi": [25.3176, 82.9739],
        "Meerut": [28.9845, 77.7064],
        "Nashik": [19.9975, 73.7898],
        "Aurangabad": [19.8762, 75.3433],
        "Mysuru": [12.2958, 76.6394],
        "Ranchi": [23.3441, 85.3096],
        "Raipur": [21.2514, 81.6296],
        "Jamshedpur": [22.8046, 86.2029]
    };

    // -----------------------------
    // Marker Colors
    // -----------------------------
    function getColor(cluster) {
        return cluster === 3 ? "red" :
               cluster === 2 ? "orange" :
               cluster === 1 ? "yellow" : "green";
    }

    // -----------------------------
    // Add all markers
    // -----------------------------
    let markers = {};

    Object.keys(cities).forEach(city => {
        if (!predictions[city] || hotspots[city] === undefined) return;

        let [lat, lon] = cities[city];
        let marker = L.circleMarker([lat, lon], {
            radius: 10,
            color: getColor(hotspots[city]),
            fillColor: getColor(hotspots[city]),
            fillOpacity: 0.9
        }).addTo(map)
          .bindPopup(
    `
    <div style="line-height:1.4; font-size:14px;">
        <b>${city}</b><br>
        AQI: <b>${cityData[city].AQI}</b><br>
        Dominant Pollutant: <b>${getDominantPollutant(cityData[city])}</b><br>
        Hotspot Level: <b>${hotspots[city]}</b><br><br>

        <b>🌟 AI Gas Insights:</b><br>
        ${getGasInsights(cityData[city])}<br><br>

        <b>🌟 AI Safety Advice:</b><br>
        ${getAIAdvice(cityData[city].AQI)}
    </div>
    `
);

        markers[city] = marker;
    });

    // -----------------------------
    // SEARCH CITY
    // -----------------------------
    document.getElementById("searchBtn").onclick = function () {
        let city = document.getElementById("searchBox").value.trim();
        if (!cities[city]) return alert("City not found!");
        map.setView(cities[city], 10);
        markers[city].openPopup();
    };

    // -----------------------------
    // COMPARISON DROPDOWN SETUP
    // -----------------------------
    let c1 = document.getElementById("city1");
    let c2 = document.getElementById("city2");

    Object.keys(cities).forEach(city => {
        c1.innerHTML += `<option value="${city}">${city}</option>`;
        c2.innerHTML += `<option value="${city}">${city}</option>`;
    });

    // -----------------------------
    // CITY COMPARISON
    // -----------------------------
    document.getElementById("compareBtn").onclick = function () {
        let a = c1.value, b = c2.value;
        if (!a || !b || a === b) return alert("Pick two different cities!");

        let box = document.getElementById("compareResult");
        box.innerHTML = `
            <h3>${a} vs ${b}</h3>
            <p><b>${a} AQI:</b> ${cityData[a].AQI}</p>
            <p><b>${b} AQI:</b> ${cityData[b].AQI}</p>
            <p><b>Cleaner Air:</b> ${cityData[a].AQI < cityData[b].AQI ? a : b}</p>
        `;
        box.style.display = "block";
    };

    // -----------------------------
    // FILTERS
    // -----------------------------
    function hideAllMarkers() {
        Object.values(markers).forEach(m => m.remove());
    }

    function showMarkers(filter) {
        hideAllMarkers();
        Object.keys(cities).forEach(city => {
            if (filter(cityData[city].AQI)) {
                markers[city].addTo(map);
            }
        });
    }

    document.getElementById("showAllBtn").onclick = () => showMarkers(() => true);
    document.getElementById("showHazBtn").onclick = () => showMarkers(aqi => aqi > 300);
    document.getElementById("showPoorBtn").onclick = () => showMarkers(aqi => aqi > 200 && aqi <= 300);
    document.getElementById("showModerateBtn").onclick = () => showMarkers(aqi => aqi > 100 && aqi <= 200);
    document.getElementById("showGoodBtn").onclick = () => showMarkers(aqi => aqi <= 100);

    // -----------------------------
    // HEATMAP
    // -----------------------------
    let heatmapLayer = null;

    document.getElementById("heatmapBtn").onclick = function () {
        if (heatmapLayer) {
            map.removeLayer(heatmapLayer);
            heatmapLayer = null;
            return;
        }

        let heatData = [];

        Object.keys(cities).forEach(city => {
            if (cityData[city]) {
                let [lat, lon] = cities[city];
                let intensity = Math.min(cityData[city].AQI / 150, 1);
                heatData.push([lat, lon, intensity]);
            }
        });

        heatmapLayer = L.heatLayer(heatData, {
            radius: 45,
            blur: 25,
            max: 1.5,
            gradient: {
                0.2: "blue",
                0.4: "lime",
                0.6: "yellow",
                0.8: "orange",
                1.0: "red"
            }
        }).addTo(map);
    };
});
