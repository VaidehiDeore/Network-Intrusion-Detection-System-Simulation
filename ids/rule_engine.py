RULES={"IDS-001":("High Connection Rate","HIGH",20),"IDS-002":("Repeated Failed Connections","HIGH",.35),
"IDS-003":("Multi-Port Activity","HIGH",20),"IDS-004":("SYN-Heavy Pattern","HIGH",.65),
"IDS-005":("Unusual Service Port","MEDIUM",1),"IDS-006":("High Traffic Volume","HIGH",250000)}
def analyze_flow(f):
    h=[]
    if f["connection_rate"]>=20: h.append({"rule_id":"IDS-001","name":"High Connection Rate","severity":"HIGH","description":"Connection rate exceeded the configured baseline."})
    if f["failure_ratio"]>=.35 and f["failed_connection_count"]>=5: h.append({"rule_id":"IDS-002","name":"Repeated Failed Connections","severity":"HIGH","description":"Repeated failed connections exceeded the configured ratio."})
    if f["unique_destination_ports"]>=20: h.append({"rule_id":"IDS-003","name":"Multi-Port Activity","severity":"HIGH","description":"Destination-port diversity exceeded the configured threshold."})
    if f["syn_ratio"]>=.65 and f["packets_per_second"]>40: h.append({"rule_id":"IDS-004","name":"SYN-Heavy Pattern","severity":"HIGH","description":"SYN proportion and packet rate indicate unusual connection behavior."})
    if int(f.get("destination_port",0)) in {23,2323,31337,4444,8081}: h.append({"rule_id":"IDS-005","name":"Unusual Service Port","severity":"MEDIUM","description":"Traffic used a configured unusual service port."})
    if f["bytes_per_second"]>=250000: h.append({"rule_id":"IDS-006","name":"High Traffic Volume","severity":"HIGH","description":"Traffic volume exceeded the configured baseline."})
    return h
