from collections import defaultdict
from datetime import datetime,timedelta
def correlate_alerts(alerts,window_seconds=60):
    g=defaultdict(list)
    for a in alerts:g[(a["source_ip"],a["alert_type"])].append(a)
    out=[]
    for (src,t),items in g.items():
        times=[datetime.fromisoformat(x["timestamp"].replace("Z","+00:00")) for x in items]
        if len(items)>1 and max(times)-min(times)<=timedelta(seconds=window_seconds):
            out.append({"source_ip":src,"alert_type":t,"count":len(items),"alert_ids":[x.get("alert_id") for x in items]})
    return out
