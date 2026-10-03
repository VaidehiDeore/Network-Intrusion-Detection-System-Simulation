W={"INFO":5,"LOW":20,"MEDIUM":40,"HIGH":70,"CRITICAL":95}
def calculate_risk_score(hits,anomaly,ml=None):
    rule=max([W.get(x["severity"],0) for x in hits],default=0)
    s=.6*rule+.4*anomaly if ml is None else .4*rule+.3*anomaly+.3*ml*100
    return round(max(0,min(100,s)),2)
def classify_risk(s):
    return "NORMAL" if s<=20 else "LOW RISK" if s<=40 else "SUSPICIOUS" if s<=60 else "HIGH" if s<=80 else "CRITICAL"
