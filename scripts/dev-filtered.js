// scripts/dev-filtered.js
// Run Next.js dev server with filtered logging to reduce spam
const { spawn } = require('child_process');

const devProcess = spawn('next', ['dev'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

// Filter out successful GET requests to polling endpoints
const filterLine = (line) => {
  const str = line.toString();

  // Skip verbose GET request logs for polling endpoints
  if (
    str.includes('GET /api/indexer/status') ||
    str.includes('GET /api/indexer/logs')
  ) {
    return false; // Don't print this line
  }

  // Skip compilation messages for these endpoints
  if (
    str.includes('compile:') &&
    (str.includes('/api/indexer/status') || str.includes('/api/indexer/logs'))
  ) {
    return false;
  }

  return true; // Print everything else
};

devProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach((line) => {
    if (filterLine(line) && line.trim()) {
      process.stdout.write(line + '\n');
    }
  });
});

devProcess.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach((line) => {
    if (filterLine(line) && line.trim()) {
      process.stderr.write(line + '\n');
    }
  });
});

devProcess.on('close', (code) => {
  process.exit(code);
});

process.on('SIGINT', () => {
  devProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  devProcess.kill('SIGTERM');
});

