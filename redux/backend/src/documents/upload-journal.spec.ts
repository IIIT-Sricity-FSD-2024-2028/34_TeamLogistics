import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeStagedUpload,recoverUploads} from './upload-journal';

it('recovers interrupted uploads and retains files referenced by the committed document index', () => {
  const env = process.env;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'upload-recovery-'));
  process.env = {...env,DATA_DIR:path.join(dir,'data'),UPLOAD_DIR:path.join(dir,'uploads')};
  try {
    const first = writeStagedUpload(randomUUID()+'.png',Buffer.from('demo'));
    const second = writeStagedUpload(randomUUID()+'.png',Buffer.from('demo'));
    recoverUploads([{fileUrl:'/uploads/documents/'+path.basename(first)} as any]);
    expect(fs.existsSync(first)).toBe(true);
    expect(fs.existsSync(second)).toBe(false);
    recoverUploads([]);
    expect(fs.existsSync(first)).toBe(true);
  } finally {
    process.env = env;
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
