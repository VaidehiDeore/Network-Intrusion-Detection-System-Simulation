import argparse, random, time, requests
IPS=["192.0.2.15","192.0.2.44","198.51.100.20","198.51.100.50","203.0.113.10"]
def normal():
    p=random.choice([443,80,53,587,5432]); proto="UDP" if p==53 else "TCP"; packets=random.randint(8,70); b=random.randint(1000,50000)
    return dict(source_ip=random.choice(IPS),destination_ip=random.choice(IPS),source_port=random.randint(49152,65535),
      destination_port=p,protocol=proto,packet_count=packets,byte_count=b,duration_seconds=round(random.uniform(.5,12),2),
      connection_count=random.randint(1,5),failed_connection_count=random.randint(0,1),syn_count=random.randint(0,4),rst_count=random.randint(0,1),
      unique_destination_ports=1,unique_destination_ips=1)
def suspicious():
    f=normal(); k=random.choice(["failed","rate","ports","syn","volume"]); f["protocol"]="TCP"
    if k=="failed": f.update(connection_count=random.randint(30,100),failed_connection_count=random.randint(20,90))
    elif k=="rate": f.update(connection_count=random.randint(100,240))
    elif k=="ports": f.update(connection_count=random.randint(30,120),failed_connection_count=random.randint(10,70),unique_destination_ports=random.randint(25,80))
    elif k=="syn": f.update(packet_count=random.randint(200,700),connection_count=random.randint(80,260),syn_count=random.randint(180,650),rst_count=random.randint(30,200))
    else: f.update(packet_count=random.randint(500,2500),byte_count=random.randint(500000,8000000),duration_seconds=random.uniform(.5,5))
    return f
if __name__=="__main__":
    p=argparse.ArgumentParser(); p.add_argument("--mode",choices=["normal","mixed","suspicious"],default="mixed"); p.add_argument("--speed",choices=["slow","fast"],default="slow"); p.add_argument("--url",default="http://127.0.0.1:8000/api/flows"); p.add_argument("--count",type=int,default=0); a=p.parse_args()
    delay=2 if a.speed=="slow" else .35; i=0
    while a.count==0 or i<a.count:
        f=normal() if a.mode=="normal" else suspicious() if a.mode=="suspicious" else (suspicious() if random.random()<.35 else normal())
        r=requests.post(a.url,json=f,timeout=5); print(r.json()); r.raise_for_status(); i+=1; time.sleep(delay)
