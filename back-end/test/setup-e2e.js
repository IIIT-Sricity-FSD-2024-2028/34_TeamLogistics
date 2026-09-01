const fs = require('fs');
const os = require('os');
const path = require('path');

const sourceDataDir = path.resolve(__dirname, '..', 'data');
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deliversync-e2e-'));

for (const file of fs.readdirSync(sourceDataDir)) {
  fs.copyFileSync(path.join(sourceDataDir, file), path.join(testDataDir, file));
}

process.env.DATA_DIR = testDataDir;
