# 🚗 Glance-Free Driver Advisory System

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-green.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/flask-2.3.0-red.svg)](https://flask.palletsprojects.com/)
[![JavaScript](https://img.shields.io/badge/javascript-ES6-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

A **voice-controlled navigation system** designed to reduce screen time while driving. Unlike Google Maps or Waze, this app lets drivers keep their eyes on the road using voice commands and audio alerts.

## 📌 Features

| Feature | Description |
|---------|-------------|
| 🎤 **Wake Word Detection** | Say "Hey Report" to activate - completely hands-free |
| 🗣️ **Voice Reporting** | Speak "accident", "police", "block", or "road work" |
| 🔊 **Audio Alerts** | "Accident 300 meters ahead on your right" |
| 👮 **Police Privacy** | Vague alerts: "Police checkpoint in this area" |
| 📦 **Offline Mode** | Works without internet - saves reports locally |
| 🗺️ **Route Planning** | Point-to-point navigation with distance & ETA |
| 🧭 **Rotating Arrow** | Like Google Maps - points where you're going |
| 📊 **Speed Indicator** | Color-coded (green=normal, orange=fast, red=speeding) |
| 🌙 **Dark Mode** | Auto-activates during driving for night safety |
| 📱 **Mobile Friendly** | Works on both laptop and phone browsers |

## 🎯 Why This App?

| Problem | Solution |
|---------|----------|
| Google Maps requires looking at screen | Voice-first interaction |
| Waze needs tapping to report hazards | Wake word detection |
| Poor internet in northern Pakistan | Full offline support |
| Police locations exposed on Waze | Vague alerts (within 300m) |
| No distance/direction in alerts | "300 meters ahead on your right" |

## 🛠️ Technology Stack
┌─────────────────────────────────────────────────────────────┐
│ CLIENT SIDE │
├─────────────────────────────────────────────────────────────┤
│ • Leaflet (Maps) • Web Speech API (Voice) │
│ • IndexedDB (Offline) • Geolocation API (GPS) │
│ • HTML/CSS/JavaScript │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND │
├─────────────────────────────────────────────────────────────┤
│ • Python Flask (Server) • SQLite (Database) │
│ • OpenRouteService API (Routing) │
└─────────────────────────────────────────────────────────────┘

text

## 📁 Project Structure
navigation-app/
│
├── app.py # Flask backend server
├── advisories.db # SQLite database (auto-created)
│
├── templates/
│ └── index.html # Main webpage
│
├── static/
│ ├── css/
│ │ └── style.css # Styles
│ └── js/
│ └── main.js # All JavaScript logic
│
└── README.md # This file

text

## 🚀 Installation & Setup

### Prerequisites

- Python 3.8 or higher
- Modern web browser (Chrome recommended)
- GPS-enabled device (for full functionality)

### Step 1: Clone or Download

```bash
# Clone the repository
git clone https://github.com/yourusername/navigation-app.git
cd navigation-app
Step 2: Install Dependencies
bash
# Install required Python packages
pip install flask
pip install requests
Step 3: Get OpenRouteService API Key (Free)
Go to OpenRouteService

Create a free account

Copy your API key from Dashboard

In app.py, replace:

python
API_KEY = "your-api-key-here"
Step 4: Run the Application
bash
python app.py
Step 5: Open in Browser
text
http://localhost:5000
Step 6: Access on Phone
Find your laptop's IP: ipconfig (Windows) or ifconfig (Mac/Linux)

On phone, open: http://YOUR-IP:5000

📱 How to Use
Plan a Route
Enter Start location (e.g., "Lahore" or "current")

Enter Destination (e.g., "Islamabad")

Click "Show Route"

Blue route appears on map

Click "Start Journey" to navigate

Report Hazards
Method 1: Voice (Recommended)

text
1. Say "Hey Report" (wake word)
2. System: "What do you want to report?"
3. Say: "accident" or "police" or "block" or "road work"
4. System: "Accident reported"
Method 2: Manual

text
1. Click the red ⚠️ button (bottom right)
2. Select hazard type
3. Click "Send Report"
Drive Mode
When you click "Start Driving":

Screen darkens (night mode)

Blue rotating arrow appears at your location

Speed shows on the arrow (color-coded)

Wake word activates ("Hey Report")

Audio alerts will warn you about nearby hazards

Audio Alerts Examples
Hazard	Alert
Accident	"Accident 300 meters ahead"
Traffic Block	"Traffic block 150 meters on your right"
Road Work	"Road work 500 meters on your left"
Police	"Police checkpoint in this area" (vague)
Offline Mode
Reports work without internet - saved locally

Auto-syncs when internet returns

Routes cached for 7 days

Stop Driving
Click the red 🛑 STOP button (top right)

Or click "Stop Driving" in control panel

🎤 Voice Commands Reference
Wake Word	"Hey Report" or "Report"
Report Accident	"accident", "crash", "collision"
Report Block	"block", "jam", "traffic"
Report Police	"police", "checkpoint", "cops"
Report Road Work	"construction", "work", "road work"
🗺️ Sample Route Tests
Start	Destination	Approx Distance
Lahore	Islamabad	375 km
Karachi	Hyderabad	160 km
Faisalabad	Multan	200 km
Peshawar	Mardan	55 km
current	[any place]	Uses GPS
🔧 Troubleshooting
Issue	Solution
Map not loading	Check internet connection
GPS not working	Allow location permission in browser
Voice not working	Allow microphone permission
"Hey Report" not detected	Click mic button first to allow permission
Route not showing	Check API key in app.py
Offline mode	Reports saved, sync when online
📊 System Requirements
Component	Minimum	Recommended
RAM	4 GB	8 GB
Browser	Chrome 90+	Chrome latest
Internet	For initial route	Broadband
GPS	Optional	Recommended
Storage	500 MB	1 GB
🧪 Testing
bash
# Run unit tests (if added)
python -m pytest tests/

# Manual testing checklist
- [ ] Map loads correctly
- [ ] GPS tracks location
- [ ] Route planning works
- [ ] Voice commands work
- [ ] Wake word works multiple times
- [ ] Offline mode saves reports
- [ ] Police alerts are vague
🤝 Contributing
Fork the repository

Create feature branch (git checkout -b feature/AmazingFeature)

Commit changes (git commit -m 'Add AmazingFeature')

Push to branch (git push origin feature/AmazingFeature)

Open Pull Request

📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

👩‍💻 Author
Hafsa Rehman (2023-ag-9950)

University: University of Agriculture, Faisalabad (UAF)

Semester: 6th

Department: Software Engineering

Course: Big data analysis

🙏 Acknowledgments
Leaflet - Interactive maps

OpenStreetMap - Free map tiles

OpenRouteService - Route calculation API

Web Speech API - Voice recognition

Flask - Web framework

📧 Contact
For questions or feedback:

Email: [rehmanhafsa707@gmail.com]

GitHub: [H-Rehman]

⭐ Show Your Support
If this project helped you, please give it a star ⭐ on GitHub!

Made with ❤️ for safer driving in Pakistan

Copyright (c) 2026 Hafsa Rehman

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
