from datetime import datetime,timezone
def generate_alert(flow,hits,anomaly,risk,classification,ml=None):
    if not hits and risk<=20:return None
    top=hits[0] if hits else None
    return {"timestamp":datetime.now(timezone.utc).isoformat(),"source_ip":flow["source_ip"],"destination_ip":flow["destination_ip"],
      "protocol":flow["protocol"],"source_port":flow["source_port"],"destination_port":flow["destination_port"],
      "rule_id":top["rule_id"] if top else "ANOMALY-001","alert_type":top["name"] if top else "Statistical Anomaly",
      "severity":"CRITICAL" if risk>80 else "HIGH" if risk>60 else "MEDIUM","risk_score":risk,"anomaly_score":anomaly,
      "ml_score":ml,"classification":classification,"description":"; ".join(x["description"] for x in hits) or "Behavior deviated from baseline.","status":"NEW"}
