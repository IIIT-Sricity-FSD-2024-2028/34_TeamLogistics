import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDocumentUploadDirectory } from '../common/upload-path';
import type { Document } from '../data-store/data-store.service';

const generated = /^[a-f0-9-]{36}\.(pdf|png|jpg|jpeg|csv)$/i;
function journalDir() {
  return path.resolve(process.env.DATA_DIR || path.resolve(__dirname,'..','..','runtime-data'), '.staged-uploads');
}

export function writeStagedUpload(name: string, bytes: Buffer) {
  if (!generated.test(name)) throw new Error('Invalid generated upload name');
  const dir = getDocumentUploadDirectory();
  const markers = journalDir();
  fs.mkdirSync(markers,{recursive:true});
  fs.mkdirSync(dir,{recursive:true});
  const marker = path.join(markers,name);
  fs.writeFileSync(marker,'',{flag:'wx',mode:0o600});
  const target = path.join(dir,name);
  try {
    fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600});
    return target;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') fs.rmSync(target,{force:true});
    fs.rmSync(marker,{force:true});
    throw error;
  }
}

export function finishUpload(name: string, retained: boolean) {
  if (!generated.test(name)) throw new Error('Invalid staged upload name');
  if (!retained) fs.rmSync(path.join(getDocumentUploadDirectory(),name),{force:true});
  fs.rmSync(path.join(journalDir(),name),{force:true});
}

// Run after the JSON transaction journal has been replayed and before listening.
export function recoverUploads(documents: Document[]) {
  const markers = journalDir();
  if (!fs.existsSync(markers)) return;
  const retained = new Set(documents.map(doc => path.basename(doc.fileUrl || '')));
  for (const name of fs.readdirSync(markers)) {
    if (generated.test(name)) finishUpload(name,retained.has(name));
  }
}
