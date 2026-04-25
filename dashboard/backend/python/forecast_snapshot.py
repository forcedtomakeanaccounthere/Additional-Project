#!/usr/bin/env python
"""Generate dashboard snapshot using notebook-trained groundwater artifacts."""

from __future__ import annotations

import argparse
import json
import math
import pickle
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd


LIVE_LAT = 13.562101
LIVE_LON = 80.025283
LIVE_TZ = "Asia/Kolkata"


@dataclass
class ModelBundle:
    xgb_model: Any
    top20_features: List[str]
    huber_model: Any
    scaler: Any
    blend_weights: Dict[str, float]


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        if value is None:
            return fallback
        if isinstance(value, (float, int, np.floating, np.integer)):
            if np.isnan(value):
                return fallback
            return float(value)
        value = float(value)
        if np.isnan(value):
            return fallback
        return value
    except Exception:
        return fallback


def fetch_live_weather() -> Dict[str, Any]:
    params = {
        "latitude": LIVE_LAT,
        "longitude": LIVE_LON,
        "timezone": LIVE_TZ,
        "past_days": 7,
        "forecast_days": 4,
        "hourly": "precipitation,temperature_2m,relative_humidity_2m,surface_pressure,cloud_cover",
        "daily": "precipitation_sum",
    }

    url = f"https://api.open-meteo.com/v1/forecast?{urlencode(params)}"
    request = Request(url, headers={"User-Agent": "groundwater-dashboard/1.0"})

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        return {
            "ok": False,
            "error": str(error),
            "hourlyMap": {},
            "dailyRows": [],
            "source": "fallback",
        }

    hourly = payload.get("hourly", {})
    h_times = hourly.get("time", [])
    h_rain = hourly.get("precipitation", [])
    h_temp = hourly.get("temperature_2m", [])
    h_hum = hourly.get("relative_humidity_2m", [])
    h_pressure = hourly.get("surface_pressure", [])
    h_cloud = hourly.get("cloud_cover", [])

    hourly_map: Dict[pd.Timestamp, Dict[str, float]] = {}
    for idx, raw_ts in enumerate(h_times):
        ts = pd.to_datetime(raw_ts, errors="coerce")
        if pd.isna(ts):
            continue
        timestamp = pd.Timestamp(ts).floor("h").tz_localize(None)
        hourly_map[timestamp] = {
            "Rain": _safe_float(h_rain[idx] if idx < len(h_rain) else 0.0),
            "Temperature": _safe_float(h_temp[idx] if idx < len(h_temp) else 28.0),
            "Humidity": _safe_float(h_hum[idx] if idx < len(h_hum) else 55.0),
            "Pressure": _safe_float(h_pressure[idx] if idx < len(h_pressure) else 1008.0),
            "Cloud_Cover": _safe_float(h_cloud[idx] if idx < len(h_cloud) else 50.0),
        }

    daily = payload.get("daily", {})
    d_times = daily.get("time", [])
    d_precip = daily.get("precipitation_sum", [])

    daily_rows = []
    for idx, raw_date in enumerate(d_times):
        date_value = pd.to_datetime(raw_date, errors="coerce")
        if pd.isna(date_value):
            continue
        daily_rows.append(
            {
                "date": pd.Timestamp(date_value).normalize().tz_localize(None),
                "precipitation": _safe_float(d_precip[idx] if idx < len(d_precip) else 0.0),
            }
        )

    return {
        "ok": True,
        "hourlyMap": hourly_map,
        "dailyRows": daily_rows,
        "source": "open-meteo",
        "timezone": payload.get("timezone", LIVE_TZ),
        "location": {
            "latitude": LIVE_LAT,
            "longitude": LIVE_LON,
            "name": "Central Expressway, Tirupati, Matterimetta",
        },
    }


def _get_live_hour(live_weather: Optional[Dict[str, Any]], ts: pd.Timestamp) -> Optional[Dict[str, float]]:
    if not live_weather or not live_weather.get("ok"):
        return None

    hour_map = live_weather.get("hourlyMap", {})
    key = pd.Timestamp(ts).floor("h").tz_localize(None)
    return hour_map.get(key)


def _load_artifact(path: Path) -> Any:
    if not path.exists():
        return None
    with path.open("rb") as handle:
        return pickle.load(handle)


def load_bundle(project_root: Path) -> ModelBundle:
    xgb_model = _load_artifact(project_root / "best_model_xgb_cv_top20.pkl")
    huber_model = _load_artifact(project_root / "best_model_huber_cv.pkl")
    scaler = _load_artifact(project_root / "hybrid_scaler.pkl")
    meta = _load_artifact(project_root / "best_hybrid_meta.pkl") or {}

    top20_features = meta.get("xgb_top20_features", [])
    if not top20_features:
        top20_features = [
            "wl_lag_1h",
            "wl_lag_2h",
            "wl_lag_3h",
            "wl_lag_24h",
            "wl_lag_168h",
            "rain_sum_24h",
            "rain_sum_72h",
            "wl_change_1h",
            "wl_change_3h",
            "evap_proxy",
            "pressure_drop_3h",
            "Humidity",
            "Rain",
            "Cloud_Cover",
            "hour_sin",
            "hour_cos",
            "month_sin",
            "month_cos",
            "drain_after_rain",
            "overflow_risk",
        ]

    blend_weights = meta.get("v6_local_blend_weights") or {
        "w_xgb": 0.65,
        "w_huber": 0.10,
        "w_naive": 0.25,
    }

    return ModelBundle(
        xgb_model=xgb_model,
        top20_features=top20_features,
        huber_model=huber_model,
        scaler=scaler,
        blend_weights=blend_weights,
    )


def load_dataframe(project_root: Path) -> pd.DataFrame:
    data_path = project_root / "preprocessed_water_level_data.csv"
    if not data_path.exists():
        raise FileNotFoundError(f"Missing data file: {data_path}")

    df = pd.read_csv(data_path)

    # Normalize historical naming variants from notebook outputs.
    rename_map = {
        "datetime": "DateTime",
        "water_level_mean": "Water_Level",
        "Temp_Out": "Temperature",
        "Out_Hum": "Humidity",
        "Bar": "Pressure",
        "drain_after_rain_flag": "drain_after_rain",
        "overflow_risk_prev1h": "overflow_risk",
    }
    df = df.rename(columns=rename_map)

    required_defaults = {
        "Rain": 0.0,
        "Water_Level": 0.0,
        "Temperature": 28.0,
        "Humidity": 55.0,
        "Pressure": 1008.0,
        "Cloud_Cover": 50.0,
        "drain_after_rain": 0.0,
        "overflow_risk": 0.0,
    }
    for col, default in required_defaults.items():
        if col not in df.columns:
            df[col] = default

    if "Cloud_Cover" in df.columns and "Solar_Rad" in df.columns:
        solar_norm = pd.to_numeric(df["Solar_Rad"], errors="coerce").fillna(0)
        cloud_from_solar = (100 - (solar_norm / max(solar_norm.max(), 1)) * 100).clip(0, 100)
        df["Cloud_Cover"] = pd.to_numeric(df["Cloud_Cover"], errors="coerce").fillna(cloud_from_solar)
    if "DateTime" in df.columns:
        df["DateTime"] = pd.to_datetime(df["DateTime"], errors="coerce")
        df = df.sort_values("DateTime")
    else:
        df["DateTime"] = pd.date_range("2024-01-01", periods=len(df), freq="h")

    df = df.dropna(subset=["DateTime"])
    # Shift timeline so the last row is exactly NOW, to fix old dates
    if not df.empty:
        last_dt = df["DateTime"].iloc[-1]
        now_dt = pd.Timestamp(datetime.now())
        time_diff = now_dt.floor('h') - last_dt
        df["DateTime"] = df["DateTime"] + time_diff

    df = df.reset_index(drop=True)

    numeric_columns = df.select_dtypes(include=[np.number]).columns
    for col in numeric_columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.ffill().bfill()
    return df


def _compute_temporal_features(ts: pd.Timestamp) -> Dict[str, float]:
    hour = ts.hour
    month = ts.month
    dow = ts.dayofweek
    return {
        "hour": float(hour),
        "day": float(ts.day),
        "month": float(month),
        "day_of_week": float(dow),
        "is_weekend": float(1 if dow >= 5 else 0),
        "hour_sin": math.sin(2 * math.pi * hour / 24),
        "hour_cos": math.cos(2 * math.pi * hour / 24),
        "month_sin": math.sin(2 * math.pi * month / 12),
        "month_cos": math.cos(2 * math.pi * month / 12),
    }


def _predict_next_rain(rain_history: List[float]) -> float:
    if not rain_history:
        return 0.0
    recent_1 = rain_history[-1]
    recent_6 = float(np.mean(rain_history[-6:])) if len(rain_history) >= 6 else recent_1
    recent_24 = float(np.mean(rain_history[-24:])) if len(rain_history) >= 24 else recent_6
    pred = 0.60 * recent_1 + 0.25 * recent_6 + 0.15 * recent_24
    return max(0.0, round(pred, 3))


def _build_feature_row(
    base_row: pd.Series,
    next_ts: pd.Timestamp,
    level_history: List[float],
    rain_history: List[float],
    live_hour: Optional[Dict[str, float]] = None,
) -> Dict[str, float]:
    row: Dict[str, float] = {}

    for key, value in base_row.items():
        if key == "DateTime":
            continue
        row[key] = _safe_float(value)

    temporal = _compute_temporal_features(next_ts)
    row.update(temporal)

    predicted_rain = _predict_next_rain(rain_history)
    row["Rain"] = live_hour.get("Rain", predicted_rain) if live_hour else predicted_rain

    if live_hour:
        row["Temperature"] = live_hour.get("Temperature", row.get("Temperature", 28.0))
        row["Humidity"] = live_hour.get("Humidity", row.get("Humidity", 55.0))
        row["Pressure"] = live_hour.get("Pressure", row.get("Pressure", 1008.0))
        row["Cloud_Cover"] = live_hour.get("Cloud_Cover", row.get("Cloud_Cover", 50.0))

    row["wl_lag_1h"] = level_history[-1]
    row["wl_lag_2h"] = level_history[-2] if len(level_history) >= 2 else level_history[-1]
    row["wl_lag_3h"] = level_history[-3] if len(level_history) >= 3 else row["wl_lag_2h"]
    row["wl_lag_24h"] = level_history[-24] if len(level_history) >= 24 else level_history[0]
    row["wl_lag_168h"] = level_history[-168] if len(level_history) >= 168 else level_history[0]

    row["wl_change_1h"] = row["wl_lag_1h"] - row["wl_lag_2h"]
    row["wl_change_3h"] = row["wl_lag_1h"] - row["wl_lag_3h"]

    rain_24 = rain_history[-24:] if len(rain_history) >= 24 else rain_history
    rain_72 = rain_history[-72:] if len(rain_history) >= 72 else rain_history
    row["rain_sum_24h"] = float(sum(rain_24))
    row["rain_sum_72h"] = float(sum(rain_72))

    pressure_now = row.get("Pressure", 0.0)
    pressure_3h = _safe_float(base_row.get("Pressure"), pressure_now)
    row["pressure_drop_3h"] = pressure_now - pressure_3h

    row["evap_proxy"] = (
        row.get("Temperature", 0.0) * (100.0 - row.get("Humidity", 0.0)) / 100.0
    )

    row["sudden_drop_event"] = 1.0 if (row["wl_change_1h"] <= -3.0 and row["Rain"] > 0.0) else 0.0
    row["sudden_rise_event"] = 1.0 if row["wl_change_1h"] >= 2.5 else 0.0
    row["overflow_risk"] = 1.0 if (row["wl_lag_1h"] > 80.0 and row["rain_sum_24h"] > 20.0) else 0.0
    row["drain_after_rain"] = 1.0 if (row["wl_change_1h"] < -1.0 and row["rain_sum_24h"] > 10.0) else 0.0

    row["rain_x_change1h"] = row["Rain"] * row["wl_change_1h"]
    row["rain24_x_change3h"] = row["rain_sum_24h"] * row["wl_change_3h"]

    return row


def _predict_level(feature_row: Dict[str, float], bundle: ModelBundle) -> float:
    xgb_pred = feature_row.get("wl_lag_1h", 0.0)
    huber_pred = feature_row.get("wl_lag_1h", 0.0)

    if bundle.xgb_model is not None:
        top_features = bundle.top20_features
        xgb_values = [feature_row.get(col, 0.0) for col in top_features]
        xgb_frame = pd.DataFrame([xgb_values], columns=top_features)
        xgb_pred = _safe_float(bundle.xgb_model.predict(xgb_frame)[0], xgb_pred)

    if bundle.huber_model is not None and bundle.scaler is not None:
        sorted_keys = sorted(feature_row.keys())
        huber_frame = pd.DataFrame([[feature_row[k] for k in sorted_keys]], columns=sorted_keys)
        try:
            scaled = bundle.scaler.transform(huber_frame)
            huber_pred = _safe_float(bundle.huber_model.predict(scaled)[0], huber_pred)
        except Exception:
            huber_pred = feature_row.get("wl_lag_1h", 0.0)

    naive_pred = feature_row.get("wl_lag_1h", 0.0)

    w_xgb = _safe_float(bundle.blend_weights.get("w_xgb"), 0.65)
    w_huber = _safe_float(bundle.blend_weights.get("w_huber"), 0.10)
    w_naive = _safe_float(bundle.blend_weights.get("w_naive"), 0.25)

    total_w = max(w_xgb + w_huber + w_naive, 1e-6)
    pred = (w_xgb * xgb_pred + w_huber * huber_pred + w_naive * naive_pred) / total_w
    return max(0.0, min(100.0, float(pred)))


def forecast(
    df: pd.DataFrame,
    bundle: ModelBundle,
    horizon: int,
    live_weather: Optional[Dict[str, Any]] = None,
) -> pd.DataFrame:
    last = df.iloc[-1]
    last_time = pd.Timestamp(last["DateTime"])

    level_history = [
        _safe_float(v)
        for v in df["Water_Level"].tail(max(200, horizon + 24)).tolist()
    ]
    rain_history = [_safe_float(v) for v in df["Rain"].tail(max(200, horizon + 72)).tolist()]

    rows = []
    current_row = last.copy()

    for step in range(1, horizon + 1):
        ts = last_time + timedelta(hours=step)
        live_hour = _get_live_hour(live_weather, ts)
        feature_row = _build_feature_row(current_row, ts, level_history, rain_history, live_hour=live_hour)
        level_pred = _predict_level(feature_row, bundle)

        level_history.append(level_pred)
        rain_history.append(feature_row.get("Rain", 0.0))

        row = {
            "DateTime": ts,
            "predicted_water_level": level_pred,
            "predicted_rain": feature_row.get("Rain", 0.0),
            "overflow_risk": feature_row.get("overflow_risk", 0.0),
            "drain_after_rain": feature_row.get("drain_after_rain", 0.0),
        }
        rows.append(row)

        current_row = pd.Series(feature_row)
        current_row["DateTime"] = ts
        current_row["Water_Level"] = level_pred

    return pd.DataFrame(rows)


def _pump_recommendation(pred_levels: List[float]) -> Dict[str, Any]:
    high_threshold = 75.0
    critical_threshold = 85.0
    target_level = 58.0
    per_pump_pct_per_hour = 3.5

    max_level = max(pred_levels) if pred_levels else 0.0
    first_high = next((i for i, v in enumerate(pred_levels) if v >= high_threshold), len(pred_levels) - 1)
    available_hours = max(1, first_high + 1)

    excess = max(0.0, max_level - target_level)
    per_pump_capacity = available_hours * per_pump_pct_per_hour
    pumps = int(math.ceil(excess / per_pump_capacity)) if per_pump_capacity > 0 else 0
    pumps = max(0, min(2, pumps))

    severity = "normal"
    if max_level >= critical_threshold:
        severity = "critical"
    elif max_level >= high_threshold:
        severity = "warning"

    return {
        "recommendedPumps": pumps,
        "maxAllowedPumps": 2,
        "severity": severity,
        "maxPredictedLevel": round(max_level, 2),
        "targetLevel": target_level,
        "hoursToHighThreshold": int(first_high + 1),
        "perPumpCapacityPctPerHour": per_pump_pct_per_hour,
    }


def _weekly_distribution(df: pd.DataFrame, live_weather: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    if live_weather and live_weather.get("ok"):
        daily_rows = live_weather.get("dailyRows", [])
        if daily_rows:
            today = pd.Timestamp(datetime.now()).normalize()
            start_day = today - pd.Timedelta(days=6)
            selected = [row for row in daily_rows if start_day <= row["date"] <= today]
            if len(selected) < 7:
                selected = daily_rows[-7:]
            if selected:
                return [
                    {
                        "day": row["date"].strftime("%a"),
                        "value": round(_safe_float(row["precipitation"]), 2),
                    }
                    for row in selected
                ]

    weekly = df.tail(24 * 7).copy()
    weekly["date"] = weekly["DateTime"].dt.strftime("%a")
    grouped = weekly.groupby("date", sort=False)["Rain"].sum().reset_index()
    if grouped.empty:
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        return [{"day": d, "value": 0.0} for d in days]

    return [
        {
            "day": str(row["date"]),
            "value": round(_safe_float(row["Rain"]), 2),
        }
        for _, row in grouped.iterrows()
    ]


def _environmental_series(df: pd.DataFrame) -> List[Dict[str, Any]]:
    sample = df.tail(24 * 30).copy()
    if len(sample) > 160:
        sample = sample.iloc[:: max(1, len(sample) // 160)]

    points = []
    for _, row in sample.iterrows():
        points.append(
            {
                "time": row["DateTime"].strftime("%d %b"),
                "rain": round(_safe_float(row.get("Rain")), 2),
                "groundwater": round(_safe_float(row.get("Water_Level")), 2),
            }
        )
    return points


def _saturation_grid(df: pd.DataFrame) -> List[Dict[str, Any]]:
    recent = df.tail(24 * 3)
    rain = _safe_float(recent["Rain"].mean(), 0.0)
    humidity = _safe_float(recent["Humidity"].mean(), 55.0)

    grid = []
    for x in range(1, 8):
        for y in range(1, 8):
            value = min(100.0, max(0.0, (rain * 3.8) + (humidity * 0.45) + x * 2 - y * 1.5))
            grid.append(
                {
                    "x": x,
                    "y": y,
                    "saturation": round(value, 1),
                }
            )
    return grid


def _regional_forecast(pred: pd.DataFrame, live_weather: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    if live_weather and live_weather.get("ok"):
        daily_rows = live_weather.get("dailyRows", [])
        if daily_rows:
            today = pd.Timestamp(datetime.now()).normalize()
            upcoming = [row for row in daily_rows if row["date"] > today]
            if len(upcoming) < 4:
                upcoming = daily_rows[-4:]
            if upcoming:
                return [
                    {
                        "day": row["date"].strftime("%a"),
                        "rainfall": round(_safe_float(row["precipitation"]), 2),
                    }
                    for row in upcoming[:4]
                ]

    if pred.empty:
        return []
    work = pred.copy()
    work["day"] = work["DateTime"].dt.strftime("%a")
    grouped = work.groupby("day", sort=False)["predicted_rain"].sum().reset_index()
    grouped = grouped.head(4)
    return [
        {
            "day": str(row["day"]),
            "rainfall": round(_safe_float(row["predicted_rain"]), 2),
        }
        for _, row in grouped.iterrows()
    ]


def _activity_log(df: pd.DataFrame) -> List[Dict[str, Any]]:
    recent = df.tail(72).copy()
    recent["delta"] = recent["Water_Level"].diff()

    logs = []
    for idx, (_, row) in enumerate(recent.iterrows()):
        delta = _safe_float(row.get("delta"))
        if abs(delta) < 0.05 and idx % 8 != 0:
            continue
        if abs(delta) < 0.35:
            status = "stable"
        else:
            status = "draining" if delta < 0 else "filling"
        logs.append(
            {
                "timestamp": row["DateTime"].strftime("%Y-%m-%d %H:%M"),
                "status": status,
                "change": round(delta, 2),
            }
        )

    if not logs:
        last = df.iloc[-1]
        logs.append(
            {
                "timestamp": pd.Timestamp(last["DateTime"]).strftime("%Y-%m-%d %H:%M"),
                "status": "stable",
                "change": 0.0,
            }
        )

    return logs[-8:][::-1]


def _build_alerts(
    current_level: float,
    pump: Dict[str, Any],
    forecast_df: pd.DataFrame,
    live_weather: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    alerts = []
    max_level = pump["maxPredictedLevel"]

    if pump["severity"] == "critical":
        alerts.append(
            {
                "level": "critical",
                "title": "Critical overflow risk",
                "message": f"Predicted peak level {max_level}% requires immediate draining.",
                "action": f"Activate {pump['recommendedPumps']} pumps now.",
            }
        )
    elif pump["severity"] == "warning":
        alerts.append(
            {
                "level": "warning",
                "title": "High level forecast",
                "message": f"Predicted peak level {max_level}% in next window.",
                "action": f"Prepare {pump['recommendedPumps']} pumps.",
            }
        )

    if current_level < 18:
        alerts.append(
            {
                "level": "warning",
                "title": "Low tank level",
                "message": "Water level is near empty threshold.",
                "action": "Delay draining and prioritize recharge monitoring.",
            }
        )

    rain_spike = _safe_float(forecast_df["predicted_rain"].max() if not forecast_df.empty else 0.0)
    if live_weather and live_weather.get("ok"):
        regional = _regional_forecast(forecast_df, live_weather)
        if regional:
            rain_spike = max(rain_spike, max(_safe_float(item.get("rainfall")) for item in regional))

    if rain_spike > 8:
        alerts.append(
            {
                "level": "info",
                "title": "Rain spike expected",
                "message": f"Forecast rainfall peak at {round(rain_spike, 2)} mm/h.",
                "action": "Keep inlets clear and monitor sensor quality.",
            }
        )

    if not alerts:
        alerts.append(
            {
                "level": "info",
                "title": "System normal",
                "message": "No overflow or emptying risk detected in current horizon.",
                "action": "Continue baseline monitoring.",
            }
        )

    return alerts


def build_snapshot(
    df: pd.DataFrame,
    pred: pd.DataFrame,
    live_weather: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    latest = df.iloc[-1]
    current_level = round(_safe_float(latest.get("Water_Level")), 2)

    predicted_levels = pred["predicted_water_level"].tolist() if not pred.empty else [current_level]
    pump = _pump_recommendation(predicted_levels)

    alerts = _build_alerts(current_level, pump, pred, live_weather)

    overview = {
        "liveTankLevel": current_level,
        "maxForecastLevel": pump["maxPredictedLevel"],
        "recommendedPumps": pump["recommendedPumps"],
        "capacityThreshold": 85,
        "weeklyDistribution": _weekly_distribution(df, live_weather),
        "forecastSeries": [
            {
                "time": row["DateTime"].strftime("%d %b %H:%M"),
                "level": round(_safe_float(row["predicted_water_level"]), 2),
            }
            for _, row in pred.iterrows()
        ],
    }

    environmental = {
        "precipitationVsGroundwater": _environmental_series(df),
        "saturationGrid": _saturation_grid(df),
        "regionalForecast": _regional_forecast(pred, live_weather),
    }

    operations = {
        "pumpRecommendation": pump,
        "pumpStatus": [
            {
                "name": "Pump 1",
                "state": "active" if pump["recommendedPumps"] >= 1 else "standby",
                "flowRateLps": 36,
                "loadPercent": 78 if pump["recommendedPumps"] >= 1 else 22,
            },
            {
                "name": "Pump 2",
                "state": "active" if pump["recommendedPumps"] >= 2 else "standby",
                "flowRateLps": 34,
                "loadPercent": 71 if pump["recommendedPumps"] >= 2 else 17,
            },
        ],
        "activityLog": _activity_log(df),
        "maintenance": [
            {
                "title": "Check rain sensor calibration",
                "window": "Next 72h",
                "priority": "medium",
            },
            {
                "title": "Inspect pump intake grills",
                "window": "Tomorrow 10:00",
                "priority": "high" if pump["severity"] != "normal" else "medium",
            },
        ],
    }

    logs = [
        {
            "time": datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "event": "Forecast snapshot generated",
            "status": "ok",
        }
    ]

    notifications = [
        {
            "level": item["level"],
            "title": item["title"],
            "message": item["message"],
            "action": item["action"],
        }
        for item in alerts
    ]

    return {
        "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "weatherSource": (live_weather or {}).get("source", "historical"),
        "location": (live_weather or {}).get(
            "location",
            {"latitude": LIVE_LAT, "longitude": LIVE_LON, "name": "Local dataset"},
        ),
        "overview": overview,
        "environmental": environmental,
        "operations": operations,
        "alerts": alerts,
        "notifications": notifications,
        "systemLogs": logs,
    }


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.isoformat()
    if isinstance(value, (np.integer, np.floating)):
        return float(value)
    if isinstance(value, np.ndarray):
        return value.tolist()
    raise TypeError(f"Type not serializable: {type(value)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--horizon", type=int, default=24)
    args = parser.parse_args()

    script = Path(__file__).resolve()
    project_root = script.parents[3]

    try:
        df = load_dataframe(project_root)
        live_weather = fetch_live_weather()
        bundle = load_bundle(project_root)
        pred = forecast(df, bundle, max(6, min(72, args.horizon)), live_weather=live_weather)
        snapshot = build_snapshot(df, pred, live_weather=live_weather)
        print(json.dumps(snapshot, default=_json_default))
    except Exception as error:
        payload = {
            "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "error": str(error),
            "overview": {
                "liveTankLevel": 0,
                "maxForecastLevel": 0,
                "recommendedPumps": 0,
                "capacityThreshold": 85,
                "weeklyDistribution": [],
                "forecastSeries": [],
            },
            "environmental": {
                "precipitationVsGroundwater": [],
                "saturationGrid": [],
                "regionalForecast": [],
            },
            "operations": {
                "pumpRecommendation": {
                    "recommendedPumps": 0,
                    "maxAllowedPumps": 2,
                    "severity": "normal",
                    "maxPredictedLevel": 0,
                    "targetLevel": 58,
                    "hoursToHighThreshold": 0,
                    "perPumpCapacityPctPerHour": 3.5,
                },
                "pumpStatus": [],
                "activityLog": [],
                "maintenance": [],
            },
            "alerts": [
                {
                    "level": "warning",
                    "title": "Forecast service degraded",
                    "message": "Fallback snapshot returned due to prediction error.",
                    "action": "Verify model artifacts and Python dependencies.",
                }
            ],
            "notifications": [],
            "systemLogs": [],
        }
        print(json.dumps(payload, default=_json_default))


if __name__ == "__main__":
    main()
