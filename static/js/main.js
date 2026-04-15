/* ======================================================
   DRIVER ADVISORY SYSTEM - MAIN JAVASCRIPT
   Hafsa Rehman (2023-ag-9950)
   
   CSS has been moved to style.css - much cleaner now!
   ====================================================== */

// ==================== MAP SETUP ====================

let map = L.map("map").setView([31.4504, 73.1350], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
}).addTo(map);

// ==================== GLOBAL VARIABLES ====================

let userMarker = null;
let accuracyCircle = null;
let hazardMarkers = [];
let routePoints = null;

let isDriving = false;
let gpsWatchId = null;
let lastPos = null;

let voiceRecog = null;
let isListening = false;
let wakeWordRecog = null;
let wakeWordActive = false;

let offlineDB = null;
let alertedReports = {};

// ==================== ROTATING ARROW ====================

function createUserArrow() {
    return L.divIcon({
        className: 'user-arrow',
        html: `
            <div class="arrow-container">
                <svg viewBox="0 0 24 24">
                    <polygon points="12,2 22,22 12,18 2,22 12,2" />
                </svg>
                <div class="speed-tag" id="speedTag">0</div>
            </div>
        `,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    });
}

function rotateUserArrow(degrees) {
    if (!userMarker) return;
    
    let element = userMarker.getElement();
    if (element) {
        let arrowDiv = element.querySelector('.arrow-container');
        if (arrowDiv) {
            arrowDiv.style.transform = `rotate(${degrees}deg)`;
        }
    }
}

function updateSpeedTag(speed) {
    if (!userMarker) return;
    
    let element = userMarker.getElement();
    if (element) {
        let tag = element.querySelector('.speed-tag');
        if (tag) {
            tag.textContent = speed;
            
            // Remove old color classes
            tag.classList.remove('speed-0', 'speed-normal', 'speed-fast', 'speed-speeding');
            
            // Add appropriate class
            if (speed > 100) tag.classList.add('speed-speeding');
            else if (speed > 60) tag.classList.add('speed-fast');
            else if (speed > 0) tag.classList.add('speed-normal');
            else tag.classList.add('speed-0');
        }
    }
}

// ==================== LOCATION TRACKING ====================

function updateUserLocation(lat, lng, heading = 0) {
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    
    let arrowIcon = createUserArrow();
    userMarker = L.marker([lat, lng], { icon: arrowIcon }).addTo(map);

    if (accuracyCircle) {
        accuracyCircle.setLatLng([lat, lng]);
    } else {
        accuracyCircle = L.circle([lat, lng], { 
            radius: 40,
            color: '#3388ff',
            opacity: 0.3,
            fillOpacity: 0.1
        }).addTo(map);
    }

    if (heading !== null) {
        rotateUserArrow(heading);
    }

    if (isDriving) {
        map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }
}

function startGPSTracking() {
    if (!navigator.geolocation) {
        alert("GPS not supported");
        return;
    }
    
    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
    }
    
    gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
            let lat = position.coords.latitude;
            let lng = position.coords.longitude;
            let heading = position.coords.heading || 0;
            let speed = position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0;
            
            lastPos = { lat, lng };
            
            updateUserLocation(lat, lng, heading);
            updateSpeedTag(speed);
            checkHazards(lat, lng);
        },
        (error) => {
            console.log("GPS error:", error.message);
            
            // Show error notification
            showNotification("Please enable GPS", "error");
            
            if (lastPos) {
                updateUserLocation(lastPos.lat, lastPos.lng, 0);
            } else {
                updateUserLocation(31.4504, 73.1350, 0);
            }
        },
        {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 10000
        }
    );
}

// ==================== HAZARD CHECKING ====================

async function checkHazards(lat, lng) {
    if (!isDriving) return;
    
    if (!navigator.onLine) {
        // Offline - check existing markers
        hazardMarkers.forEach(marker => {
            let markerPos = marker.getLatLng();
            let dist = calculateDistance(lat, lng, markerPos.lat, markerPos.lng);
            
            let popup = marker.getPopup();
            if (!popup) return;
            
            let content = popup.getContent();
            let type = "Unknown";
            if (content.includes("Police")) type = "Police checkpoint";
            else if (content.includes("Accident")) type = "Accident";
            else if (content.includes("Work")) type = "Road work";
            else if (content.includes("Block")) type = "Traffic block";
            
            if (type.includes("Police") && dist <= 300) {
                speakNow("Police checkpoint in this area. Drive carefully.");
            } else if (dist <= 500 && dist > 10) {
                let direction = getDirection(lat, lng, markerPos.lat, markerPos.lng);
                let distRound = Math.round(dist / 10) * 10;
                speakNow(`${type} ${distRound} meters ${direction}`);
            }
        });
        return;
    }
    
    try {
        let response = await fetch(`/nearby?lat=${lat}&lng=${lng}`);
        let hazards = await response.json();
        updateHazardMarkers(hazards);
    } catch (e) {
        console.log("Error checking hazards:", e);
    }
}

function updateHazardMarkers(hazards) {
    hazardMarkers.forEach(m => map.removeLayer(m));
    hazardMarkers = [];

    if (!hazards || hazards.length === 0) return;

    hazards.forEach(h => {
        let color = "red";
        if (h.type.includes("Police")) color = "#8e44ad";
        if (h.type.includes("Work")) color = "#e67e22";
        
        let marker = L.circle([h.lat, h.lng], {
            radius: 40,
            color: color,
            fillColor: color,
            fillOpacity: 0.7
        }).addTo(map);
        
        marker.bindPopup(`
            <div class="hazard-popup">
                <div class="popup-title" style="color:${color};">⚠️ ${h.type}</div>
                ${h.distance ? h.distance + " km away" : ""}
            </div>
        `);
        
        hazardMarkers.push(marker);
    });
}

// ==================== ADD MARKER ====================

function addHazardMarker(type, lat, lng, isOffline = false) {
    let color = "red";
    if (type.includes("Police")) color = "#8e44ad";
    if (type.includes("Work")) color = "#e67e22";
    if (type.includes("Accident")) color = "#c0392b";
    
    let marker = L.circle([lat, lng], {
        radius: 50,
        color: color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: isOffline ? 4 : 3,
        className: isOffline ? 'hazard-marker offline' : 'hazard-marker'
    }).addTo(map);
    
    let statusClass = isOffline ? 'offline' : 'online';
    let statusText = isOffline ? '📦 SAVED OFFLINE' : '✅ REPORTED';
    
    marker.bindPopup(`
        <div class="hazard-popup">
            <div class="popup-title" style="color:${color};">⚠️ ${type}</div>
            <div class="status-badge ${statusClass}">${statusText}</div>
            <div class="popup-time">${new Date().toLocaleTimeString()}</div>
        </div>
    `);
    
    if (isOffline) {
        marker.openPopup();
        setTimeout(() => marker.closePopup(), 4000);
    }
    
    hazardMarkers.push(marker);
    map.panTo([lat, lng]);
}

// ==================== SAVE REPORT ====================

async function saveReport(type, lat, lng) {
    let report = {
        lat, lng, type,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 2*60*60*1000).toISOString()
    };
    
    if (navigator.onLine) {
        try {
            let res = await fetch("/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(report)
            });
            
            let data = await res.json();
            
            if (data.status === "ok") {
                speakNow(`${type} reported`);
                showNotification(`${type} reported!`, "success");
                addHazardMarker(type, lat, lng, false);
                return;
            } else {
                saveOffline(report, type, lat, lng);
            }
        } catch (e) {
            saveOffline(report, type, lat, lng);
        }
    } else {
        saveOffline(report, type, lat, lng);
    }
}

function saveOffline(report, type, lat, lng) {
    if (!offlineDB) {
        speakNow("Cannot save offline");
        return;
    }
    
    try {
        let transaction = offlineDB.transaction(['offlineReports'], 'readwrite');
        let store = transaction.objectStore('offlineReports');
        
        store.add({
            ...report,
            timestamp: new Date().toISOString(),
            synced: false
        });
        
        speakNow(`${type} saved offline`);
        showNotification(`${type} saved offline!`, "offline");
        addHazardMarker(type, lat, lng, true);
        
    } catch (e) {
        console.log("Offline error:", e);
    }
}

// ==================== NOTIFICATION ====================

function showNotification(message, type = "success") {
    let notif = document.createElement("div");
    notif.className = `notification ${type}`;
    notif.innerHTML = `📦 ${message}`;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = "fadeOut 0.3s";
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// ==================== WAKE WORD ====================

function initWakeWord() {
    if (!('webkitSpeechRecognition' in window)) return;
    
    const SpeechRecognition = window.webkitSpeechRecognition;
    wakeWordRecog = new SpeechRecognition();
    
    wakeWordRecog.continuous = true;
    wakeWordRecog.interimResults = true;
    
    wakeWordRecog.onresult = (event) => {
        let last = event.results.length - 1;
        let text = event.results[last][0].transcript.toLowerCase();
        
        if (text.includes("hey report") || text.includes("report")) {
            if (navigator.vibrate) navigator.vibrate(200);
            
            wakeWordRecog.stop();
            wakeWordActive = false;
            hideWakeIndicator();
            
            startVoiceReporting();
        }
    };
    
    wakeWordRecog.onerror = () => {
        if (wakeWordActive && isDriving) {
            setTimeout(() => {
                try { wakeWordRecog.start(); } catch (e) {}
            }, 1000);
        }
    };
    
    wakeWordRecog.onend = () => {
        if (wakeWordActive && isDriving) {
            setTimeout(() => {
                try {
                    wakeWordRecog.start();
                } catch (e) {}
            }, 500);
        }
    };
}

function startWakeWord() {
    if (!wakeWordRecog) initWakeWord();
    
    if (wakeWordRecog && !wakeWordActive) {
        try {
            wakeWordRecog.start();
            wakeWordActive = true;
            showWakeIndicator();
        } catch (e) {}
    }
}

function stopWakeWord() {
    if (wakeWordRecog && wakeWordActive) {
        wakeWordRecog.stop();
        wakeWordActive = false;
        hideWakeIndicator();
    }
}

function showWakeIndicator() {
    let indicator = document.getElementById("wakeIndicator");
    if (!indicator) {
        indicator = document.createElement("div");
        indicator.id = "wakeIndicator";
        indicator.className = "wake-indicator";
        indicator.innerHTML = "🎤 Say 'Hey Report'";
        document.body.appendChild(indicator);
    }
    indicator.style.display = "block";
    
    let badge = document.getElementById("wakeBadge");
    if (!badge) {
        badge = document.createElement("div");
        badge.id = "wakeBadge";
        badge.className = "wake-badge";
        badge.innerHTML = "🎤 Wake word active";
        document.body.appendChild(badge);
    }
    badge.style.display = "block";
}

function hideWakeIndicator() {
    let indicator = document.getElementById("wakeIndicator");
    if (indicator) indicator.style.display = "none";
    
    let badge = document.getElementById("wakeBadge");
    if (badge) badge.style.display = "none";
}

// ==================== VOICE REPORTING ====================

function initVoice() {
    if (!('webkitSpeechRecognition' in window)) return;
    
    const SpeechRecognition = window.webkitSpeechRecognition;
    voiceRecog = new SpeechRecognition();
    
    voiceRecog.continuous = false;
    voiceRecog.interimResults = false;
    
    voiceRecog.onresult = (event) => {
        let text = event.results[0][0].transcript.toLowerCase();
        handleVoiceCommand(text);
    };
    
    voiceRecog.onerror = () => {
        resetVoiceButton();
    };
    
    voiceRecog.onend = () => {
        resetVoiceButton();
    };
    
    addVoiceButton();
}

function startVoiceReporting() {
    speakNow("What do you want to report?");
    
    if (wakeWordActive) {
        wakeWordRecog.stop();
    }
    
    setTimeout(() => {
        if (voiceRecog) {
            try {
                voiceRecog.start();
                isListening = true;
                
                let btn = document.getElementById("voiceBtn");
                if (btn) {
                    btn.classList.add('listening');
                }
            } catch (e) {}
        }
    }, 1500);
}

function handleVoiceCommand(text) {
    resetVoiceButton();
    
    let keywords = {
        "accident": ["accident", "crash", "collision"],
        "Traffic block": ["block", "jam", "traffic"],
        "Police checkpoint": ["police", "checkpoint", "cops"],
        "Road work": ["construction", "work", "workers"]
    };
    
    let reportType = null;
    for (let [type, words] of Object.entries(keywords)) {
        if (words.some(w => text.includes(w))) {
            reportType = type;
            break;
        }
    }
    
    if (reportType) {
        speakNow(`Reporting ${reportType}`);
        
        if (lastPos) {
            saveReport(reportType, lastPos.lat, lastPos.lng);
        } else {
            navigator.geolocation.getCurrentPosition((pos) => {
                saveReport(reportType, pos.coords.latitude, pos.coords.longitude);
            });
        }
    } else {
        speakNow("Please say accident, block, police, or road work");
    }
}

function addVoiceButton() {
    if (document.getElementById("voiceBtn")) return;
    
    let btn = document.createElement("div");
    btn.id = "voiceBtn";
    btn.className = "voice-btn";
    btn.innerHTML = "🎤";
    btn.onclick = toggleVoice;
    document.body.appendChild(btn);
}

function resetVoiceButton() {
    isListening = false;
    let btn = document.getElementById("voiceBtn");
    if (btn) {
        btn.classList.remove('listening');
    }
}

function toggleVoice() {
    if (isListening) {
        if (voiceRecog) voiceRecog.stop();
        resetVoiceButton();
    } else {
        startVoiceReporting();
    }
}

// ==================== UTILITY FUNCTIONS ====================

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getDirection(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI/180);
    const x = Math.cos(lat1 * Math.PI/180) * Math.sin(lat2 * Math.PI/180) -
              Math.sin(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    if (bearing < 0) bearing += 360;
    
    if (bearing >= 315 || bearing < 45) return "ahead";
    if (bearing >= 45 && bearing < 135) return "on your right";
    if (bearing >= 135 && bearing < 225) return "behind you";
    return "on your left";
}

function speakNow(text) {
    try {
        speechSynthesis.cancel();
        let utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    } catch (e) {}
}

// ==================== ROUTE PLANNING ====================

async function planRoute() {
    let start = document.getElementById("startLoc").value.trim();
    let end = document.getElementById("endLoc").value.trim();

    if (!start || !end) {
        alert("Please enter start and destination");
        return;
    }

    document.getElementById("routeInfo").innerHTML = "Calculating...";
    document.getElementById("startJourneyBtn").style.display = "none";

    try {
        let startCoords, endCoords;
        
        if (start.toLowerCase() === "current") {
            let pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            startCoords = [pos.coords.latitude, pos.coords.longitude];
        } else {
            startCoords = await geocode(start);
        }

        endCoords = await geocode(end);

        if (!startCoords || !endCoords) {
            throw new Error("Location not found");
        }

        let response = await fetch("/api/route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                start_lat: startCoords[0],
                start_lng: startCoords[1],
                end_lat: endCoords[0],
                end_lng: endCoords[1]
            })
        });

        let routeData = await response.json();
        
        if (routeData.error) throw new Error(routeData.error);

        L.polyline(routeData.coordinates, {
            color: "#1E90FF",
            weight: 6,
            opacity: 0.9
        }).addTo(map);

        routePoints = routeData.coordinates.map(coord => ({
            lat: coord[0],
            lng: coord[1]
        }));

        document.getElementById("routeInfo").innerHTML = `
            📍 ${routeData.distance} km | ⏱️ ${routeData.duration} min
        `;

        document.getElementById("startJourneyBtn").style.display = "block";
        
        let bounds = L.latLngBounds(routeData.coordinates);
        map.fitBounds(bounds, { padding: [50, 50] });

    } catch (error) {
        document.getElementById("routeInfo").innerHTML = "❌ Route failed";
    }
}

async function geocode(name) {
    try {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`;
        let res = await fetch(url, {
            headers: { 'User-Agent': 'DriverAdvisorySystem/1.0' }
        });
        let data = await res.json();
        
        if (data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
    } catch (e) {}
    
    return null;
}

// ==================== DRIVING MODE ====================

function startDriving() {
    isDriving = true;
    document.body.classList.add("darkMode");
    
    document.getElementById("emergencyStop").style.display = "block";
    
    startWakeWord();
    map.setZoom(18);
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                lastPos = { 
                    lat: pos.coords.latitude, 
                    lng: pos.coords.longitude 
                };
                
                updateUserLocation(
                    pos.coords.latitude, 
                    pos.coords.longitude,
                    pos.coords.heading || 0
                );
                
                startGPSTracking();
                speakNow("Drive mode activated");
            },
            (err) => {
                lastPos = { lat: 31.4504, lng: 73.1350 };
                updateUserLocation(31.4504, 73.1350, 0);
                startGPSTracking();
            }
        );
    }
}

function stopDriving() {
    isDriving = false;
    document.body.classList.remove("darkMode");
    map.setZoom(13);
    
    document.getElementById("emergencyStop").style.display = "none";
    
    stopWakeWord();
    
    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    
    speakNow("Drive mode deactivated");
}

// ==================== UI CONTROLS ====================

function toggleReportMenu() {
    let menu = document.getElementById("reportMenu");
    menu.style.display = menu.style.display === "block" ? "none" : "block";
}

async function manualReport() {
    let type = document.getElementById("reportType").value;
    if (!type) return;
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        await saveReport(type, pos.coords.latitude, pos.coords.longitude);
        document.getElementById("reportMenu").style.display = "none";
        document.getElementById("reportType").value = "";
    });
}

// ==================== OFFLINE STORAGE ====================

function setupOfflineDB() {
    let request = indexedDB.open('DriverDB', 1);
    
    request.onupgradeneeded = (event) => {
        let db = event.target.result;
        if (!db.objectStoreNames.contains('offlineReports')) {
            db.createObjectStore('offlineReports', { autoIncrement: true });
        }
    };
    
    request.onsuccess = (event) => {
        offlineDB = event.target.result;
    };
}

// ==================== INITIALIZATION ====================

window.addEventListener('load', () => {
    setupOfflineDB();
    initVoice();
    initWakeWord();
    
    // Add emergency stop button
    let stopBtn = document.createElement("div");
    stopBtn.id = "emergencyStop";
    stopBtn.className = "emergency-stop";
    stopBtn.innerHTML = "🛑 STOP";
    stopBtn.onclick = stopDriving;
    document.body.appendChild(stopBtn);
    
    // Add offline banner
    let banner = document.createElement("div");
    banner.id = "offlineBanner";
    banner.className = "offline-banner";
    banner.innerHTML = "📡 OFFLINE MODE - Reports saved locally";
    document.body.appendChild(banner);
    
    window.addEventListener('online', () => {
        document.getElementById('offlineBanner').style.display = 'none';
    });
    
    window.addEventListener('offline', () => {
        document.getElementById('offlineBanner').style.display = 'block';
    });
});

// Expose functions to HTML
window.startPlanning = planRoute;
window.startDriving = startDriving;
window.stopDriving = stopDriving;
window.toggleReportMenu = toggleReportMenu;
window.sendManualReport = manualReport;