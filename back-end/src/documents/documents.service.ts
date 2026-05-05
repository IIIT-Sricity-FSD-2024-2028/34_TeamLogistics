import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';

type DocumentRecord = {
  id: string;
  ownerType: string;
  vehicle?: string;
  driver?: string;
  documentType: string;
  issueDate?: string;
  expiryDate?: string;
  status?: string;
};

@Injectable()
export class DocumentsService {
  private readonly filePath = path.join(process.cwd(), 'data', 'documents.json');
  private documents: DocumentRecord[] = [];

  constructor() {
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
  }

  private save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.documents, null, 2));
  }

  findAll(search?: string) {
    let rows = [...this.documents];

    if (search) {
      const q = search.toLowerCase();

      rows = rows.filter((doc) =>
        [
          doc.id,
          doc.ownerType,
          doc.vehicle,
          doc.driver,
          doc.documentType,
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

    return doc;
  }

  create(dto: CreateDocumentDto) {
    const nextNumber = this.documents.length + 1;
    const id = `DOC-${String(nextNumber).padStart(3, '0')}`;

    const doc: DocumentRecord = {
      id,
      ownerType: dto.ownerType,
      vehicle: dto.vehicle,
      driver: dto.driver,
      documentType: dto.documentType,
      issueDate: dto.issueDate || '',
      expiryDate: dto.expiryDate || '',
      status: dto.status || 'Valid',
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

    this.documents[index] = {
      ...this.documents[index],
      ...dto,
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

    return {
      message: 'Document deleted successfully',
      deleted,
    };
  }
}