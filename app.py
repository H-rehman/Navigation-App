"""
Driver Advisory System - Backend
UAF Software Engineering Project
Hafsa Rehman (2023-ag-9950)
"""

from flask import Flask, render_template, request, jsonify
import sqlite3
from datetime import datetime, timedelta
import math
import requests
import os

app = Flask(__name__)

# Database file - will be created automatically
DB_NAME = "advisories.db"

# ==================== DATABASE FUNCTIONS ====================

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row  # This lets us access columns by name
    return conn

def init_db():
    """Create database tables if they don't exist"""
    print("Setting up database...")
    
    conn = get_db()
    cur = conn.cursor()

    # Main table for storing road advisories
    cur.execute("""
        CREATE TABLE IF NOT EXISTS advisories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL,
            lng REAL,
            type TEXT,
            created_at TEXT,
            expires_at TEXT,
            ip TEXT
        )
    """)

    # Try to add ip column if it doesn't exist (for older databases)
    try:
        cur.execute("ALTER TABLE advisories ADD COLUMN ip TEXT")
        print("Added IP column")
    except:
        # Column already exists, that's fine
        pass

    conn.commit()
    conn.close()
    print("Database ready!")

# ==================== ROUTES ====================

@app.route("/")
def home():
    """Main page - shows the map interface"""
    return render_template("index.html")

@app.route("/report", methods=["POST"])
def report_advisory():
    """
    Save a new advisory report
    Limits: 10 reports per hour per IP (to prevent spam)
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data received"}), 400

    lat = data.get("lat")
    lng = data.get("lng")
    type_ = data.get("type")

    # Validate input
    if lat is None or lng is None or type_ is None:
        return jsonify({"error": "Missing required fields"}), 400

    user_ip = request.remote_addr or "unknown"
    now = datetime.utcnow()
    one_hour_ago = now - timedelta(hours=1)

    conn = get_db()
    cur = conn.cursor()

    # Check rate limit
    cur.execute("""
        SELECT COUNT(*) as cnt
        FROM advisories
        WHERE ip = ?
        AND created_at >= ?
    """, (user_ip, one_hour_ago.isoformat()))

    result = cur.fetchone()
    count = result["cnt"] if result else 0

    if count >= 10:
        conn.close()
        return jsonify({
            "error": "Too many reports. Please wait an hour."
        }), 429

    # Reports expire after 2 hours
    expires = now + timedelta(hours=2)

    cur.execute("""
        INSERT INTO advisories (lat, lng, type, created_at, expires_at, ip)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        float(lat),
        float(lng),
        type_,
        now.isoformat(),
        expires.isoformat(),
        user_ip
    ))

    conn.commit()
    conn.close()

    return jsonify({"status": "ok", "message": "Report saved"})

@app.route("/nearby")
def get_nearby():
    """Get active advisories near the user"""
    try:
        user_lat = float(request.args.get("lat"))
        user_lng = float(request.args.get("lng"))
    except (TypeError, ValueError):
        return jsonify([])

    conn = get_db()
    cur = conn.cursor()

    # Get all active (not expired) advisories
    cur.execute("""
        SELECT * FROM advisories
        WHERE expires_at > datetime('now')
    """)

    rows = cur.fetchall()
    conn.close()

    # Calculate distance using Haversine formula
    # Got this formula from stackoverflow
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371  # Earth's radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat/2) * math.sin(dlat/2) +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon/2) * math.sin(dlon/2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    nearby = []

    for r in rows:
        dist = haversine(user_lat, user_lng, r["lat"], r["lng"])
        
        # Only return reports within 1km
        if dist <= 1.0:
            nearby.append({
                "type": r["type"],
                "lat": r["lat"],
                "lng": r["lng"],
                "distance": round(dist, 2)
            })

    return jsonify(nearby)

@app.route("/api/route", methods=["POST"])
def get_route():
    """
    Get driving route between two points
    Uses OpenRouteService API (free tier)
    """
    data = request.get_json()
    
    start_lat = data.get("start_lat")
    start_lng = data.get("start_lng")
    end_lat = data.get("end_lat")
    end_lng = data.get("end_lng")
    
    # My API key - got it from openrouteservice.org
    # Free tier allows 2000 requests per day
    API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjI2NmJiMWEyODM0MzRhMzhhNmNlMzQwMGIxYWE0MzNkIiwiaCI6Im11cm11cjY0In0="  # Replace with your own
    
    # OpenRouteService endpoint
    url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
    
    headers = {
        'Authorization': API_KEY,
        'Content-Type': 'application/json'
    }
    
    # API expects [longitude, latitude] format
    body = {
        "coordinates": [[start_lng, start_lat], [end_lng, end_lat]],
        "instructions": False  # We don't need turn-by-turn
    }
    
    try:
        print(f"Fetching route from {start_lat},{start_lng} to {end_lat},{end_lng}")
        
        response = requests.post(url, json=body, headers=headers, timeout=10)
        data = response.json()
        
        if response.status_code != 200:
            print("API error:", data)
            return jsonify({"error": "Routing service failed"}), 400
            
        # Extract route data
        coordinates = data['features'][0]['geometry']['coordinates']
        
        # Convert to [lat, lng] format for Leaflet
        route_coords = [[coord[1], coord[0]] for coord in coordinates]
        
        # Get distance and duration
        summary = data['features'][0]['properties']['summary']
        distance = summary['distance'] / 1000  # Convert to km
        duration = summary['duration'] / 60    # Convert to minutes
        
        print(f"Route found: {distance:.1f}km, {duration:.0f}min")
        
        return jsonify({
            "coordinates": route_coords,
            "distance": round(distance, 1),
            "duration": round(duration, 0)
        })
        
    except requests.exceptions.Timeout:
        print("Request timed out")
        return jsonify({"error": "Request timeout"}), 504
    except Exception as e:
        print("Error:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/cleanup", methods=["POST"])
def cleanup_old():
    """Remove expired advisories (can be called manually)"""
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("DELETE FROM advisories WHERE expires_at <= datetime('now')")
    deleted = cur.rowcount
    conn.commit()
    conn.close()
    
    return jsonify({"message": f"Removed {deleted} expired reports"})

# ==================== START SERVER ====================

if __name__ == "__main__":
    init_db()
    print("-" * 50)
    print("Driver Advisory System Starting...")
    print("Access at: http://localhost:5000")
    print("For phone access, use your IP address")
    print("-" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)