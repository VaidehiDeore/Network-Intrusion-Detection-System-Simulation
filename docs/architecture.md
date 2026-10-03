# IDS Architecture
Synthetic flow → validation → feature extraction → signature rules + anomaly detector + optional ML → risk engine → alert generation → correlation → SQLite → FastAPI → React SOC dashboard.

The analyst remains in the loop. A detection is evidence requiring investigation, not proof of malicious activity.
