# Network Intrusion Detection System (IDS) Simulation — Project Report
## Abstract
A defensive IDS simulation that analyzes synthetic network-flow records with signatures, anomaly detection, optional ML, risk scoring, alert correlation, and a SOC dashboard.
## Introduction
Network monitoring generates large telemetry volumes; IDS technology helps identify activity requiring investigation.
## Problem Statement
Safely simulate an IDS workflow without a physical network lab or real attack traffic.
## Objectives
Generate data, extract features, detect suspicious patterns, score risk, alert, correlate, visualize, investigate, and test.
## Network Security Background
Covers flows, events, alerts, incidents, NIDS, SOC triage, and detection engineering.
## Intrusion Detection Systems
IDS detects and alerts; IPS can also prevent. This project intentionally implements IDS behavior.
## Existing Approaches
Signature detection is explainable for known patterns; anomaly detection identifies deviations but can increase false positives; hybrid detection combines evidence.
## Proposed System
Synthetic traffic → feature extraction → rules/anomaly/ML → risk → alerts → correlation → database → dashboard.
## Architecture
See `docs/architecture.md`.
## Synthetic Dataset
At least 5,000 records using reserved documentation IP ranges and normal/suspicious scenarios.
## Traffic Simulation
The simulator posts synthetic flow data to the local API and never sends attack packets.
## Feature Engineering
Rates, ratios, connection behavior, packet statistics, and port diversity.
## Signature Detection
Six configurable defensive rules.
## Anomaly Detection
A baseline of normal synthetic traffic produces a bounded anomaly score.
## Machine Learning
Optional Random Forest evaluation with Accuracy, Precision, Recall, F1, and confusion matrix.
## Hybrid Detection
Detection evidence is combined into a project risk score.
## Risk Scoring
0–100 project-defined risk scale.
## Alert Generation
Structured alert metadata and lifecycle.
## Alert Correlation
Related alerts can be grouped by source/type and time window.
## Dashboard
Dark SOC interface inspired by the supplied reference: cyan/teal glow, radar/network visualization, KPI cards, charts, live queue, and investigation workspace.
## SOC Workflow
Event → detection → alert → triage → investigation → resolution/false positive/escalation → documentation.
## Testing
32 automated tests cover core validation, detection, scoring, alerts, and application schemas.
## Security
Synthetic data, no payload storage, input validation, and production hardening guidance.
## Results
Insert actual execution metrics after running the dataset, simulator, tests, and optional ML training.
## False Positives
Legitimate unusual activity may trigger rules; baselines, thresholds, context, and analyst feedback help.
## False Negatives
Suspicious behavior may resemble normal traffic; multiple detection methods can reduce misses.
## Limitations
Synthetic data, simplified baseline, no payload analysis, no automatic blocking, and dataset-dependent ML.
## Future Scope
Authorized PCAP, Zeek/Suricata, SIEM, threat intelligence, UEBA, cloud telemetry, centralized logging, model drift.
## Conclusion
The project demonstrates an end-to-end defensive IDS and SOC investigation workflow.
## Ethical Disclaimer
**This project is designed exclusively for defensive cybersecurity education. All suspicious network behavior is represented using synthetic data or authorized isolated lab environments.**
## Author
Vaidehi Deore
