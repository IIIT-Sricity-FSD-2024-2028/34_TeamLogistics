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
