from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)


NUM = [
    "duration_seconds",
    "byte_count",
    "packet_count",
    "bytes_per_second",
    "packets_per_second",
    "average_packet_size",
    "connection_count",
    "failed_connection_count",
    "syn_count",
    "rst_count",
]


CAT = ["protocol"]


def prepare_dataframe(df):
    """
    Prepare raw network-flow data for ML.

    Feature calculations are performed without fitting any
    preprocessing objects. This allows the train/test split
    to happen before fitting the encoder and scaler.
    """

    df = df.copy()

    # Prevent division by zero.
    safe_duration = df["duration_seconds"].clip(lower=0.001)

    df["bytes_per_second"] = (
        df["byte_count"] / safe_duration
    )

    df["packets_per_second"] = (
        df["packet_count"] / safe_duration
    )

    # Replace invalid numeric values.
    df[NUM] = (
        df[NUM]
        .replace([np.inf, -np.inf], np.nan)
        .fillna(0)
    )

    # Handle missing protocol values.
    df["protocol"] = (
        df["protocol"]
        .fillna("UNK")
        .astype(str)
    )

    return df


def build_features(df, encoder, scaler):
    """
    Transform data using preprocessing objects that have
    already been fitted on the training dataset.
    """

    x_numeric = scaler.transform(df[NUM])

    x_categorical = encoder.transform(
        df[CAT]
    )

    return np.hstack(
        [x_numeric, x_categorical]
    )


if __name__ == "__main__":

    # ---------------------------------------------------------
    # Load dataset
    # ---------------------------------------------------------

    data_path = Path(
        "data/network_traffic.csv"
    )

    if not data_path.exists():
        raise FileNotFoundError(
            f"Dataset not found: {data_path}"
        )

    df = pd.read_csv(data_path)

    if df.empty:
        raise ValueError(
            "The network traffic dataset is empty."
        )

    # ---------------------------------------------------------
    # Prepare raw features
    # ---------------------------------------------------------

    df = prepare_dataframe(df)

    # Normal = 0
    # Suspicious = 1
    y = (
        df["label"]
        .astype(str)
        .str.upper()
        .eq("SUSPICIOUS")
        .astype(int)
    )

    x_raw = df[NUM + CAT].copy()

    # ---------------------------------------------------------
    # Train/test split FIRST
    # ---------------------------------------------------------

    (
        x_train,
        x_test,
        y_train,
        y_test
    ) = train_test_split(
        x_raw,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    # ---------------------------------------------------------
    # Fit preprocessing ONLY on training data
    # ---------------------------------------------------------

    encoder = OneHotEncoder(
        handle_unknown="ignore",
        sparse_output=False,
    )

    scaler = StandardScaler()

    x_train_cat = encoder.fit_transform(
        x_train[CAT]
    )

    x_test_cat = encoder.transform(
        x_test[CAT]
    )

    x_train_num = scaler.fit_transform(
        x_train[NUM]
    )

    x_test_num = scaler.transform(
        x_test[NUM]
    )

    # ---------------------------------------------------------
    # Combine numeric + categorical features
    # ---------------------------------------------------------

    x_train_final = np.hstack(
        [x_train_num, x_train_cat]
    )

    x_test_final = np.hstack(
        [x_test_num, x_test_cat]
    )

    # ---------------------------------------------------------
    # Train Random Forest
    # ---------------------------------------------------------

    model = RandomForestClassifier(
        n_estimators=250,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        x_train_final,
        y_train,
    )

    # ---------------------------------------------------------
    # Test on unseen test data
    # ---------------------------------------------------------

    predictions = model.predict(
        x_test_final
    )

    # ---------------------------------------------------------
    # Evaluation metrics
    # ---------------------------------------------------------

    metrics = {
        "accuracy": accuracy_score(
            y_test,
            predictions,
        ),

        "precision": precision_score(
            y_test,
            predictions,
            zero_division=0,
        ),

        "recall": recall_score(
            y_test,
            predictions,
            zero_division=0,
        ),

        "f1": f1_score(
            y_test,
            predictions,
            zero_division=0,
        ),

        "confusion_matrix": confusion_matrix(
            y_test,
            predictions,
        ).tolist(),

        "train_samples": len(x_train),

        "test_samples": len(x_test),

        "features": len(NUM) + len(
            encoder.get_feature_names_out(CAT)
        ),

        "model": "RandomForestClassifier",
    }

    # ---------------------------------------------------------
    # Save trained model and preprocessing objects
    # ---------------------------------------------------------

    Path("models").mkdir(
        exist_ok=True
    )

    model_package = {
        "model": model,
        "encoder": encoder,
        "scaler": scaler,
        "num_cols": NUM,
        "cat_cols": CAT,
    }

    joblib.dump(
        model_package,
        "models/ids_rf.joblib",
    )

    # ---------------------------------------------------------
    # Save evaluation metrics
    # ---------------------------------------------------------

    Path(
        "models/ml_metrics.json"
    ).write_text(
        json.dumps(
            metrics,
            indent=2,
        ),
        encoding="utf-8",
    )

    # ---------------------------------------------------------
    # Print results
    # ---------------------------------------------------------

    print(
        json.dumps(
            metrics,
            indent=2,
        )
    )