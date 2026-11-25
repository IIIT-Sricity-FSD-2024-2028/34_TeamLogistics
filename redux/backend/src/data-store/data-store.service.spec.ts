import { randomBytes } from 'node:crypto';
import { acquireWriterLock } from './writer-lock';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataStoreService } from './data-store.service';

describe('Persistent data store', () => {
  it('keeps the committed file and restores memory when replacing a file fails', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deliversync-persistence-'));
    const original = process.env.DATA_DIR;
    process.env.DATA_DIR = directory;
    let rename: jest.SpyInstance | undefined;
    try {
      const store = new DataStoreService();
      store.notifications = [];
      store.persistNotifications();
      const committed = fs.readFileSync(path.join(directory, 'notifications.json'), 'utf8');
      const changed = jest.fn();
      store.changes.subscribe(changed);
      store.notifications.push({ id: 'unsaved' } as any);
      rename = jest.spyOn(require('fs'), 'renameSync').mockImplementation(() => {
        throw new Error('Disk unavailable');
      });
      expect(() => store.persistNotifications()).toThrow('Unable to save changes');
      expect(store.notifications).toEqual([]);
      expect(fs.readFileSync(path.join(directory, 'notifications.json'), 'utf8')).toBe(committed);
      expect(changed).not.toHaveBeenCalled();
    } finally {
      rename?.mockRestore();
      if (original === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = original;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('replays a committed multi-file update after an interruption', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deliversync-recovery-'));
    const original = process.env.DATA_DIR;
    process.env.DATA_DIR = directory;
    try {
      fs.writeFileSync(path.join(directory, '.pending-commit.json'), JSON.stringify([
        ['trips.json', JSON.stringify([{ id: 'T', status: 'Completed' }])],
        ['invoices.json', JSON.stringify([{ id: 'I', deliveryId: 'D' }])],
      ]));
      const restarted = new DataStoreService();
      expect(restarted.trips[0].status).toBe('Completed');
      expect(restarted.invoices[0].id).toBe('I');
      expect(fs.existsSync(path.join(directory, '.pending-commit.json'))).toBe(false);
    } finally {
      if (original === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = original;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('loads mechanics persisted by a previous datastore instance', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'deliversync-mechanics-'));
    const original = process.env.DATA_DIR;
    process.env.DATA_DIR = directory;
    try {
      const first = new DataStoreService();
      first.mechanics.push({ id: 'MC-001', name: 'Persistent Workshop', active: true });
      first.persistMechanics();

      const restarted = new DataStoreService();
      expect(restarted.mechanics).toEqual([
        { id: 'MC-001', name: 'Persistent Workshop', active: true },
      ]);
    } finally {
      if (original === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = original;
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

it('restores an encrypted JSON backup in a separate single-writer directory', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'dispatch-restore-'));
  const env = process.env;
  const source = path.join(temp,'original');
  const copy = path.join(temp,'copy');
  let release: (() => void) | undefined;
  try {
    process.env = {...env,DATA_DIR:source,DATA_ENCRYPTION_KEY:randomBytes(32).toString('hex')};
    release = acquireWriterLock(source);
    expect(() => acquireWriterLock(source)).toThrow('writer lock');
    const first = new DataStoreService();
    first.atomic(() => {
      first.notifications.push({id:'recovered-event'} as any);
      first.persistNotifications();
    });
    expect(fs.readFileSync(path.join(source,'notifications.json'),'utf8')).not.toContain('recovered-event');
    release();
    fs.cpSync(source,copy,{recursive:true});
    process.env.DATA_DIR = copy;
    release = acquireWriterLock(copy);
    const restored = new DataStoreService();
    expect(restored.notifications.some(item => item.id === 'recovered-event')).toBe(true);
  } finally {
    release?.();
    process.env = env;
    fs.rmSync(temp,{recursive:true,force:true});
  }
});
