import argparse, ipaddress
from datetime import datetime, timedelta, timezone
from pathlib import Path
import numpy as np, pandas as pd

RANGES=[ipaddress.ip_network(x) for x in ("192.0.2.0/24","198.51.100.0/24","203.0.113.0/24")]
NORMAL=["NORMAL_WEB","NORMAL_DNS","NORMAL_SSH","NORMAL_EMAIL","NORMAL_DATABASE"]
SUSP=["HIGH_CONNECTION_RATE","REPEATED_FAILED_CONNECTIONS","MULTI_PORT_PROBING_PATTERN","SYN_HEAVY_PATTERN","UNUSUAL_PORT_ACTIVITY","HIGH_TRAFFIC_VOLUME"]

def ip(rng): return str(rng.choice(list(rng.choice(RANGES).hosts())))
def make(rng, scenario):
    suspicious=scenario in SUSP
    protocol="UDP" if scenario=="NORMAL_DNS" else "TCP"
    dport={"NORMAL_WEB":443,"NORMAL_DNS":53,"NORMAL_SSH":22,"NORMAL_EMAIL":587,"NORMAL_DATABASE":5432}.get(scenario,443)
    duration=float(rng.uniform(.5,10))
    packets=int(rng.integers(5,80)); bytes_=int(rng.integers(1500,50000))
    conn=int(rng.integers(1,6)); fails=int(rng.integers(0,2)); syn=int(rng.integers(0,5)); rst=int(rng.integers(0,2))
    ports=1
    if scenario=="HIGH_CONNECTION_RATE": conn=int(rng.integers(80,240)); fails=int(rng.integers(0,15))
    if scenario=="REPEATED_FAILED_CONNECTIONS": conn=int(rng.integers(30,100)); fails=int(rng.integers(20,90))
    if scenario=="MULTI_PORT_PROBING_PATTERN": conn=int(rng.integers(30,120)); fails=int(rng.integers(10,70)); ports=int(rng.integers(25,80))
    if scenario=="SYN_HEAVY_PATTERN": packets=int(rng.integers(200,700)); conn=int(rng.integers(80,260)); syn=int(rng.integers(180,650)); rst=int(rng.integers(30,200))
    if scenario=="UNUSUAL_PORT_ACTIVITY": dport=int(rng.choice([23,2323,31337,4444,8081])); conn=int(rng.integers(15,80)); fails=int(rng.integers(2,50))
    if scenario=="HIGH_TRAFFIC_VOLUME": packets=int(rng.integers(500,2500)); bytes_=int(rng.integers(500000,8000000)); duration=float(rng.uniform(.5,5))
    return dict(source_ip=ip(rng),destination_ip=ip(rng),source_port=int(rng.integers(1024,65536)),
      destination_port=dport,protocol=protocol,packet_count=packets,byte_count=bytes_,duration_seconds=duration,
      connection_count=conn,failed_connection_count=fails,syn_count=syn,rst_count=rst,
      average_packet_size=bytes_/max(packets,1),unique_destination_ports=ports,unique_destination_ips=1,
      label="SUSPICIOUS" if suspicious else "NORMAL",scenario_type=scenario)

def generate(n=5000,seed=42):
    rng=np.random.default_rng(seed); start=datetime.now(timezone.utc)-timedelta(hours=24); rows=[]
    for i in range(n):
        sc=rng.choice(SUSP if rng.random()<.28 else NORMAL); x=make(rng,sc)
        x.update(flow_id=f"FLOW-{i+1:06d}",timestamp=(start+timedelta(seconds=int(rng.integers(86400)))).isoformat())
        rows.append(x)
    return pd.DataFrame(rows).sort_values("timestamp").reset_index(drop=True)

if __name__=="__main__":
    p=argparse.ArgumentParser(); p.add_argument("--records",type=int,default=5000); p.add_argument("--output",default="data/network_traffic.csv"); a=p.parse_args()
    Path(a.output).parent.mkdir(parents=True,exist_ok=True); df=generate(a.records); df.to_csv(a.output,index=False); print(f"Generated {len(df)} records -> {a.output}")
