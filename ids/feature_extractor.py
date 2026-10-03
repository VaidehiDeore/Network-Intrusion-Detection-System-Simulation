import ipaddress
VALID={"TCP","UDP","ICMP"}
def validate_flow(f):
    e=[]
    for k in ("source_ip","destination_ip"):
        try: ipaddress.ip_address(f[k])
        except: e.append(f"invalid {k}")
    for k in ("source_port","destination_port"):
        if k in f and not 0<=int(f[k])<=65535: e.append(f"invalid {k}")
    if str(f.get("protocol","")).upper() not in VALID: e.append("unsupported protocol")
    if "packet_count" not in f: e.append("missing packet_count")
    if float(f.get("duration_seconds",0))<0: e.append("duration must be non-negative")
    return e
def extract_network_features(f):
    p=max(float(f.get("packet_count",0)),0); b=max(float(f.get("byte_count",0)),0); d=max(float(f.get("duration_seconds",0)),.001)
    c=max(float(f.get("connection_count",0)),0); fail=max(float(f.get("failed_connection_count",0)),0); syn=max(float(f.get("syn_count",0)),0)
    return {**f,"bytes_per_second":b/d,"packets_per_second":p/d,"average_packet_size":b/max(p,1),
      "failure_ratio":min(fail/max(c,1),1),"syn_ratio":min(syn/max(p,1),1),"connection_rate":c/d,
      "unique_destination_ports":int(f.get("unique_destination_ports",1)),"unique_destination_ips":int(f.get("unique_destination_ips",1))}
