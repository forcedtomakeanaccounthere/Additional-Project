# Groundwater Level Forecasting for Pump Control

## Project goal
Forecast pond/groundwater level using weather + autoregressive signals so pump operation can be planned early and overflow risk can be reduced.

## Current pipeline
1. Data preparation notebook: water_level.ipynb
2. Model training notebook: model_water_level.ipynb
3. Final training dataset: preprocessed_water_level_data.csv

## Core data files
- abhishek data.txt: raw weather station export
- weather_data.csv: cleaned weather table
- pool_groundwater_level.csv: raw pond/tank level records
- preprocessed_water_level_data.csv: merged + engineered hourly model data

## Feature strategy (current)
The model uses three groups:

1. Autoregressive features
- wl_lag_1h, wl_lag_6h, wl_lag_24h
- wl_change_1h, wl_change_6h, wl_change_24h

2. Weather and temporal features
- Temp_Out, Out_Hum, Dew_Pt, Bar, Rain, Rain_Rate, Solar_Rad, Wind_Speed, etc.
- rain_sum_24h, rain_sum_72h
- temp_avg_24h, hum_avg_24h
- bar_change_3h, bar_change_24h
- hour_sin/hour_cos, month_sin/month_cos, is_daytime

3. Operational regime indicators
- wl_drop_event_1h, wl_rise_event_1h
- drain_after_rain_flag
- pump_cycle_recent_6h
- rain_x_humidity, rain_x_wl_lag1

Important: lag/change features are shifted to past timestamps, so this is autoregression, not leakage.

## What was fixed in v4
Recent regression happened after adding aggressive event sample weighting. That hurt global fit.

v4 changes:
- Removed training sample weighting from all models
- Kept event masks for diagnostics only (EVENT_RMSE, EVENT_MAE)
- Added robust baseline: Huber Regressor
- Tuned Ridge (alpha=0.1), Random Forest, and XGBoost
- Added simple blend model:
  - y_hat = 0.7 * XGBoost + 0.2 * Huber + 0.1 * Ridge
- Removed temporary experiment cells and bloat

## v5 refinement (time-series CV + hybrid optimization)
Added a deeper optimization cycle focused on robust generalization:
- TimeSeriesSplit cross-validation on the training window
- GridSearchCV tuning for Ridge and XGBoost
- CV sweep for Huber parameters (epsilon, alpha)
- OOF blend-weight search for hybrid ensemble

Final hybrid from v5:
- y_hat = 0.00 * Ridge + 0.15 * Huber + 0.85 * XGBoost

## v6 final round (deep scrutiny, anti-overfit)
One final strict improvement cycle was run with explicit anti-overfitting guardrails:
- Constrained OOF stacking (weights >= 0 and sum to 1)
- Feature-pruned XGBoost CV (top-20 most informative features only)
- Final local blend search around the top model

Final v6 best blend:
- y_hat = 0.84 * XGBoost(top-20 features) + 0.16 * Naive persistence + 0.00 * Huber

## Latest validated results (80/20 chronological split)
Best model:
- Blend around top20 XGB (xgb=0.84, huber=0.00, naive=0.16)
- MAE = 0.661
- RMSE = 1.689
- R2 = 0.660
- MAPE = 1.140%

Second best:
- XGBoost CV tuned (top-20 features)
- MAE = 0.672
- RMSE = 1.707
- R2 = 0.653
- MAPE = 1.156%

Compared to degraded run after prior patch:
- R2: 0.514 -> 0.660
- RMSE: 2.025 -> 1.689
- MAE: 1.200 -> 0.661
- MAPE: 2.146% -> 1.140%

## Multi-horizon snapshot (v4)
With direct horizon-wise models (24h to 120h), errors are much more stable than previous extremely negative runs:
- 24h: RMSE about 3.004, R2 about -0.070
- 48h: RMSE about 3.124, R2 about -0.152
- 72h: RMSE about 3.031, R2 about -0.080
- 96h: RMSE about 3.115, R2 about -0.135
- 120h: RMSE about 3.013, R2 about -0.058

## How to run
1. Run water_level.ipynb fully (top to bottom) to regenerate preprocessed_water_level_data.csv
2. Run model_water_level.ipynb fully (top to bottom) to train/evaluate models and save artifacts

## Saved model artifacts
- best_model_rf.pkl
- best_model_xgb_cv.pkl
- best_model_xgb_cv_top20.pkl
- best_model_ridge_cv.pkl
- best_model_huber_cv.pkl
- hybrid_scaler.pkl
- best_hybrid_meta.pkl
- multi_horizon_models.pkl
- lstm_water_level.keras (if TensorFlow available)

## Notes
- TensorFlow should be imported before numpy/sklearn on this Windows machine to avoid DLL load-order issues.
- Multi-horizon scores naturally degrade as horizon increases.

## Monitoring dashboard (new)
A full web dashboard is now available in `dashboard/` with:

- Frontend: React + Vite + Recharts
- Backend: Express API + optional MongoDB persistence
- Prediction bridge: Python service that reads notebook-trained artifacts and generates live forecast snapshots

### Folder structure
- dashboard/frontend: UI app (overview/environment/operations/alerts)
- dashboard/backend: API + Python integration
- dashboard/backend/python/forecast_snapshot.py: forecast + alert + pump recommendation logic (max 2 pumps)

### Backend API endpoints
- GET /api/health
- GET /api/dashboard/snapshot?horizon=24
- POST /api/dashboard/refresh

### Environment files
- `dashboard/backend/.env`
  - PORT=5000
  - MONGODB_URI=<optional>
  - PYTHON_CMD=<path to python executable>
- `dashboard/frontend/.env`
  - VITE_API_BASE_URL=http://localhost:5000/api

### Run the dashboard
1. Start backend:
   - `cd dashboard/backend`
   - `npm install`
   - `npm run start`
2. Start frontend in another terminal:
   - `cd dashboard/frontend`
   - `npm install`
   - `npm run dev`

### What the dashboard shows
- Live and forecasted water level profile
- Capacity/overflow alerts and operator notifications
- Pump recommendation with hard cap at 2 pumps
- Environmental trends: rainfall, groundwater response, saturation matrix
- Operations view: pump status, activity log, maintenance items
