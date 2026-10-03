import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const A = "http://127.0.0.1:8000";

const nav = [
  "Overview",
  "Live Monitor",
  "Alerts",
  "Investigation",
  "Analytics",
  "Detection Rules"
];

/* =========================================================
   HELPERS
   ========================================================= */

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "--"
    : d.toLocaleTimeString();
}

function formatDateTime(value) {
  if (!value) return "--";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "--"
    : d.toLocaleString();
}

/* =========================================================
   SPARKLINE
   ========================================================= */

function Spark({ v = [] }) {
  if (!v.length) {
    return <div className="empty">Waiting for telemetry...</div>;
  }

  const values = v.map((x) => safeNumber(x));
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const rg = mx - mn || 1;
  const denominator = Math.max(values.length - 1, 1);

  const pts = values
    .map(
      (x, i) =>
        `${(i / denominator) * 100},${
          68 - ((x - mn) / rg) * 56
        }`
    )
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 70"
      preserveAspectRatio="none"
      className="spark"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/* =========================================================
   DONUT
   ========================================================= */

function Donut({ items = [] }) {
  const total =
    items.reduce(
      (a, x) => a + safeNumber(x.value),
      0
    ) || 1;

  let off = 0;

  return (
    <div className="donutbox">
      <svg viewBox="0 0 42 42">
        <circle
          cx="21"
          cy="21"
          r="16"
          fill="none"
          stroke="#132b30"
          strokeWidth="5"
        />

        {items.map((x, i) => {
          const n =
            (safeNumber(x.value) / total) * 100;

          const element = (
            <circle
              key={`${x.name}-${i}`}
              cx="21"
              cy="21"
              r="16"
              fill="none"
              stroke={
                [
                  "#43f2d0",
                  "#25c7ff",
                  "#8a7dff",
                  "#ffca66"
                ][i % 4]
              }
              strokeWidth="5"
              strokeDasharray={`${n} ${100 - n}`}
              strokeDashoffset={-off}
              transform="rotate(-90 21 21)"
            />
          );

          off += n;

          return element;
        })}
      </svg>

      <b>{total}</b>
    </div>
  );
}

/* =========================================================
   STATUS DOT
   ========================================================= */

function StatusDot({ active = true }) {
  return (
    <span
      className={
        active
          ? "liveDot"
          : "liveDot inactive"
      }
    />
  );
}

/* =========================================================
   MAIN APP
   ========================================================= */

export default function App() {
  const [stats, setStats] = useState(null);
  const [traffic, setTraffic] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [tab, setTab] = useState("Overview");
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [note, setNote] = useState("");

  /* -------------------------------------------------------
     LOAD DASHBOARD DATA
     ------------------------------------------------------- */

  const load = async () => {
    try {
      const [s, t, a] = await Promise.all([
        fetch(
          `${A}/api/dashboard/stats`
        ).then((r) => r.json()),

        fetch(
          `${A}/api/dashboard/traffic`
        ).then((r) => r.json()),

        fetch(
          `${A}/api/dashboard/alerts?limit=30`
        ).then((r) => r.json())
      ]);

      setStats(s);
      setTraffic(Array.isArray(t) ? t : []);
      setAlerts(Array.isArray(a) ? a : []);

      if (sel) {
        try {
          const updated = await fetch(
            `${A}/api/alerts/${sel.alert_id}`
          ).then((r) => r.json());

          setSel(updated);
        } catch (error) {
          console.error(
            "Unable to refresh selected alert:",
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "Dashboard API error:",
        error
      );
    }
  };

  /* -------------------------------------------------------
     AUTO REFRESH
     ------------------------------------------------------- */

  useEffect(() => {
    load();

    const id = setInterval(
      load,
      2500
    );

    return () => clearInterval(id);
  }, []);

  /* -------------------------------------------------------
     OPEN ALERT
     ------------------------------------------------------- */

  const open = async (a) => {
    try {
      const result = await fetch(
        `${A}/api/alerts/${a.alert_id}`
      ).then((r) => r.json());

      setSel(result);
      setTab("Investigation");
    } catch (error) {
      console.error(
        "Unable to open alert:",
        error
      );
    }
  };

  /* -------------------------------------------------------
     UPDATE ALERT STATUS
     ------------------------------------------------------- */

  const status = async (s) => {
    if (!sel) return;

    try {
      await fetch(
        `${A}/api/alerts/${sel.alert_id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            status: s
          })
        }
      );

      await load();
    } catch (error) {
      console.error(
        "Status update failed:",
        error
      );
    }
  };

  /* -------------------------------------------------------
     ADD ANALYST NOTE
     ------------------------------------------------------- */

  const addNote = async () => {
    if (!sel || !note.trim()) return;

    try {
      await fetch(
        `${A}/api/alerts/${sel.alert_id}/notes`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            note
          })
        }
      );

      setNote("");

      await load();
    } catch (error) {
      console.error(
        "Adding note failed:",
        error
      );
    }
  };

  const shown = alerts.filter(
    (x) =>
      filter === "ALL" ||
      x.severity === filter
  );

  return (
    <div className="shell">

      {/* ===================================================
          SIDEBAR
          =================================================== */}

      <aside>

        <div className="brand">
          <strong>
            ✦ CYBER<span>GRID</span>
          </strong>

          <small>IDS COMMAND</small>
        </div>

        <label>
          SECURITY OPERATIONS
        </label>

        {nav.map((n, i) => (
          <button
            className={
              tab === n
                ? "active"
                : ""
            }
            onClick={() => {
              setTab(n);

              if (
                n !==
                "Investigation"
              ) {
                setSel(null);
              }
            }}
            key={n}
          >
            <i>
              {
                [
                  "◈",
                  "◉",
                  "△",
                  "⌕",
                  "◌",
                  "◇"
                ][i]
              }
            </i>

            {n}

            {n === "Alerts" && (
              <em>
                {stats?.open_alerts || 0}
              </em>
            )}
          </button>
        ))}

        <div className="online">
          <StatusDot />

          <span>
            Simulation online
            <small>
              Synthetic telemetry active
            </small>
          </span>
        </div>

      </aside>

      {/* ===================================================
          MAIN CONTENT
          =================================================== */}

      <main>

        <header>

          <div>

            <small>
              SECURITY OPERATIONS CENTER /{" "}
              <b>NETWORK IDS</b>
            </small>

            <h1>{tab}</h1>

            <p>
              Real-time threat intelligence
              & incident monitoring
            </p>

          </div>

          <div className="top">
            <span>● LIVE</span>
            <span>Global SOC ▾</span>
            <b>VD</b>
          </div>

        </header>

        {/* =================================================
            INVESTIGATION
            ================================================= */}

        {tab === "Investigation" &&
        sel ? (

          <Investigation
            sel={sel}
            note={note}
            setNote={setNote}
            status={status}
            addNote={addNote}
            back={() => {
              setSel(null);
              setTab("Alerts");
            }}
          />

        /* =================================================
           LIVE MONITOR
           ================================================= */

        ) : tab ===
          "Live Monitor" ? (

          <LiveMonitor
            stats={stats}
            traffic={traffic}
            alerts={alerts}
            open={open}
          />

        /* =================================================
           ALERTS
           ================================================= */

        ) : tab === "Alerts" ? (

          <Alerts
            alerts={alerts}
            filter={filter}
            setFilter={setFilter}
            open={open}
          />

        /* =================================================
           ANALYTICS
           ================================================= */

        ) : tab === "Analytics" ? (

          <Analytics
            stats={stats}
            traffic={traffic}
            alerts={alerts}
          />

        /* =================================================
           DETECTION RULES
           ================================================= */

        ) : tab ===
          "Detection Rules" ? (

          <DetectionRules
            stats={stats}
          />

        /* =================================================
           DEFAULT / OVERVIEW
           ================================================= */

        ) : (

          <Overview
            stats={stats}
            traffic={traffic}
            shown={shown}
            filter={filter}
            setFilter={setFilter}
            open={open}
          />

        )}

      </main>

    </div>
  );
}

/* =========================================================
   OVERVIEW PAGE
   ========================================================= */

function Overview({
  stats,
  traffic,
  shown,
  filter,
  setFilter,
  open
}) {
  return (
    <>
      <div className="filters">

        <span>
          Team: <b>Global SOC</b>
        </span>

        <span>
          Region: <b>Asia Pacific</b>
        </span>

        <span>
          Time Range:{" "}
          <b>Last 24 Hours</b>
        </span>

      </div>

      {/* HERO */}

      <div className="hero">

        <div className="panel globe">

          <div className="eyebrow">
            GLOBAL THREAT RADAR
          </div>

          <h2>
            Network Activity
          </h2>

          <div className="sphere">

            <div className="orbital"></div>

            <div className="orbital two"></div>

            <i>◈</i>

          </div>

          <footer>
            ● Synthetic telemetry{" "}
            <b>
              {stats?.total_flows || 0}
            </b>{" "}
            flows analyzed
          </footer>

        </div>

        <div className="panel radar">

          <div className="eyebrow">
            DETECTION OVERVIEW
          </div>

          <div className="radarart">
            <i></i>
            <span></span>
            <b></b>
          </div>

          <strong>
            {stats?.open_alerts || 0}
          </strong>

          <small>
            Open alerts
          </small>

        </div>

      </div>

      {/* KPIs */}

      <div className="kpis">

        {[
          [
            "Security Score",
            `${Math.max(
              0,
              100 -
                safeNumber(
                  stats?.average_risk
                )
            ).toFixed(0)}%`
          ],

          [
            "Threats Detected",
            stats?.suspicious_traffic ||
              0
          ],

          [
            "Open Incidents",
            stats?.open_alerts || 0
          ],

          [
            "Average Risk",
            safeNumber(
              stats?.average_risk
            ).toFixed(2)
          ]
        ].map((x) => (

          <div
            className="panel kpi"
            key={x[0]}
          >

            <small>{x[0]}</small>

            <strong>{x[1]}</strong>

            <em>
              live telemetry
            </em>

            <div className="mini">

              <Spark
                v={traffic
                  .slice(-10)
                  .map((x) =>
                    safeNumber(x.pps)
                  )}
              />

            </div>

          </div>

        ))}

      </div>

      {/* CHARTS */}

      <div className="grid">

        <div className="panel chart wide">

          <div>
            Threat Activity Timeline
            <small>
              PACKETS / SEC
            </small>
          </div>

          <Spark
            v={traffic.map((x) =>
              safeNumber(x.pps)
            )}
          />

        </div>

        <div className="panel chart">

          <div>
            Protocol Distribution
          </div>

          <div className="donutrow">

            <Donut
              items={
                stats?.protocol_distribution ||
                []
              }
            />

            <div>

              {(
                stats?.protocol_distribution ||
                []
              ).map((x) => (

                <p key={x.name}>
                  ● {x.name}
                  <b>{x.value}</b>
                </p>

              ))}

            </div>

          </div>

        </div>

        <div className="panel chart">

          <div>
            Alerts by Severity
          </div>

          {(
            stats?.severity_distribution ||
            []
          ).map((x) => (

            <div
              className="bar"
              key={x.name}
            >

              <span>{x.name}</span>

              <i>
                <b
                  style={{
                    width: `${Math.min(
                      100,
                      safeNumber(
                        x.value
                      ) * 6
                    )}%`
                  }}
                />
              </i>

              <strong>
                {x.value}
              </strong>

            </div>

          ))}

        </div>

        <div className="panel chart">

          <div>
            Top Alert Types
          </div>

          {(
            stats?.alert_types || []
          )
            .slice(0, 5)
            .map((x) => (

              <div
                className="bar"
                key={x.name}
              >

                <span>
                  {x.name}
                </span>

                <i>
                  <b
                    style={{
                      width: `${Math.min(
                        100,
                        safeNumber(
                          x.value
                        ) * 6
                      )}%`
                    }}
                  />
                </i>

                <strong>
                  {x.value}
                </strong>

              </div>

            ))}

        </div>

      </div>

      {/* ALERT TABLE */}

      <div className="panel table">

        <div className="tablehead">

          Live Alert Queue

          <div>

            {[
              "ALL",
              "CRITICAL",
              "HIGH",
              "MEDIUM",
              "LOW"
            ].map((x) => (

              <button
                className={
                  filter === x
                    ? "sel"
                    : ""
                }
                onClick={() =>
                  setFilter(x)
                }
                key={x}
              >
                {x}
              </button>

            ))}

          </div>

        </div>

        <table>

          <thead>

            <tr>
              <th>TIME</th>
              <th>SOURCE</th>
              <th>DESTINATION</th>
              <th>DETECTION</th>
              <th>SEVERITY</th>
              <th>RISK</th>
              <th>STATUS</th>
            </tr>

          </thead>

          <tbody>

            {shown.map((a) => (

              <tr
                onClick={() =>
                  open(a)
                }
                key={a.alert_id}
              >

                <td>
                  {formatTime(
                    a.timestamp
                  )}
                </td>

                <td>
                  {a.source_ip}
                </td>

                <td>
                  {a.destination_ip}:
                  {a.destination_port}
                </td>

                <td>

                  <b>
                    {a.alert_type}
                  </b>

                  <small>
                    {a.rule_id}
                  </small>

                </td>

                <td>

                  <label
                    className={
                      "sev " +
                      String(
                        a.severity ||
                          "LOW"
                      ).toLowerCase()
                    }
                  >
                    {a.severity}
                  </label>

                </td>

                <td className="risk">
                  {Math.round(
                    safeNumber(
                      a.risk_score
                    )
                  )}
                </td>

                <td>
                  {a.status}
                </td>

              </tr>

            ))}

            {!shown.length && (

              <tr>

                <td
                  colSpan="7"
                  className="empty"
                >
                  No alerts yet - start
                  the simulator.
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>
    </>
  );
}

/* =========================================================
   LIVE MONITOR PAGE
   ========================================================= */

function LiveMonitor({
  stats,
  traffic,
  alerts,
  open
}) {
  const packetSeries = traffic
    .slice(-30)
    .map((x) =>
      safeNumber(x.pps)
    );

  const peakPps = packetSeries.length
    ? Math.max(...packetSeries)
    : 0;

  const avgPps = packetSeries.length
    ? packetSeries.reduce(
        (a, b) => a + b,
        0
      ) / packetSeries.length
    : 0;

  const recentAlerts =
    alerts.slice(0, 8);

  return (
    <section className="livePage">

      <div className="liveToolbar">

        <div>
          <span className="eyebrow">
            REAL-TIME TELEMETRY
          </span>

          <h2>
            Live Network Monitor
          </h2>

          <p>
            Continuous synthetic network-flow
            observation and hybrid IDS analysis.
          </p>
        </div>

        <div className="liveStatus">

          <StatusDot />

          <div>
            <strong>
              ENGINE ONLINE
            </strong>

            <small>
              Polling every 2.5 seconds
            </small>
          </div>

        </div>

      </div>

      {/* LIVE KPIs */}

      <div className="liveMetrics">

        <div className="panel liveMetric">

          <small>
            FLOWS OBSERVED
          </small>

          <strong>
            {stats?.total_flows || 0}
          </strong>

          <span>
            Synthetic flow records
          </span>

        </div>

        <div className="panel liveMetric">

          <small>
            ACTIVE ALERTS
          </small>

          <strong>
            {stats?.open_alerts || 0}
          </strong>

          <span>
            Requiring triage
          </span>

        </div>

        <div className="panel liveMetric">

          <small>
            AVG PACKETS / SEC
          </small>

          <strong>
            {avgPps.toFixed(1)}
          </strong>

          <span>
            Current telemetry window
          </span>

        </div>

        <div className="panel liveMetric">

          <small>
            PEAK PACKETS / SEC
          </small>

          <strong>
            {peakPps.toFixed(1)}
          </strong>

          <span>
            Highest observed sample
          </span>

        </div>

      </div>

      {/* TELEMETRY + ENGINE */}

      <div className="liveGrid">

        <div className="panel liveChart">

          <div className="sectionTitle">

            <div>
              <span className="eyebrow">
                PACKET TELEMETRY
              </span>

              <h3>
                Live Packet Activity
              </h3>
            </div>

            <span className="streamBadge">
              ● STREAMING
            </span>

          </div>

          <div className="liveSpark">

            <Spark
              v={packetSeries}
            />

          </div>

          <div className="chartFooter">

            <span>
              Samples{" "}
              <b>
                {packetSeries.length}
              </b>
            </span>

            <span>
              Average{" "}
              <b>
                {avgPps.toFixed(1)} PPS
              </b>
            </span>

            <span>
              Peak{" "}
              <b>
                {peakPps.toFixed(1)} PPS
              </b>
            </span>

          </div>

        </div>

        <div className="panel enginePanel">

          <div className="sectionTitle">

            <div>
              <span className="eyebrow">
                HYBRID ANALYSIS
              </span>

              <h3>
                IDS Processing Pipeline
              </h3>
            </div>

          </div>

          <div className="pipeline">

            {[
              [
                "01",
                "FLOW INGESTION",
                "Synthetic network flow"
              ],
              [
                "02",
                "FEATURE EXTRACTION",
                "Behavioral features"
              ],
              [
                "03",
                "SIGNATURE ENGINE",
                "Rule-based detection"
              ],
              [
                "04",
                "ANOMALY ENGINE",
                "Baseline deviation"
              ],
              [
                "05",
                "ML DETECTOR",
                "Random Forest"
              ],
              [
                "06",
                "RISK ENGINE",
                "Hybrid risk score"
              ]
            ].map(
              ([num, title, desc]) => (

                <div
                  className="pipelineStep"
                  key={num}
                >

                  <span>
                    {num}
                  </span>

                  <div>
                    <strong>
                      {title}
                    </strong>

                    <small>
                      {desc}
                    </small>
                  </div>

                  <i>✓</i>

                </div>

              )
            )}

          </div>

        </div>

      </div>

      {/* FLOW ACTIVITY */}

      <div className="panel table liveTable">

        <div className="tablehead">

          <span>
            Live Flow Activity
          </span>

          <span className="tableLive">
            ● LIVE
          </span>

        </div>

        <table>

          <thead>

            <tr>
              <th>TIME</th>
              <th>SOURCE</th>
              <th>DESTINATION</th>
              <th>PROTOCOL</th>
              <th>PPS</th>
              <th>CONNECTION RATE</th>
              <th>STATUS</th>
            </tr>

          </thead>

          <tbody>

            {traffic
              .slice(-12)
              .reverse()
              .map((x, i) => {

                const risk =
                  safeNumber(
                    x.risk_score
                  );

                const status =
                  risk > 80
                    ? "CRITICAL"
                    : risk > 60
                    ? "HIGH"
                    : risk > 40
                    ? "SUSPICIOUS"
                    : "NORMAL";

                return (
                  <tr
                    key={
                      x.flow_id ||
                      `${x.timestamp}-${i}`
                    }
                  >

                    <td>
                      {formatTime(
                        x.timestamp
                      )}
                    </td>

                    <td>
                      {x.source_ip ||
                        "--"}
                    </td>

                    <td>
                      {x.destination_ip ||
                        "--"}
                      {x.destination_port
                        ? `:${x.destination_port}`
                        : ""}
                    </td>

                    <td>
                      {x.protocol ||
                        "--"}
                    </td>

                    <td>
                      {safeNumber(
                        x.pps
                      ).toFixed(1)}
                    </td>

                    <td>
                      {safeNumber(
                        x.connection_rate
                      ).toFixed(2)}
                    </td>

                    <td>

                      <label
                        className={
                          "sev " +
                          status.toLowerCase()
                        }
                      >
                        {status}
                      </label>

                    </td>

                  </tr>
                );
              })}

            {!traffic.length && (

              <tr>
                <td
                  colSpan="7"
                  className="empty"
                >
                  Waiting for simulator
                  telemetry...
                </td>
              </tr>

            )}

          </tbody>

        </table>

      </div>

      {/* RECENT DETECTIONS */}

      <div className="panel recentDetections">

        <div className="sectionTitle">

          <div>
            <span className="eyebrow">
              DETECTION STREAM
            </span>

            <h3>
              Recent Detections
            </h3>
          </div>

          <span>
            {alerts.length} events
          </span>

        </div>

        <div className="detectionList">

          {recentAlerts.map((a) => (

            <button
              className="detectionItem"
              onClick={() =>
                open(a)
              }
              key={a.alert_id}
            >

              <div className="detectionIcon">
                !
              </div>

              <div className="detectionMain">

                <strong>
                  {a.alert_type}
                </strong>

                <small>
                  {a.source_ip} →{" "}
                  {a.destination_ip}
                </small>

              </div>

              <div className="detectionMeta">

                <label
                  className={
                    "sev " +
                    String(
                      a.severity ||
                        "LOW"
                    ).toLowerCase()
                  }
                >
                  {a.severity}
                </label>

                <b>
                  {Math.round(
                    safeNumber(
                      a.risk_score
                    )
                  )}
                </b>

                <small>
                  {formatTime(
                    a.timestamp
                  )}
                </small>

              </div>

            </button>

          ))}

          {!recentAlerts.length && (
            <div className="empty">
              No detections available.
            </div>
          )}

        </div>

      </div>

    </section>
  );
}

/* =========================================================
   ALERTS PAGE
   ========================================================= */

function Alerts({
  alerts,
  filter,
  setFilter,
  open
}) {
  const filtered = useMemo(
    () =>
      alerts.filter(
        (a) =>
          filter === "ALL" ||
          a.severity === filter
      ),
    [alerts, filter]
  );

  const counts = {
    ALL: alerts.length,
    CRITICAL: alerts.filter(
      (a) => a.severity === "CRITICAL"
    ).length,
    HIGH: alerts.filter(
      (a) => a.severity === "HIGH"
    ).length,
    MEDIUM: alerts.filter(
      (a) => a.severity === "MEDIUM"
    ).length,
    LOW: alerts.filter(
      (a) => a.severity === "LOW"
    ).length
  };

  const newCount = alerts.filter(
    (a) => a.status === "NEW"
  ).length;

  const investigatingCount =
    alerts.filter(
      (a) =>
        a.status ===
        "INVESTIGATING"
    ).length;

  return (
    <section className="alertsPage">

      {/* ALERT HERO */}

      <div className="alertsHero panel">

        <div>

          <span className="eyebrow">
            SECURITY EVENT MANAGEMENT
          </span>

          <h2>
            Alert Operations Queue
          </h2>

          <p>
            Review, triage and investigate
            detections generated by the hybrid
            network IDS.
          </p>

        </div>

        <div className="alertHeroStats">

          <div>
            <strong>
              {alerts.length}
            </strong>

            <span>
              Total Events
            </span>
          </div>

          <div>
            <strong>
              {newCount}
            </strong>

            <span>
              New
            </span>
          </div>

          <div>
            <strong>
              {investigatingCount}
            </strong>

            <span>
              Investigating
            </span>
          </div>

        </div>

      </div>

      {/* SEVERITY FILTERS */}

      <div className="alertFilters">

        {[
          ["ALL", "ALL ALERTS"],
          [
            "CRITICAL",
            "CRITICAL"
          ],
          ["HIGH", "HIGH"],
          ["MEDIUM", "MEDIUM"],
          ["LOW", "LOW"]
        ].map(([key, label]) => (

          <button
            className={
              filter === key
                ? "severityFilter active"
                : "severityFilter"
            }
            onClick={() =>
              setFilter(key)
            }
            key={key}
          >

            <span>
              {label}
            </span>

            <strong>
              {counts[key]}
            </strong>

          </button>

        ))}

      </div>

      {/* ALERT TABLE */}

      <div className="panel table alertsTable">

        <div className="tablehead">

          <div>
            Detection Event Queue
            <small>
              Click any event to open
              investigation
            </small>
          </div>

          <span className="queueStatus">
            ● {filtered.length} visible
          </span>

        </div>

        <table>

          <thead>

            <tr>
              <th>EVENT</th>
              <th>TIME</th>
              <th>SOURCE</th>
              <th>DESTINATION</th>
              <th>RULE</th>
              <th>SEVERITY</th>
              <th>RISK</th>
              <th>STATUS</th>
              <th></th>
            </tr>

          </thead>

          <tbody>

            {filtered.map((a) => (

              <tr
                key={a.alert_id}
                onClick={() =>
                  open(a)
                }
              >

                <td>

                  <div className="eventCell">

                    <span className="eventIcon">
                      !
                    </span>

                    <div>
                      <b>
                        {a.alert_type}
                      </b>

                      <small>
                        {a.alert_id}
                      </small>
                    </div>

                  </div>

                </td>

                <td>
                  {formatTime(
                    a.timestamp
                  )}
                </td>

                <td>
                  {a.source_ip}
                </td>

                <td>
                  {a.destination_ip}
                  {a.destination_port
                    ? `:${a.destination_port}`
                    : ""}
                </td>

                <td>
                  <b>
                    {a.rule_id}
                  </b>
                </td>

                <td>

                  <label
                    className={
                      "sev " +
                      String(
                        a.severity ||
                          "LOW"
                      ).toLowerCase()
                    }
                  >
                    {a.severity}
                  </label>

                </td>

                <td className="risk">
                  {Math.round(
                    safeNumber(
                      a.risk_score
                    )
                  )}
                </td>

                <td>
                  <span className="statusText">
                    {a.status}
                  </span>
                </td>

                <td>
                  <button
                    className="inspectButton"
                    onClick={(e) => {
                      e.stopPropagation();
                      open(a);
                    }}
                  >
                    Inspect →
                  </button>
                </td>

              </tr>

            ))}

            {!filtered.length && (

              <tr>

                <td
                  colSpan="9"
                  className="empty"
                >
                  No alerts match the
                  selected severity.
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

      {/* TRIAGE INFORMATION */}

      <div className="triageGrid">

        <div className="panel triageCard">

          <span className="triageIcon">
            01
          </span>

          <div>
            <h3>
              Triage Priority
            </h3>

            <p>
              Critical and high severity
              detections should be reviewed
              through the investigation workflow.
            </p>
          </div>

        </div>

        <div className="panel triageCard">

          <span className="triageIcon">
            02
          </span>

          <div>
            <h3>
              Evidence Review
            </h3>

            <p>
              Review source, destination,
              protocol, rule hits, anomaly
              score and risk score.
            </p>
          </div>

        </div>

        <div className="panel triageCard">

          <span className="triageIcon">
            03
          </span>

          <div>
            <h3>
              Workflow Status
            </h3>

            <p>
              Move events through NEW,
              INVESTIGATING, RESOLVED or
              FALSE_POSITIVE.
            </p>
          </div>

        </div>

      </div>

    </section>
  );
}

/* =========================================================
   ANALYTICS PAGE
   ========================================================= */

function Analytics({
  stats,
  traffic,
  alerts
}) {
  const protocols = {};
  const ports = {};
  const sources = {};

  const risks = {
    NORMAL: 0,
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };

  alerts.forEach((a) => {

    const protocol =
      a.protocol || "UNKNOWN";

    const port =
      a.destination_port ||
      "UNKNOWN";

    const source =
      a.source_ip ||
      "UNKNOWN";

    protocols[protocol] =
      (protocols[protocol] || 0) + 1;

    ports[port] =
      (ports[port] || 0) + 1;

    sources[source] =
      (sources[source] || 0) + 1;

    if (
      risks[a.severity] !==
      undefined
    ) {
      risks[a.severity]++;
    }
  });

  const protocolList =
    Object.entries(protocols)
      .sort(
        (a, b) => b[1] - a[1]
      );

  const portList =
    Object.entries(ports)
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 8);

  const sourceList =
    Object.entries(sources)
      .sort(
        (a, b) => b[1] - a[1]
      )
      .slice(0, 8);

  const maxProtocol =
    Math.max(
      ...protocolList.map(
        (x) => x[1]
      ),
      1
    );

  const maxPort =
    Math.max(
      ...portList.map(
        (x) => x[1]
      ),
      1
    );

  const maxSource =
    Math.max(
      ...sourceList.map(
        (x) => x[1]
      ),
      1
    );

  const peakPps = traffic.length
    ? Math.max(
        ...traffic.map((x) =>
          safeNumber(x.pps)
        )
      )
    : 0;

  return (
    <section className="analyticsPage">

      <div className="filters">

        <span>
          Analytics Scope:{" "}
          <b>Network IDS</b>
        </span>

        <span>
          Data Source:{" "}
          <b>Synthetic Telemetry</b>
        </span>

        <span>
          Time Range:{" "}
          <b>Last 24 Hours</b>
        </span>

      </div>

      <div className="analyticsKpis">

        <div className="panel kpi">
          <small>
            TOTAL FLOWS
          </small>

          <strong>
            {stats?.total_flows || 0}
          </strong>

          <em>
            Network observations
          </em>
        </div>

        <div className="panel kpi">
          <small>
            SUSPICIOUS FLOWS
          </small>

          <strong>
            {stats?.suspicious_traffic ||
              0}
          </strong>

          <em>
            Detection candidates
          </em>
        </div>

        <div className="panel kpi">
          <small>
            OPEN ALERTS
          </small>

          <strong>
            {stats?.open_alerts || 0}
          </strong>

          <em>
            Require investigation
          </em>
        </div>

        <div className="panel kpi">
          <small>
            AVERAGE RISK
          </small>

          <strong>
            {safeNumber(
              stats?.average_risk
            ).toFixed(1)}
          </strong>

          <em>
            Project risk score
          </em>
        </div>

      </div>

      <div className="analyticsGrid">

        <div className="panel chart analyticsWide">

          <div className="chartTitle">

            <span>
              Traffic Activity Analysis
            </span>

            <small>
              PACKETS / SEC
            </small>

          </div>

          <div className="bigSpark">

            <Spark
              v={traffic.map((x) =>
                safeNumber(x.pps)
              )}
            />

          </div>

          <div className="chartMeta">

            <span>
              Samples{" "}
              <b>
                {traffic.length}
              </b>
            </span>

            <span>
              Peak PPS{" "}
              <b>
                {peakPps.toFixed(1)}
              </b>
            </span>

          </div>

        </div>

        <div className="panel chart">

          <div className="chartTitle">
            Protocol Distribution
          </div>

          {protocolList.length ? (

            protocolList.map(
              ([name, value]) => (

                <div
                  className="bar"
                  key={name}
                >

                  <span>
                    {name}
                  </span>

                  <i>
                    <b
                      style={{
                        width: `${
                          (value /
                            maxProtocol) *
                          100
                        }%`
                      }}
                    />
                  </i>

                  <strong>
                    {value}
                  </strong>

                </div>

              )
            )

          ) : (

            <div className="empty">
              No protocol data available
            </div>

          )}

        </div>

        <div className="panel chart">

          <div className="chartTitle">
            Risk / Severity Distribution
          </div>

          {Object.entries(
            risks
          ).map(
            ([name, value]) => (

              <div
                className="bar"
                key={name}
              >

                <span>
                  {name}
                </span>

                <i>
                  <b
                    style={{
                      width: `${Math.min(
                        100,
                        value * 10
                      )}%`
                    }}
                  />
                </i>

                <strong>
                  {value}
                </strong>

              </div>

            )
          )}

        </div>

        <div className="panel chart">

          <div className="chartTitle">
            Destination Port Activity
          </div>

          {portList.length ? (

            portList.map(
              ([name, value]) => (

                <div
                  className="bar"
                  key={name}
                >

                  <span>
                    PORT {name}
                  </span>

                  <i>
                    <b
                      style={{
                        width: `${
                          (value /
                            maxPort) *
                          100
                        }%`
                      }}
                    />
                  </i>

                  <strong>
                    {value}
                  </strong>

                </div>

              )
            )

          ) : (

            <div className="empty">
              No port activity available
            </div>

          )}

        </div>

        <div className="panel chart analyticsWide">

          <div className="chartTitle">
            Top Source IPs by Alerts
          </div>

          {sourceList.length ? (

            sourceList.map(
              ([name, value]) => (

                <div
                  className="bar"
                  key={name}
                >

                  <span>
                    {name}
                  </span>

                  <i>
                    <b
                      style={{
                        width: `${
                          (value /
                            maxSource) *
                          100
                        }%`
                      }}
                    />
                  </i>

                  <strong>
                    {value}
                  </strong>

                </div>

              )
            )

          ) : (

            <div className="empty">
              No source activity available
            </div>

          )}

        </div>

        <div className="panel chart">

          <div className="chartTitle">
            Alert Intelligence
          </div>

          <div className="analyticsStat">
            <span>Critical</span>
            <b>
              {risks.CRITICAL}
            </b>
          </div>

          <div className="analyticsStat">
            <span>High</span>
            <b>
              {risks.HIGH}
            </b>
          </div>

          <div className="analyticsStat">
            <span>Medium</span>
            <b>
              {risks.MEDIUM}
            </b>
          </div>

          <div className="analyticsStat">
            <span>Low</span>
            <b>
              {risks.LOW}
            </b>
          </div>

          <div className="analyticsStat">
            <span>Normal</span>
            <b>
              {risks.NORMAL}
            </b>
          </div>

        </div>

      </div>

      <div className="panel table analyticsTable">

        <div className="tablehead">
          Recent Detection Analytics
        </div>

        <table>

          <thead>

            <tr>
              <th>TIME</th>
              <th>SOURCE</th>
              <th>PROTOCOL</th>
              <th>DESTINATION PORT</th>
              <th>DETECTION</th>
              <th>SEVERITY</th>
              <th>RISK</th>
            </tr>

          </thead>

          <tbody>

            {alerts
              .slice(0, 12)
              .map((a) => (

                <tr
                  key={a.alert_id}
                >

                  <td>
                    {formatTime(
                      a.timestamp
                    )}
                  </td>

                  <td>
                    {a.source_ip}
                  </td>

                  <td>
                    {a.protocol}
                  </td>

                  <td>
                    {a.destination_port}
                  </td>

                  <td>
                    <b>
                      {a.alert_type}
                    </b>
                  </td>

                  <td>

                    <label
                      className={
                        "sev " +
                        String(
                          a.severity ||
                            "LOW"
                        ).toLowerCase()
                      }
                    >
                      {a.severity}
                    </label>

                  </td>

                  <td className="risk">
                    {Math.round(
                      safeNumber(
                        a.risk_score
                      )
                    )}
                  </td>

                </tr>

              ))}

            {!alerts.length && (

              <tr>

                <td
                  colSpan="7"
                  className="empty"
                >
                  No detection data
                  available.
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

    </section>
  );
}

/* =========================================================
   DETECTION RULES PAGE
   ========================================================= */

function DetectionRules({
  stats
}) {
  const rules = [
    {
      id: "IDS-001",
      name: "High Connection Rate",
      severity: "HIGH",
      threshold:
        "≥ 20 connections/sec",
      description:
        "Detects unusually high connection activity compared with the configured traffic baseline.",
      category:
        "Connection Behavior"
    },

    {
      id: "IDS-002",
      name:
        "Repeated Failed Connections",
      severity: "HIGH",
      threshold:
        "Failure ratio ≥ 35%",
      description:
        "Detects repeated failed connection attempts that may indicate abnormal authentication or service activity.",
      category:
        "Connection Behavior"
    },

    {
      id: "IDS-003",
      name:
        "Multi-Port Activity",
      severity: "HIGH",
      threshold:
        "≥ 20 destination ports",
      description:
        "Detects unusually broad destination-port activity within a synthetic flow record.",
      category:
        "Port Behavior"
    },

    {
      id: "IDS-004",
      name:
        "SYN-Heavy Pattern",
      severity: "HIGH",
      threshold:
        "SYN ratio ≥ 65%",
      description:
        "Detects SYN-heavy traffic combined with elevated packet-rate behavior.",
      category:
        "TCP Behavior"
    },

    {
      id: "IDS-005",
      name:
        "Unusual Service-Port Activity",
      severity: "MEDIUM",
      threshold:
        "Configured service-port policy",
      description:
        "Detects activity involving ports outside the expected service-port profile.",
      category:
        "Service Behavior"
    },

    {
      id: "IDS-006",
      name:
        "High Traffic Volume",
      severity: "HIGH",
      threshold:
        "≥ 250 KB/sec",
      description:
        "Detects unusually high byte-rate activity compared with the configured baseline.",
      category:
        "Traffic Volume"
    }
  ];

  const highRules =
    rules.filter(
      (r) => r.severity === "HIGH"
    ).length;

  const mediumRules =
    rules.filter(
      (r) => r.severity === "MEDIUM"
    ).length;

  return (
    <section className="rulesPage">

      <div className="filters">

        <span>
          Rule Engine:{" "}
          <b>Hybrid IDS</b>
        </span>

        <span>
          Detection Mode:{" "}
          <b>Signature Based</b>
        </span>

        <span>
          Status:{" "}
          <b>6 Active Rules</b>
        </span>

      </div>

      <div className="rulesSummary">

        <div className="panel ruleSummaryCard">

          <small>
            ACTIVE RULES
          </small>

          <strong>
            {rules.length}
          </strong>

          <em>
            Configured detection
            signatures
          </em>

        </div>

        <div className="panel ruleSummaryCard">

          <small>
            HIGH SEVERITY
          </small>

          <strong>
            {highRules}
          </strong>

          <em>
            High-priority detection
            rules
          </em>

        </div>

        <div className="panel ruleSummaryCard">

          <small>
            MEDIUM SEVERITY
          </small>

          <strong>
            {mediumRules}
          </strong>

          <em>
            Medium-priority detection
            rules
          </em>

        </div>

        <div className="panel ruleSummaryCard">

          <small>
            OPEN ALERTS
          </small>

          <strong>
            {stats?.open_alerts || 0}
          </strong>

          <em>
            Currently requiring triage
          </em>

        </div>

      </div>

      <div className="panel rulesHeader">

        <div>

          <div className="eyebrow">
            IDS DETECTION ENGINE
          </div>

          <h2>
            Signature Detection Rules
          </h2>

          <p>
            Configured behavioral signatures
            used by the network intrusion
            detection engine.
          </p>

        </div>

        <div className="engineStatus">

          <span className="statusDot"></span>

          ENGINE ACTIVE

        </div>

      </div>

      <div className="rulesGrid">

        {rules.map((rule) => (

          <div
            className="panel ruleCard"
            key={rule.id}
          >

            <div className="ruleTop">

              <div className="ruleId">
                {rule.id}
              </div>

              <label
                className={
                  "sev " +
                  rule.severity.toLowerCase()
                }
              >
                {rule.severity}
              </label>

            </div>

            <h3>
              {rule.name}
            </h3>

            <div className="ruleCategory">
              {rule.category}
            </div>

            <p>
              {rule.description}
            </p>

            <div className="ruleThreshold">

              <span>
                TRIGGER CONDITION
              </span>

              <strong>
                {rule.threshold}
              </strong>

            </div>

            <div className="ruleFooter">

              <span>
                <i className="ruleEnabledDot"></i>
                ENABLED
              </span>

              <span>
                Signature ID:{" "}
                {rule.id}
              </span>

            </div>

          </div>

        ))}

      </div>

      <div className="panel ruleInfo">

        <div className="ruleInfoIcon">
          ◈
        </div>

        <div>

          <h3>
            Detection Methodology
          </h3>

          <p>
            Signature rules identify predefined
            suspicious network-flow
            characteristics. A rule match
            represents behavior requiring
            investigation and does not by
            itself prove malicious activity.
          </p>

        </div>

      </div>

    </section>
  );
}

/* =========================================================
   INVESTIGATION PAGE
   ========================================================= */

function Investigation({
  sel,
  note,
  setNote,
  status,
  addNote,
  back
}) {
  return (
    <section className="invest">

      <button
        className="back"
        onClick={back}
      >
        ← Back to queue
      </button>

      <div className="invgrid">

        {/* ALERT HEADER */}

        <div className="panel invhero">

          <small>
            SECURITY EVENT /{" "}
            {sel.alert_id}
          </small>

          <h2>
            {sel.alert_type}
          </h2>

          <p>
            {sel.description}
          </p>

          <div>

            <span>
              Source
              <b>
                {sel.source_ip}
              </b>
            </span>

            <span>
              Destination
              <b>
                {sel.destination_ip}
              </b>
            </span>

            <span>
              Protocol
              <b>
                {sel.protocol}
              </b>
            </span>

            <span>
              Rule
              <b>
                {sel.rule_id}
              </b>
            </span>

          </div>

        </div>

        {/* RISK */}

        <div className="panel score">

          <small>
            FINAL RISK
          </small>

          <strong>

            {Math.round(
              safeNumber(
                sel.risk_score
              )
            )}

            <i>
              /100
            </i>

          </strong>

          <hr
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  safeNumber(
                    sel.risk_score
                  )
                )
              )}%`
            }}
          />

          <b>
            {sel.severity}
          </b>

        </div>

        {/* EVIDENCE */}

        <div className="panel evidence">

          <h3>
            Detection evidence
          </h3>

          <p>
            Anomaly score
            <b>
              {sel.anomaly_score}
            </b>
          </p>

          <p>
            ML score
            <b>
              {sel.ml_score !==
              null &&
              sel.ml_score !==
              undefined
                ? safeNumber(
                    sel.ml_score
                  ).toFixed(2)
                : "--"}
            </b>
          </p>

          <p>
            Destination port
            <b>
              {sel.destination_port}
            </b>
          </p>

          <p>
            Classification
            <b>
              {sel.classification}
            </b>
          </p>

        </div>

        {/* WORKFLOW */}

        <div className="panel workflow">

          <h3>
            Incident workflow
          </h3>

          {[
            "NEW",
            "INVESTIGATING",
            "RESOLVED",
            "FALSE_POSITIVE"
          ].map((x) => (

            <button
              className={
                sel.status === x
                  ? "chosen"
                  : ""
              }
              onClick={() =>
                status(x)
              }
              key={x}
            >
              {x}
            </button>

          ))}

        </div>

        {/* NOTES */}

        <div className="panel notes">

          <h3>
            Analyst notes
          </h3>

          <textarea
            value={note}
            onChange={(e) =>
              setNote(
                e.target.value
              )
            }
            placeholder="Document investigation findings..."
          />

          <button
            onClick={addNote}
          >
            + Add investigation note
          </button>

          {(sel.notes || []).map(
            (n) => (

              <article
                key={n.note_id}
              >

                <small>
                  {formatDateTime(
                    n.created_at
                  )}
                </small>

                <p>
                  {n.note}
                </p>

              </article>

            )
          )}

        </div>

      </div>

    </section>
  );
}

/* =========================================================
   REACT MOUNT
   ========================================================= */

createRoot(
  document.getElementById("root")
).render(<App />);