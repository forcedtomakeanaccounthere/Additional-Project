const fs = require('fs');
const path = require('path');
const { getLatestWeather } = require('./weatherService');

const CSV_FILE = path.join(__dirname, '..', '..', 'data', 'actual_water_level.csv');
const TANK_LEVELS_CSV_FILE = path.join(__dirname, '..', '..', 'data', 'tank_levels.csv');
const HALF_HOUR_MS = 30 * 60 * 1000;

// Tank params
const MAX_VOL_GAL = 1077; // 12ft * 12 sq ft * 7.48 gal/cu ft
let currentGal = 500; // Start around 50%
let serialNo = 1;

function simulateStep() {
    const weather = getLatestWeather();
    let rainInches = 0;
    if (weather && weather.davis_current_observation) {
        rainInches = parseFloat(weather.davis_current_observation.rain_rate_in_per_hr) || 0;
    }

    // 30-minute step
    // Rain addition: 1 inch over 12 sq ft = 1 cubic ft = 7.48 gallons
    // Per hour, rain adds: rainInches * 7.48 gallons
    // In 30 mins: (rainInches * 7.48) / 2
    let addedGal = (rainInches * 7.48) / 2;

    // Base evaporation / usage for 30 minutes
    let lossGal = 3;
    
    // Add noise
    currentGal += addedGal - lossGal + (Math.random() * 2 - 1); 

    // Handle pumps if level is too high
    let levelPercent = (currentGal / MAX_VOL_GAL) * 100;
    
    // Pump logic: 2 pumps max, each 35 LPM = 9.2 GPM. 
    // In 5 mins, 1 pump removes 9.2 * 5 = 46 gallons.
    if (levelPercent > 85) {
      // Turn on 2 pumps
      currentGal -= (46 * 2);
    } else if (levelPercent > 75) {
      // Turn on 1 pump
      currentGal -= 46;
    }

    currentGal = Math.max(0, Math.min(MAX_VOL_GAL, currentGal));
    levelPercent = Math.round((currentGal / MAX_VOL_GAL) * 100);

    const d = new Date();
    const dateStr = d.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const timeStr = d.toTimeString().split(' ')[0]; // HH:MM:SS

    const row = `${serialNo},${dateStr},${timeStr},IIIT Pond,${levelPercent}`;
    
    const dir = path.dirname(CSV_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(CSV_FILE)) {
      fs.writeFileSync(CSV_FILE, 'Serial No.,Date,Time,Device Name,tankpercent\n');
    }
    fs.appendFileSync(CSV_FILE, row + '\n');

    appendTankLevelsRow({ serialNo, dateStr, timeStr, levelPercent, timestamp: d });
    serialNo++;
}

function appendTankLevelsRow({ serialNo, dateStr, timeStr, levelPercent, timestamp }) {
    const totalLiters = 4077.85;
    const volumeLiters = Number(((levelPercent / 100) * totalLiters).toFixed(2));
    const volumeGallons = Number((volumeLiters * 0.264172).toFixed(2));
    const pumpCount = levelPercent > 85 ? 2 : levelPercent > 75 ? 1 : 0;
    const pumpRateLpm = Number((24.8 + (Math.random() * 0.6 - 0.3)).toFixed(2));

    if (!fs.existsSync(TANK_LEVELS_CSV_FILE)) {
      fs.writeFileSync(
        TANK_LEVELS_CSV_FILE,
        'serial_no,date,time,device_name,tankpercent,timestamp,volume_liters,volume_gallons,pump_count,pump_rate_lpm\n',
      );
    }

    const row = [
      serialNo,
      dateStr,
      timeStr,
      'IIIT Pond',
      levelPercent,
      timestamp.toISOString(),
      volumeLiters,
      volumeGallons,
      pumpCount,
      pumpRateLpm,
    ].join(',');

    fs.appendFileSync(TANK_LEVELS_CSV_FILE, `${row}\n`);
}

function getWaterLevelHistory() {
    if (!fs.existsSync(CSV_FILE)) return "Serial No.,Date,Time,Device Name,tankpercent\n";
    return fs.readFileSync(CSV_FILE, 'utf-8');
}

function startSimulation() {
    // try to resume serialNo from file
    if (fs.existsSync(CSV_FILE)) {
        const lines = fs.readFileSync(CSV_FILE, 'utf-8').trim().split('\n');
        if (lines.length > 1) {
            const lastLine = lines[lines.length - 1];
            const lastSerial = parseInt(lastLine.split(',')[0], 10);
            if (!isNaN(lastSerial)) serialNo = lastSerial + 1;
        }
    }

    simulateStep(); // run once immediately
    setInterval(simulateStep, HALF_HOUR_MS);
}

module.exports = { startSimulation, getWaterLevelHistory };
