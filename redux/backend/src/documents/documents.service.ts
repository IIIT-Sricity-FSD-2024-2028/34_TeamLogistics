import { bindDocumentOwner } from '../data-store/ownership-migration';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID, createHash } from 'crypto';
import { getDocumentUploadDirectory } from '../common/upload-path';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';
import { assertFutureDateOnly } from '../common/date-validation';

import { DataStoreService } from '../data-store/data-store.service';
import { ownsFleetAssignment, ownsDriverAssignment } from '../common/fleet-ownership';

type Actor = { userId: string; role: string };
type DocumentRecord = import('../data-store/data-store.service').Document;

@Injectable()
export class DocumentsService {
  private readonly uploadDirectory = getDocumentUploadDirectory();
  constructor(private readonly store: DataStoreService) {}
  private get documents() { return this.store.documents; }
  isRetained(filename: string) { return this.documents.some(doc => doc.fileUrl?.endsWith('/' + filename)); }
  private save() { this.store.persistDocuments(); }

  private getStoredFilePath(document: DocumentRecord): string | null {
    if (!document.fileUrl) return null;
    return path.join(this.uploadDirectory, path.basename(document.fileUrl));
  }

  private hasStoredFile(document: DocumentRecord): boolean {
    const filePath = this.getStoredFilePath(document);
    if (!filePath) return false;
    try {
      return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
    } catch {
      return false;
    }
  }


  private canAccess(doc: Pick<DocumentRecord, 'ownerType' | 'driverId' | 'vehicleId' | 'delivery' | 'uploadedBy'>, actor: Actor) {
    if (actor.role === 'superuser') return true;
    if (doc.ownerType === 'business-client') return doc.uploadedBy === actor.userId;
    if (doc.ownerType === 'delivery') {
      const delivery = this.store.deliveryRequests.find((item) => item.id === doc.delivery);
      if (!delivery) return false;
      if (actor.role === 'business-client') return delivery.clientUserId === actor.userId;
      if (actor.role === 'fleet-manager') return ownsFleetAssignment(delivery, actor.userId);
      return actor.role === 'driver' && ownsDriverAssignment(delivery, actor.userId);
    }
    if (doc.ownerType === 'driver') {
      const driver = this.store.drivers.find(item => item.id === doc.driverId);
      return !!driver && (actor.role === 'driver' ? driver.id === actor.userId :
        actor.role === 'fleet-manager' && driver.fleetManagerId === actor.userId);
    }
    return doc.ownerType === 'vehicle' && actor.role === 'fleet-manager' && this.store.vehicles.some((item) =>
      item.id === doc.vehicleId && item.fleetManagerId === actor.userId);
  }

  findAll(search?: string, actor?: Actor) {
    let rows = this.documents.filter((doc) => (!actor || this.canAccess(doc, actor)) && this.hasStoredFile(doc));

    if (search) {
      const q = search.toLowerCase();

      rows = rows.filter((doc) =>
        [
          doc.id,
          doc.ownerType,
          doc.vehicle,
          doc.driver,
          doc.delivery,
          doc.documentType,
          doc.fileName,
          doc.issueDate,
          doc.expiryDate,
          doc.status,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }

    return rows;
  }

  findOne(id: string, actor?: Actor) {
    const doc = this.documents.find((d) => d.id === id);

    if (!doc || (actor && !this.canAccess(doc, actor))) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    if (!this.hasStoredFile(doc)) {
      throw new NotFoundException(`The uploaded file for document ${id} is no longer available`);
    }

    return doc;
  }

  getReceiptFile(url: string, ownerId?: string) {
    const document = this.documents.find((doc) => doc.fileUrl === url && doc.ownerType === 'business-client' &&
      doc.documentType === 'Payment Receipt' && ownerId && doc.uploadedBy === ownerId);
    if (!document || !this.hasStoredFile(document)) throw new NotFoundException('Receipt file unavailable');
    return { filePath: this.getStoredFilePath(document)!, document };
  }

  getFile(id: string, actor: Actor) {
    const document = this.findOne(id, actor);
    const filePath = this.getStoredFilePath(document);

    if (!filePath) throw new NotFoundException(`The uploaded file for document ${id} is no longer available`);

    return { document, filePath };
  }

  create(dto: CreateDocumentDto, file?: Express.Multer.File, requester?: { userId: string; role: string }) {
    if (!file) {
      throw new BadRequestException('A document file is required');
    }

    const bytes = fs.readFileSync(file.path);
    const extension = path.extname(file.originalname).toLowerCase();
    const valid = extension === '.png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) :
      ['.jpg', '.jpeg'].includes(extension) ? bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) :
      extension === '.pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' :
      extension === '.csv' && bytes.length > 0 && !bytes.includes(0) && !bytes.toString('utf8').includes('\uFFFD');
    if (!valid) throw new BadRequestException('File contents do not match the selected document format');
    if (['Issue Evidence','Payment Receipt'].includes(dto.documentType) && extension === '.csv')
      throw new BadRequestException('Upload a photo or PDF for evidence');
    if (dto.documentType === 'Proof of Delivery') {
      if (requester?.role !== 'driver' || extension === '.csv') throw new BadRequestException('Driver proof must be a photo or PDF');
      if (dto.ownerType !== 'delivery' || !String(dto.delivery || '').trim()) {
        throw new BadRequestException('Proof of Delivery must be linked to a delivery');
      }
    }

    if (dto.expiryDate) {
      assertFutureDateOnly(dto.expiryDate, 'Document expiry date');
    }

    const id = `DOC-${randomUUID()}`;

    const doc: DocumentRecord = {
      id,
      uploadedBy: requester?.userId,
      ownerType: dto.ownerType,
      vehicle: dto.vehicle,
      driver: dto.driver,
      delivery: dto.delivery,
      documentType: dto.documentType,
      issueDate: dto.issueDate || '',
      expiryDate: dto.expiryDate || '',
      status: requester?.role === 'superuser' ? dto.status || 'Submitted' : 'Submitted',
      fileName: file?.originalname,
      fileUrl: file ? `/uploads/documents/${file.filename}` : undefined,
    };

    bindDocumentOwner(doc, this.store, requester?.role === 'fleet-manager' ? requester.userId : undefined);
    if ((doc.ownerType === 'driver' && !doc.driverId) || (doc.ownerType === 'vehicle' && !doc.vehicleId))
      throw new NotFoundException('Select an identifiable document owner');
    if (requester && !this.canAccess(doc, requester)) throw new NotFoundException('Document owner not found');
    const fileHash = createHash('sha256').update(bytes).digest('hex');
    const previous = this.documents.find((d) => d.fileHash === fileHash && d.uploadedBy === doc.uploadedBy &&
      d.documentType === doc.documentType && d.ownerType === doc.ownerType && d.delivery === doc.delivery &&
      d.driver === doc.driver && d.vehicle === doc.vehicle && d.issueDate === doc.issueDate && d.expiryDate === doc.expiryDate && this.hasStoredFile(d));
    if (previous) { fs.rmSync(file.path, {force: true}); return previous; }
    doc.fileHash = fileHash;
    this.documents.push(doc);
    this.save();

    return doc;
  }

  update(id: string, dto: UpdateDocumentDto, actor: Actor) {
    const document = this.findOne(id, actor);
    this.assertEditable(document);
    if ((dto.ownerType && dto.ownerType !== document.ownerType) || (dto.driver && dto.driver !== document.driver) ||
        (dto.vehicle && dto.vehicle !== document.vehicle) || (dto.documentType && dto.documentType !== document.documentType))
      throw new BadRequestException('Upload a new document to change its type or owner');
    const index = this.documents.findIndex((d) => d.id === id);

    if (index === -1) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    if (dto.expiryDate) {
      assertFutureDateOnly(dto.expiryDate, 'Document expiry date');
    }

    this.documents[index] = {
      ...this.documents[index],
      ...Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
    };

    this.save();

    return this.documents[index];
  }

  acceptHandoffProof(id: string, deliveryId: string, driver: Actor) {
    const doc = this.findOne(id, driver);
    if (driver.role !== 'driver' || doc.uploadedBy !== driver.userId || doc.documentType !== 'Proof of Delivery' || doc.delivery !== deliveryId) {
      throw new BadRequestException('Proof does not match this handoff');
    }
    doc.status = 'Valid';
    this.save();
  }

  private assertEditable(doc: DocumentRecord) {
    if (doc.ownerType === 'registration' || ['Payment Receipt', 'Proof of Delivery', 'Issue Evidence'].includes(doc.documentType)) {
      throw new BadRequestException('Retained evidence cannot be changed or deleted');
    }
  }

  delete(id: string, actor: Actor) {
    this.assertEditable(this.findOne(id, actor));
    const index = this.documents.findIndex((d) => d.id === id);

    if (index === -1) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    const deleted = this.documents.splice(index, 1)[0];
    this.save();

    if (deleted.fileUrl) {
      const storedFilePath = path.join(this.uploadDirectory, path.basename(deleted.fileUrl));
      try {
        if (fs.existsSync(storedFilePath)) {
          fs.unlinkSync(storedFilePath);
        }
      } catch (error) {
        console.error(`Failed to delete uploaded file for ${id}:`, error);
      }
    }

    return {
      message: 'Document deleted successfully',
      deleted,
    };
  }
}
