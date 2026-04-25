const path = require('path');
const { spawn } = require('child_process');

const CACHE_TTL_MS = 60 * 1000;
let cache = {
  expiresAt: 0,
  data: null,
};

function extractJson(rawOutput) {
  const firstBrace = rawOutput.indexOf('{');
  const lastBrace = rawOutput.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Unable to parse JSON from Python output');
  }
  return rawOutput.slice(firstBrace, lastBrace + 1);
}

function runPythonSnapshot(horizon = 24) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, '..', '..', 'python', 'forecast_snapshot.py');
    const pythonCmd = process.env.PYTHON_CMD || 'python';

    const child = spawn(pythonCmd, [scriptPath, '--horizon', String(horizon)], {
      cwd: path.resolve(__dirname, '..', '..', '..'),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}. ${stderr.trim()}`));
        return;
      }

      try {
        const jsonText = extractJson(stdout.trim());
        const parsed = JSON.parse(jsonText);
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Could not parse forecast response: ${error.message}`));
      }
    });
  });
}

async function getSnapshot(options = {}) {
  const useCache = options.useCache !== false;
  const horizon = options.horizon || 24;

  if (useCache && cache.data && Date.now() < cache.expiresAt) {
    return cache.data;
  }

  const data = await runPythonSnapshot(horizon);
  cache = {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return data;
}

function clearSnapshotCache() {
  cache = {
    expiresAt: 0,
    data: null,
  };
}

module.exports = {
  getSnapshot,
  clearSnapshotCache,
};
