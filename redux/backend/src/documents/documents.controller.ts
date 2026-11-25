import { finishUpload } from './upload-journal';
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
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import * as path from 'path';
import { RolesGuard, Roles, Role } from '../common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';

import { DocumentUpload, stageDocument } from './document-upload';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'List all documents' })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Req() req: Request, @Query('search') search?: string) {
    return this.documentsService.findAll(search, (req as any).user);
  }

  @Get(':id/file')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.BUSINESS_CLIENT, Role.DRIVER)
  @ApiOperation({ summary: 'Fetch the uploaded file for a document' })
  @ApiParam({ name: 'id' })
  getFile(@Param('id') id: string, @Req() req: Request, @Res() response: Response) {
    const { document, filePath } = this.documentsService.getFile(id, (req as any).user);
    response.setHeader('Cache-Control', 'private, no-store');
    const fileName = document.fileName || path.basename(filePath);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    return response.sendFile(filePath);
  }

  @Get(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    return this.documentsService.findOne(id, (req as any).user);
  }

  @Post()
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER, Role.DRIVER, Role.BUSINESS_CLIENT)
  @ApiOperation({ summary: 'Create a document with a required PDF, CSV, PNG, or JPG file up to 5MB' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    DocumentUpload,
  )
  async create(@Body() dto: CreateDocumentDto, @Req() req: Request, @UploadedFile() file?: Express.Multer.File) {
    if (file) await stageDocument(file);
    try {
      const result = this.documentsService.create(dto, file, (req as any).user);
      if (file) finishUpload(file.filename, result.fileUrl?.endsWith('/' + file.filename) === true);
      return result;
    } catch (error) {
      if (file && !this.documentsService.isRetained(file.filename)) finishUpload(file.filename, false);
      throw error;
    }
  }

  @Put(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Update a document' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @Req() req: Request) {
    return this.documentsService.update(id, dto, (req as any).user);
  }

  @Delete(':id')
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'id' })
  delete(@Param('id') id: string, @Req() req: Request) {
    return this.documentsService.delete(id, (req as any).user);
  }
}
