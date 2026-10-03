from pathlib import Path

import pandas as pd

from ids.feature_extractor import (
    extract_network_features,
    validate_flow,
)
from ids.rule_engine import analyze_flow
from ids.anomaly_detector import Baseline
from ids.risk_engine import (
    calculate_risk_score,
    classify_risk,
)
from ids.alert_engine import generate_alert
from ml.predict import predict_flow


baseline = None


def initialize():
    global baseline

    p = Path("data/network_traffic.csv")

    if p.exists():
        df = pd.read_csv(p)

        normal = df[
            df["label"].astype(str).str.upper() == "NORMAL"
        ].to_dict("records")

        baseline = Baseline.from_records(
            [
                extract_network_features(x)
                for x in normal
            ]
        )
    else:
        baseline = Baseline.from_records([])


def process(f):
    # Validate incoming network flow.
    errors = validate_flow(f)

    if errors:
        raise ValueError("; ".join(errors))

    # ---------------------------------------------------------
    # 1. Feature extraction
    # ---------------------------------------------------------
    feat = extract_network_features(f)

    # ---------------------------------------------------------
    # 2. Signature/rule detection
    # ---------------------------------------------------------
    hits = analyze_flow(feat)

    # ---------------------------------------------------------
    # 3. Statistical anomaly detection
    # ---------------------------------------------------------
    anomaly = (
        baseline.score(feat)
        if baseline
        else 0
    )

    # ---------------------------------------------------------
    # 4. Machine-learning detection
    # ---------------------------------------------------------
    ml_result = predict_flow(feat)

    ml_score = float(
        ml_result.get("ml_score", 0)
    ) / 100.0

    ml_classification = ml_result.get(
        "classification",
        "UNAVAILABLE"
    )

    # ---------------------------------------------------------
    # 5. Hybrid risk scoring
    # ---------------------------------------------------------
    risk = calculate_risk_score(
        hits,
        anomaly,
        ml_score
    )

    # ---------------------------------------------------------
    # 6. Final IDS classification
    # ---------------------------------------------------------
    cls = classify_risk(risk)

    # ---------------------------------------------------------
    # 7. Alert generation
    # ---------------------------------------------------------
    alert = generate_alert(
        f,
        hits,
        anomaly,
        risk,
        cls,
        ml_score
    )

    # ---------------------------------------------------------
    # Return complete detection result
    # ---------------------------------------------------------
    return (
        feat,
        hits,
        anomaly,
        risk,
        cls,
        alert,
    )