const path = require('path');
const fs = require('fs');
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

function looksLikePath(command) {
  return command.includes('/') || command.includes('\\') || command.toLowerCase().endsWith('.exe');
}

function buildPythonCandidates() {
  const configured = (process.env.PYTHON_CMD || '').trim();
  const candidates = [];

  if (configured) {
    if (!looksLikePath(configured) || fs.existsSync(configured)) {
      candidates.push({ command: configured, prefixArgs: [] });
    }
  }

  if (process.platform === 'win32') {
    candidates.push({ command: 'py', prefixArgs: ['-3'] });
    candidates.push({ command: 'python', prefixArgs: [] });
  } else {
    candidates.push({ command: 'python3', prefixArgs: [] });
    candidates.push({ command: 'python', prefixArgs: [] });
  }

  return candidates;
}

function runPythonSnapshot(horizon = 24) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, '..', '..', 'python', 'forecast_snapshot.py');
    const candidates = buildPythonCandidates();
    const cwd = path.resolve(__dirname, '..', '..', '..');

    const tryCandidate = (index, startupErrors = []) => {
      if (index >= candidates.length) {
        const details = startupErrors.join(' | ') || 'No python command available';
        reject(new Error(`Failed to start Python process: ${details}`));
        return;
      }

      const candidate = candidates[index];
      const args = [...candidate.prefixArgs, scriptPath, '--horizon', String(horizon)];
      const child = spawn(candidate.command, args, {
        cwd,
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let startupFailed = false;

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        startupFailed = true;
        const label = `${candidate.command}${candidate.prefixArgs.length ? ` ${candidate.prefixArgs.join(' ')}` : ''}`;
        tryCandidate(index + 1, [...startupErrors, `${label}: ${error.message}`]);
      });

      child.on('close', (code) => {
        if (startupFailed) {
          return;
        }

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
    };

    tryCandidate(0);
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
