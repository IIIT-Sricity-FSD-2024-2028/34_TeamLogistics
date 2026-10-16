import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { getDocumentUploadDirectory } from '../common/upload-path';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';
import { assertFutureDateOnly } from '../common/date-validation';

type DocumentRecord = {
  id: string;
  ownerType: string;
  vehicle?: string;
  driver?: string;
  delivery?: string;
  documentType: string;
  issueDate?: string;
  expiryDate?: string;
  status?: string;
  fileName?: string;
  fileUrl?: string;
};

@Injectable()
export class DocumentsService {
  private readonly filePath: string;
  private readonly uploadDirectory = getDocumentUploadDirectory();
  private documents: DocumentRecord[] = [];

  constructor() {
    const dataDirectory = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), 'data');
    this.filePath = path.join(dataDirectory, 'documents.json');
    this.load();
  }

  private load() {
    if (!fs.existsSync(this.filePath)) {
      this.documents = [];
      this.save();
      return;
    }

    const raw = fs.readFileSync(this.filePath, 'utf-8');
    this.documents = raw ? JSON.parse(raw) : [];
    this.pruneMissingFiles();
  }

  private save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.documents, null, 2));
  }

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

  private pruneMissingFiles(): void {
    const availableDocuments = this.documents.filter((document) => this.hasStoredFile(document));
    if (availableDocuments.length === this.documents.length) return;

    const removedCount = this.documents.length - availableDocuments.length;
    this.documents = availableDocuments;
    this.save();
    console.warn(`Removed ${removedCount} document record(s) without an uploaded file.`);
  }

  findAll(search?: string) {
    this.pruneMissingFiles();
    let rows = [...this.documents];

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

  findOne(id: string) {
    const doc = this.documents.find((d) => d.id === id);

    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }

    if (!this.hasStoredFile(doc)) {
      this.documents = this.documents.filter((document) => document.id !== id);
      this.save();
      throw new NotFoundException(`The uploaded file for document ${id} is no longer available`);
    }

    return doc;
  }

  getFile(id: string) {
    const document = this.findOne(id);
    const filePath = this.getStoredFilePath(document);

    if (!filePath) throw new NotFoundException(`The uploaded file for document ${id} is no longer available`);

    return { document, filePath };
  }

  create(dto: CreateDocumentDto, file?: Express.Multer.File, requester?: { userId: string; role: string }) {
    if (!file) {
      throw new BadRequestException('A document file is required');
    }

    if (dto.documentType === 'Proof of Delivery') {
      if (dto.ownerType !== 'delivery' || !String(dto.delivery || '').trim()) {
        throw new BadRequestException('Proof of Delivery must be linked to a delivery');
      }
    }

    if (dto.expiryDate) {
      assertFutureDateOnly(dto.expiryDate, 'Document expiry date');
    }

    const nums = this.documents
      .map((d) => {
        const match = String(d.id || '').match(/(\d+)/);
        return match ? Number(match[1]) : 0;
      })
      .filter(Boolean);
    const nextNumber = (nums.length ? Math.max(...nums) : 0) + 1;
    const id = `DOC-${String(nextNumber).padStart(3, '0')}`;

    const doc: DocumentRecord = {
      id,
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

    this.documents.push(doc);
    this.save();

    return doc;
  }

  update(id: string, dto: UpdateDocumentDto) {
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

  delete(id: string) {
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
