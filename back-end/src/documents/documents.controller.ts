import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RolesGuard, Roles, Role } from '../common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/document.dto';

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
  @Roles(Role.SUPERUSER, Role.FLEET_MANAGER)
  @ApiOperation({ summary: 'Create a document' })
  create(@Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto);
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