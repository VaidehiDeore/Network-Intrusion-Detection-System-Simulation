import asyncio
import json
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.database import init_db, connect
from backend.schemas import FlowIn, StatusUpdate, NoteIn
from backend.services import initialize, process
from ids.rule_engine import RULES
from ids.correlation import correlate_alerts


app = FastAPI(
    title="Network IDS Simulation API",
    version="1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    initialize()


def d(r):
    return dict(r) if r else None


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/flows")
def ingest(f: FlowIn):
    x = f.model_dump()

    if x["protocol"].upper() not in {"TCP", "UDP", "ICMP"}:
        raise HTTPException(
            422,
            "Unsupported protocol",
        )

    try:
        feat, hits, anomaly, risk, classification, alert = process(x)
    except ValueError as e:
        raise HTTPException(422, str(e))

    flow_id = (
        x.get("flow_id")
        or f"LIVE-{int(datetime.now().timestamp() * 1000)}"
    )

    timestamp = (
        x.get("timestamp")
        or datetime.now(timezone.utc).isoformat()
    )

    with connect() as db:

        # Prevent duplicate flow IDs.
        if db.execute(
            "SELECT flow_id FROM network_flows WHERE flow_id=?",
            (flow_id,),
        ).fetchone():
            return {
                "duplicate": True,
                "flow_id": flow_id,
            }

        # ---------------------------------------------------------
        # Store network flow
        # ---------------------------------------------------------
        db.execute(
            "INSERT INTO network_flows VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                flow_id,
                timestamp,
                x["source_ip"],
                x["destination_ip"],
                x["source_port"],
                x["destination_port"],
                x["protocol"].upper(),
                x["packet_count"],
                x["byte_count"],
                x["duration_seconds"],
                x["connection_count"],
                x["failed_connection_count"],
                x["syn_count"],
                x["rst_count"],
                feat["average_packet_size"],
                classification,
                risk,
            ),
        )

        alert_id = None
        ml_score = None

        # ---------------------------------------------------------
        # Store alert
        # ---------------------------------------------------------
        if alert:

            alert_id = (
                f"ALT-{int(datetime.now().timestamp() * 1000)}"
            )

            # alert["ml_score"] is stored as a 0–1 probability
            # by the hybrid detection pipeline.
            ml_score = alert.get("ml_score")

            db.execute(
                "INSERT INTO alerts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    alert_id,
                    flow_id,
                    alert["timestamp"],
                    alert["source_ip"],
                    alert["destination_ip"],
                    alert["protocol"],
                    alert["source_port"],
                    alert["destination_port"],
                    alert["rule_id"],
                    alert["alert_type"],
                    alert["severity"],
                    risk,
                    anomaly,
                    ml_score,
                    classification,
                    alert["description"],
                    "NEW",
                ),
            )

        # ---------------------------------------------------------
        # Audit log
        # ---------------------------------------------------------
        db.execute(
            """
            INSERT INTO audit_logs(action,target_id,created_at)
            VALUES(?,?,?)
            """,
            (
                "FLOW_INGESTED",
                flow_id,
                timestamp,
            ),
        )

    # -------------------------------------------------------------
    # API response
    # -------------------------------------------------------------
    return {
        "flow_id": flow_id,
        "classification": classification,
        "risk_score": risk,
        "anomaly_score": anomaly,
        "ml_score": ml_score,
        "rule_hits": hits,
        "alert_id": alert_id,
    }


@app.get("/api/flows")
def flows(
    limit: int = Query(
        100,
        ge=1,
        le=500,
    )
):
    with connect() as db:
        return [
            d(x)
            for x in db.execute(
                """
                SELECT *
                FROM network_flows
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        ]


@app.get("/api/alerts")
def alerts(
    status: str | None = None,
    severity: str | None = None,
    limit: int = Query(
        100,
        ge=1,
        le=500,
    ),
):
    with connect() as db:

        query = "SELECT * FROM alerts"
        where = []
        params = []

        if status:
            where.append("status=?")
            params.append(status)

        if severity:
            where.append("severity=?")
            params.append(severity)

        if where:
            query += " WHERE " + " AND ".join(where)

        query += """
            ORDER BY timestamp DESC
            LIMIT ?
        """

        params.append(limit)

        return [
            d(x)
            for x in db.execute(
                query,
                params,
            ).fetchall()
        ]


@app.get("/api/alerts/{alert_id}")
def alert(alert_id: str):

    with connect() as db:

        row = db.execute(
            "SELECT * FROM alerts WHERE alert_id=?",
            (alert_id,),
        ).fetchone()

        notes = db.execute(
            """
            SELECT *
            FROM incident_notes
            WHERE alert_id=?
            ORDER BY created_at DESC
            """,
            (alert_id,),
        ).fetchall()

    if not row:
        raise HTTPException(
            404,
            "Alert not found",
        )

    result = d(row)
    result["notes"] = [
        d(note)
        for note in notes
    ]

    return result


@app.put("/api/alerts/{alert_id}/status")
def status(
    alert_id: str,
    body: StatusUpdate,
):

    if body.status not in {
        "NEW",
        "INVESTIGATING",
        "RESOLVED",
        "FALSE_POSITIVE",
    }:
        raise HTTPException(
            422,
            "Invalid status",
        )

    with connect() as db:

        if not db.execute(
            "SELECT alert_id FROM alerts WHERE alert_id=?",
            (alert_id,),
        ).fetchone():
            raise HTTPException(
                404,
                "Alert not found",
            )

        db.execute(
            """
            UPDATE alerts
            SET status=?
            WHERE alert_id=?
            """,
            (
                body.status,
                alert_id,
            ),
        )

        db.execute(
            """
            INSERT INTO audit_logs(action,target_id,created_at)
            VALUES(?,?,?)
            """,
            (
                "STATUS_" + body.status,
                alert_id,
                datetime.now(timezone.utc).isoformat(),
            ),
        )

    return {
        "alert_id": alert_id,
        "status": body.status,
    }


@app.post("/api/alerts/{alert_id}/notes")
def note(
    alert_id: str,
    body: NoteIn,
):

    now = datetime.now(timezone.utc).isoformat()

    with connect() as db:

        if not db.execute(
            "SELECT alert_id FROM alerts WHERE alert_id=?",
            (alert_id,),
        ).fetchone():
            raise HTTPException(
                404,
                "Alert not found",
            )

        cursor = db.execute(
            """
            INSERT INTO incident_notes(
                alert_id,
                note,
                created_at
            )
            VALUES(?,?,?)
            """,
            (
                alert_id,
                body.note.strip(),
                now,
            ),
        )

    return {
        "note_id": cursor.lastrowid,
        "created_at": now,
    }


@app.get("/api/dashboard/stats")
def stats():

    with connect() as db:

        total = db.execute(
            "SELECT COUNT(*) FROM network_flows"
        ).fetchone()[0]

        normal = db.execute(
            """
            SELECT COUNT(*)
            FROM network_flows
            WHERE classification='NORMAL'
            """
        ).fetchone()[0]

        suspicious = total - normal

        open_alerts = db.execute(
            """
            SELECT COUNT(*)
            FROM alerts
            WHERE status IN('NEW','INVESTIGATING')
            """
        ).fetchone()[0]

        critical = db.execute(
            """
            SELECT COUNT(*)
            FROM alerts
            WHERE severity='CRITICAL'
            """
        ).fetchone()[0]

        average_risk = db.execute(
            """
            SELECT COALESCE(AVG(risk_score),0)
            FROM network_flows
            """
        ).fetchone()[0]

        severity = db.execute(
            """
            SELECT severity, COUNT(*) c
            FROM alerts
            GROUP BY severity
            """
        ).fetchall()

        alert_types = db.execute(
            """
            SELECT alert_type, COUNT(*) c
            FROM alerts
            GROUP BY alert_type
            ORDER BY c DESC
            LIMIT 8
            """
        ).fetchall()

        protocols = db.execute(
            """
            SELECT protocol, COUNT(*) c
            FROM network_flows
            GROUP BY protocol
            """
        ).fetchall()

    return {
        "total_flows": total,
        "normal_traffic": normal,
        "suspicious_traffic": suspicious,
        "open_alerts": open_alerts,
        "critical_alerts": critical,
        "average_risk": round(
            average_risk,
            2,
        ),
        "severity_distribution": [
            {
                "name": x[0],
                "value": x[1],
            }
            for x in severity
        ],
        "alert_types": [
            {
                "name": x[0],
                "value": x[1],
            }
            for x in alert_types
        ],
        "protocol_distribution": [
            {
                "name": x[0],
                "value": x[1],
            }
            for x in protocols
        ],
    }


@app.get("/api/dashboard/traffic")
def traffic():

    with connect() as db:
        rows = db.execute(
            """
            SELECT
                substr(timestamp,12,5),
                SUM(packet_count) /
                    MAX(1,SUM(duration_seconds)),
                SUM(byte_count) /
                    MAX(1,SUM(duration_seconds)),
                SUM(connection_count),
                SUM(failed_connection_count)
            FROM network_flows
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 24
            """
        ).fetchall()

    return [
        {
            "time": row[0],
            "pps": round(row[1], 2),
            "bps": round(row[2], 2),
            "connections": row[3],
            "failures": row[4],
        }
        for row in reversed(rows)
    ]


@app.get("/api/dashboard/alerts")
def dashboard_alerts(
    limit: int = 20,
):
    with connect() as db:
        return [
            d(x)
            for x in db.execute(
                """
                SELECT *
                FROM alerts
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        ]


@app.get("/api/rules")
def rules():

    return [
        {
            "rule_id": key,
            "name": value[0],
            "severity": value[1],
            "threshold": value[2],
            "enabled": True,
        }
        for key, value in RULES.items()
    ]


@app.get("/api/correlations")
def correlations():

    with connect() as db:
        rows = [
            d(x)
            for x in db.execute(
                """
                SELECT *
                FROM alerts
                ORDER BY timestamp DESC
                LIMIT 500
                """
            ).fetchall()
        ]

    return correlate_alerts(rows)


@app.get("/api/stream")
async def stream():

    async def generate():
        last = -1

        while True:

            with connect() as db:
                count = db.execute(
                    "SELECT COUNT(*) FROM alerts"
                ).fetchone()[0]

            if count != last:
                last = count

                yield (
                    "data: "
                    + json.dumps(
                        {"alerts": count}
                    )
                    + "\n\n"
                )
            else:
                yield ": heartbeat\n\n"

            await asyncio.sleep(2)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
    )