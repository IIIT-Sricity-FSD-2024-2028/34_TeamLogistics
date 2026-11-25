const fs = require('fs');
const os = require('os');
const path = require('path');
const seed = require('../demo/seed.cjs');
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deliversync-e2e-'));
seed(testDataDir);

process.env.DATA_DIR = testDataDir;
process.env.UPLOAD_DIR = path.join(testDataDir, 'uploads');
