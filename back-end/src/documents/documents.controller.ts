import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { diskStorage } from 'multer';
import { RolesGuard, Roles, Role } from '../common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'documents');
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

@ApiTags('Documents')
@Controller('documents')
@UseGuards(RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'List all documents' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('search') search?: string) {
    return this.documentsService.findAll(search);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.documentsService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Create a document, optionally uploading a file (PDF, PNG, JPG up to 5MB)' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          fs.mkdirSync(UPLOAD_DIR, { recursive: true });
          cb(null, UPLOAD_DIR);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase();
          const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
          cb(null, safeName);
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          cb(new BadRequestException('Only PDF, PNG, and JPG files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  create(@Body() dto: CreateDocumentDto, @UploadedFile() file?: Express.Multer.File) {
    return this.documentsService.create(dto, file);
  }

  @Put(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Update a document' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'id' })
  delete(@Param('id') id: string) {
    return this.documentsService.delete(id);
  }
}
