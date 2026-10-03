from pathlib import Path

import joblib
import numpy as np
import pandas as pd


MODEL_PATH = Path("models/ids_rf.joblib")


class MLDetector:
    """
    Loads the trained Random Forest IDS model and predicts
    whether a network flow is NORMAL or SUSPICIOUS.
    """

    def __init__(self, model_path=MODEL_PATH):
        self.model_path = Path(model_path)
        self.model = None
        self.encoder = None
        self.scaler = None
        self.num_cols = None
        self.cat_cols = None
        self.load()

    def load(self):
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"ML model not found: {self.model_path}"
            )

        package = joblib.load(self.model_path)

        self.model = package["model"]

        # New training pipeline uses "encoder".
        # "enc" is supported for compatibility with older model files.
        self.encoder = package.get(
            "encoder",
            package.get("enc")
        )

        self.scaler = package["scaler"]
        self.num_cols = package["num_cols"]
        self.cat_cols = package["cat_cols"]

        if self.encoder is None:
            raise KeyError("Model package does not contain an encoder.")

    def _prepare(self, flow):
        row = dict(flow)

        duration = max(
            float(row.get("duration_seconds", 0)),
            0.001
        )

        packet_count = max(
            float(row.get("packet_count", 0)),
            0
        )

        byte_count = max(
            float(row.get("byte_count", 0)),
            0
        )

        row["bytes_per_second"] = byte_count / duration
        row["packets_per_second"] = packet_count / duration
        row["average_packet_size"] = byte_count / max(
            packet_count,
            1
        )

        row["connection_count"] = max(
            float(row.get("connection_count", 0)),
            0
        )

        row["failed_connection_count"] = max(
            float(row.get("failed_connection_count", 0)),
            0
        )

        row["syn_count"] = max(
            float(row.get("syn_count", 0)),
            0
        )

        row["rst_count"] = max(
            float(row.get("rst_count", 0)),
            0
        )

        row["protocol"] = str(
            row.get("protocol", "UNK")
        ).upper()

        return row

    def _build_features(self, flow):
        row = self._prepare(flow)

        df = pd.DataFrame([row])

        numeric = (
            df[self.num_cols]
            .replace([np.inf, -np.inf], np.nan)
            .fillna(0)
        )

        categorical = df[self.cat_cols].fillna("UNK")

        x_numeric = self.scaler.transform(numeric)
        x_categorical = self.encoder.transform(categorical)

        return np.hstack([
            x_numeric,
            x_categorical
        ])

    def predict(self, flow):
        x = self._build_features(flow)

        prediction = int(
            self.model.predict(x)[0]
        )

        probabilities = self.model.predict_proba(x)[0]

        suspicious_probability = float(
            probabilities[1]
        )

        classification = (
            "SUSPICIOUS"
            if prediction == 1
            else "NORMAL"
        )

        return {
            "classification": classification,
            "prediction": prediction,
            "ml_score": round(
                suspicious_probability * 100,
                2
            )
        }


_detector = None


def initialize_detector():
    global _detector

    try:
        _detector = MLDetector()
    except FileNotFoundError:
        _detector = None

    return _detector


def predict_flow(flow):
    global _detector

    if _detector is None:
        initialize_detector()

    if _detector is None:
        return {
            "classification": "UNAVAILABLE",
            "prediction": None,
            "ml_score": 0.0
        }

    return _detector.predict(flow)