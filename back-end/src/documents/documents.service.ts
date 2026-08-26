import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import {
  CreateDocumentDto,
  UpdateDocumentDto,
} from './dto/document.dto';

export type DocumentRecord = {
  id: string;

  ownerType: string;

  vehicle?: string;
  driver?: string;

  documentType: string;

  issueDate?: string;
  expiryDate?: string;

  status?: string;

  // Uploaded file information
  fileName?: string;
  originalFileName?: string;
  filePath?: string;
  mimeType?: string;
  fileSize?: number;
};

@Injectable()
export class DocumentsService {
  private readonly filePath = path.join(
    process.cwd(),
    'data',
    'documents.json',
  );

  private readonly uploadDirectory = path.join(
    process.cwd(),
    'uploads',
    'documents',
  );

  private documents: DocumentRecord[] = [];

  constructor() {
    this.ensureDirectories();
    this.load();
  }

  private ensureDirectories(): void {
    const dataDirectory = path.dirname(
      this.filePath,
    );

    if (!fs.existsSync(dataDirectory)) {
      fs.mkdirSync(dataDirectory, {
        recursive: true,
      });
    }

    if (!fs.existsSync(this.uploadDirectory)) {
      fs.mkdirSync(this.uploadDirectory, {
        recursive: true,
      });
    }
  }

  private load(): void {
    this.ensureDirectories();

    if (!fs.existsSync(this.filePath)) {
      this.documents = [];
      this.save();
      return;
    }

    try {
      const raw =
        fs.readFileSync(
          this.filePath,
          'utf-8',
        );

      this.documents =
        raw.trim()
          ? JSON.parse(raw)
          : [];

      if (!Array.isArray(this.documents)) {
        this.documents = [];
      }
    } catch (error) {
      console.error(
        'Failed to load documents.json:',
        error,
      );

      this.documents = [];
    }
  }

  private save(): void {
    this.ensureDirectories();

    fs.writeFileSync(
      this.filePath,
      JSON.stringify(
        this.documents,
        null,
        2,
      ),
      'utf-8',
    );
  }

  private generateId(): string {
    let nextNumber =
      this.documents.length + 1;

    let id =
      `DOC-${String(nextNumber).padStart(3, '0')}`;

    while (
      this.documents.some(
        (document) =>
          document.id === id,
      )
    ) {
      nextNumber++;

      id =
        `DOC-${String(nextNumber).padStart(
          3,
          '0',
        )}`;
    }

    return id;
  }

  findAll(search?: string) {
    let rows = [...this.documents];

    if (search) {
      const q =
        search
          .trim()
          .toLowerCase();

      rows = rows.filter(
        (doc) =>
          [
            doc.id,
            doc.ownerType,
            doc.vehicle,
            doc.driver,
            doc.documentType,
            doc.issueDate,
            doc.expiryDate,
            doc.status,
            doc.fileName,
            doc.originalFileName,
            doc.mimeType,
          ]
            .filter(
              (value) =>
                value !== undefined &&
                value !== null,
            )
            .join(' ')
            .toLowerCase()
            .includes(q),
      );
    }

    return rows;
  }

  findOne(id: string) {
    const doc =
      this.documents.find(
        (document) =>
          document.id === id,
      );

    if (!doc) {
      throw new NotFoundException(
        `Document ${id} not found`,
      );
    }

    return doc;
  }

  create(dto: CreateDocumentDto) {
    const doc: DocumentRecord = {
      id: this.generateId(),

      ownerType: dto.ownerType,

      vehicle: dto.vehicle,
      driver: dto.driver,

      documentType:
        dto.documentType,

      issueDate:
        dto.issueDate || '',

      expiryDate:
        dto.expiryDate || '',

      status:
        dto.status || 'Valid',
    };

    this.documents.push(doc);

    this.save();

    return doc;
  }

  /**
   * Creates a document record for an uploaded file.
   */
  createFromUpload(
    file: Express.Multer.File,
    ownerType: string,
    documentType = 'Uploaded Document',
  ) {
    const today =
      new Date()
        .toISOString()
        .split('T')[0];

    const doc: DocumentRecord = {
      id: this.generateId(),

      ownerType,

      documentType,

      issueDate: today,

      expiryDate: '',

      status: 'Uploaded',

      fileName:
        file.filename,

      originalFileName:
        file.originalname,

      filePath:
        file.path,

      mimeType:
        file.mimetype,

      fileSize:
        file.size,
    };

    this.documents.push(doc);

    this.save();

    return doc;
  }

  update(
    id: string,
    dto: UpdateDocumentDto,
  ) {
    const index =
      this.documents.findIndex(
        (document) =>
          document.id === id,
      );

    if (index === -1) {
      throw new NotFoundException(
        `Document ${id} not found`,
      );
    }

    this.documents[index] = {
      ...this.documents[index],
      ...dto,
    };

    this.save();

    return this.documents[index];
  }

  delete(id: string) {
    const index =
      this.documents.findIndex(
        (document) =>
          document.id === id,
      );

    if (index === -1) {
      throw new NotFoundException(
        `Document ${id} not found`,
      );
    }

    const deleted =
      this.documents.splice(
        index,
        1,
      )[0];

    /*
     * Also delete the physical uploaded file
     * when this document came from an upload.
     */
    if (deleted.filePath) {
      try {
        if (
          fs.existsSync(
            deleted.filePath,
          )
        ) {
          fs.unlinkSync(
            deleted.filePath,
          );
        }
      } catch (error) {
        console.error(
          `Failed to delete uploaded file for ${id}:`,
          error,
        );
      }
    }

    this.save();

    return {
      message:
        'Document deleted successfully',

      deleted,
    };
  }
}