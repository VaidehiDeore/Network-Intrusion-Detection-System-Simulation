from ids.feature_extractor import validate_flow,extract_network_features
from ids.rule_engine import analyze_flow
from ids.anomaly_detector import Baseline
from ids.risk_engine import calculate_risk_score,classify_risk
from ids.alert_engine import generate_alert
from ids.correlation import correlate_alerts
def f(**k):
 d=dict(source_ip="192.0.2.10",destination_ip="198.51.100.20",source_port=50000,destination_port=443,protocol="TCP",packet_count=20,byte_count=10000,duration_seconds=2,connection_count=2,failed_connection_count=0,syn_count=1,rst_count=0,unique_destination_ports=1,unique_destination_ips=1);d.update(k);return d
def test_01():assert validate_flow(f())==[]
def test_02():assert validate_flow(f(protocol="UDP"))==[]
def test_03():assert validate_flow(f(protocol="UDP",destination_port=53))==[]
def test_04():assert validate_flow(f(destination_port=443))==[]
def test_05():assert any(x["rule_id"]=="IDS-001" for x in analyze_flow(extract_network_features(f(connection_count=100))))
def test_06():assert any(x["rule_id"]=="IDS-002" for x in analyze_flow(extract_network_features(f(connection_count=50,failed_connection_count=40))))
def test_07():assert any(x["rule_id"]=="IDS-003" for x in analyze_flow(extract_network_features(f(unique_destination_ports=30))))
def test_08():assert any(x["rule_id"]=="IDS-004" for x in analyze_flow(extract_network_features(f(packet_count=100,syn_count=90,duration_seconds=1))))
def test_09():assert any(x["rule_id"]=="IDS-006" for x in analyze_flow(extract_network_features(f(byte_count=1000000,duration_seconds=1))))
def test_10():assert "invalid source_ip" in validate_flow(f(source_ip="bad"))
def test_11():assert "invalid destination_ip" in validate_flow(f(destination_ip="bad"))
def test_12():assert "invalid source_port" in validate_flow(f(source_port=70000))
def test_13():assert "invalid destination_port" in validate_flow(f(destination_port=-1))
def test_14():assert "unsupported protocol" in validate_flow(f(protocol="FTP"))
def test_15():x=f();del x["packet_count"];assert "missing packet_count" in validate_flow(x)
def test_16():assert extract_network_features(f(duration_seconds=0))["bytes_per_second"]>0
def test_17():assert "failure_ratio" in extract_network_features(f())
def test_18():assert analyze_flow(extract_network_features(f(connection_count=100)))
def test_19():b=Baseline.from_records([extract_network_features(f()) for _ in range(5)]);assert 0<=b.score(extract_network_features(f()))<=100
def test_20():assert 0<=calculate_risk_score([],50)<=100
def test_21():x=f(connection_count=100);z=extract_network_features(x);a=generate_alert(x,analyze_flow(z),50,70,"HIGH");assert a["status"]=="NEW"
def test_22():a={"alert_id":"A","source_ip":"192.0.2.1","alert_type":"X","timestamp":"2026-01-01T00:00:00+00:00"};b={**a,"alert_id":"B","timestamp":"2026-01-01T00:00:30+00:00"};assert correlate_alerts([a,b])[0]["count"]==2
def test_23():assert classify_risk(78)=="HIGH"
def test_24():from backend.schemas import NoteIn;assert NoteIn(note="review").note=="review"
def test_25():from backend.database import init_db;assert callable(init_db)
def test_26():from backend.schemas import FlowIn;assert FlowIn(**f()).protocol=="TCP"
def test_27():assert len(["accuracy","precision","recall","f1"])==4
def test_28():assert Baseline.from_records([]).score(extract_network_features(f()))<=100
def test_29():assert f()["source_ip"]=="192.0.2.10"
def test_30():assert analyze_flow(extract_network_features(f(destination_port=4444)))
def test_31():assert extract_network_features(f(connection_count=1,failed_connection_count=100))["failure_ratio"]==1
def test_32():assert classify_risk(10)=="NORMAL"
