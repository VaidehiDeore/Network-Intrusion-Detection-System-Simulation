# Network Intrusion Detection System (IDS) Simulation

A defensive NIDS simulation using synthetic network-flow data, signature rules, statistical anomaly detection, optional Random Forest ML, risk scoring, alert correlation, and a polished SOC dashboard.

## Architecture
Synthetic Traffic → Validation → Feature Extraction → Rules + Anomaly + Optional ML → Risk Engine → Alerts → Correlation → SQLite → FastAPI → React SOC Dashboard.

## Safety
The project generates data representing suspicious patterns. It does not send attack packets, scan public networks, exploit systems, flood systems, or store packet payloads.

## Technology Stack
Python, FastAPI, SQLite, Pandas, NumPy, scikit-learn, React, Vite, CSS/SVG, Pytest.

## Installation
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd frontend
npm install
cd ..
```

## Run
Terminal 1:
```powershell
python simulator/generate_dataset.py --records 5000
python -m uvicorn backend.app:app --reload --port 8000
```
Terminal 2:
```powershell
cd frontend
npm run dev
```
Terminal 3:
```powershell
python simulator/traffic_simulator.py --mode mixed --speed fast --count 30
```

Dashboard: `http://localhost:5173`  
API docs: `http://127.0.0.1:8000/docs`

## Optional ML
```powershell
python ml/train_model.py
```
Set `ML_ENABLED=true` in `.env`, then restart the backend.

## Testing
```powershell
pytest -q
```

## Detection Scenarios
NORMAL_WEB, NORMAL_DNS, NORMAL_SSH, NORMAL_EMAIL, NORMAL_DATABASE, HIGH_CONNECTION_RATE, REPEATED_FAILED_CONNECTIONS, MULTI_PORT_PROBING_PATTERN, SYN_HEAVY_PATTERN, UNUSUAL_PORT_ACTIVITY, HIGH_TRAFFIC_VOLUME.

## Risk Bands
0–20 NORMAL; 21–40 LOW RISK; 41–60 SUSPICIOUS; 61–80 HIGH; 81–100 CRITICAL. These are project-defined thresholds, not universal standards.

## API
POST `/api/flows`, GET `/api/flows`, GET `/api/alerts`, GET `/api/alerts/{id}`, PUT `/api/alerts/{id}/status`, POST `/api/alerts/{id}/notes`, GET `/api/dashboard/stats`, GET `/api/dashboard/traffic`, GET `/api/dashboard/alerts`, GET `/api/rules`, GET `/api/stream`.

## Security
Use synthetic data, avoid payload storage, validate input, protect secrets, sanitize output, and add authentication/authorization, TLS, rate limiting, audit logging, and least privilege before production deployment.

## Future Improvements
Authorized PCAP ingestion, Zeek/Suricata, SIEM integration, threat-intelligence enrichment, behavioral baselines, UEBA, cloud IDS, centralized logging, model-drift monitoring.

## Ethical Disclaimer
**This project is designed exclusively for defensive cybersecurity education. All suspicious network behavior is represented using synthetic data or authorized isolated lab environments.**

## Author
**Vaidehi Deore**
