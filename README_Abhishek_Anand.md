# README - Abhishek Anand

## Project overview
This project forecasts groundwater / tank water levels using weather data, historical water-level records, and machine learning models. It also includes a web dashboard for monitoring, snapshots, and operational alerts.

## Data files
- Raw dataset file: `abhishek data.txt`
- Raw groundwater level data: `pool_groundwater_level.csv`
- Cleaned weather dataset: `weather_data.csv`
- Final cleaned training dataset: `preprocessed_water_level_data.csv`

## Python notebooks
- Preprocessing notebook: `water_level.ipynb`
- Model comparison and training notebook: `model_water_level.ipynb`

## Dashboard folder setup and run instructions
The website is inside the `dashboard/` folder.

### 1. Backend setup
Open a terminal in `dashboard/backend` and run:
```bash
npm install
npm start
```

If you want live reload during development, use:
```bash
npm run dev
```

Optional backend environment file:
- `dashboard/backend/.env`
  - `PORT=5000`
  - `MONGODB_URI=<optional>`
  - `PYTHON_CMD=<path to python executable>`

### 2. Frontend setup
Open a second terminal in `dashboard/frontend` and run:
```bash
npm install
npm run dev
```

Optional frontend environment file:
- `dashboard/frontend/.env`
  - `VITE_API_BASE_URL=http://localhost:5000/api`

### 3. Open the website
After both servers are running, open the Vite URL shown in the frontend terminal, usually:
- `http://localhost:5173`

## Major features of the project
- Data preprocessing for merging weather and groundwater signals into one model-ready dataset
- Time-based feature engineering such as lag features, rolling summaries, and seasonal indicators
- Multiple model comparison workflow in the training notebook
- Final cleaned dataset generation for repeatable training and evaluation
- Forecast snapshot generation through the backend Python bridge
- API endpoints for health checks, dashboard snapshots, weather, and water-level data
- Interactive web dashboard for overview, environment, operations, and alerts
- Pump recommendation logic with a hard cap on pump count
- Alerting for capacity, overflow risk, and operational monitoring
- Support for optional MongoDB persistence in the backend

## Quick workflow
1. Run `water_level.ipynb` to preprocess and regenerate `preprocessed_water_level_data.csv`.
2. Run `model_water_level.ipynb` to compare models and save trained artifacts.
3. Start the backend and frontend inside `dashboard/` to view the monitoring website.
