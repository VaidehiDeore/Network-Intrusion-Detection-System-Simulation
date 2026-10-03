import os,sqlite3
from pathlib import Path
from contextlib import contextmanager
DB_PATH=os.getenv("DATABASE_PATH","data/ids.db")
def init_db():
    Path(DB_PATH).parent.mkdir(parents=True,exist_ok=True)
    with sqlite3.connect(DB_PATH) as d:
        d.executescript("""
        CREATE TABLE IF NOT EXISTS network_flows(flow_id TEXT PRIMARY KEY,timestamp TEXT,source_ip TEXT,destination_ip TEXT,source_port INTEGER,destination_port INTEGER,protocol TEXT,packet_count REAL,byte_count REAL,duration_seconds REAL,connection_count REAL,failed_connection_count REAL,syn_count REAL,rst_count REAL,average_packet_size REAL,classification TEXT,risk_score REAL);
        CREATE TABLE IF NOT EXISTS alerts(alert_id TEXT PRIMARY KEY,flow_id TEXT,timestamp TEXT,source_ip TEXT,destination_ip TEXT,protocol TEXT,source_port INTEGER,destination_port INTEGER,rule_id TEXT,alert_type TEXT,severity TEXT,risk_score REAL,anomaly_score REAL,ml_score REAL,classification TEXT,description TEXT,status TEXT);
        CREATE TABLE IF NOT EXISTS incident_notes(note_id INTEGER PRIMARY KEY AUTOINCREMENT,alert_id TEXT,note TEXT,created_at TEXT);
        CREATE TABLE IF NOT EXISTS audit_logs(audit_id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT,target_id TEXT,created_at TEXT);
        """)
@contextmanager
def connect():
    init_db(); d=sqlite3.connect(DB_PATH); d.row_factory=sqlite3.Row
    try: yield d; d.commit()
    finally:d.close()
