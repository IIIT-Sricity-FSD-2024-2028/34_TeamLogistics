import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseFilePipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  MaxFileSizeValidator,
} from '@nestjs/common';

import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import {
  Role,
  Roles,
  RolesGuard,
} from '../common';

import { DocumentsService } from './documents.service';

import {
  CreateDocumentDto,
  UpdateDocumentDto,
} from './dto/document.dto';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(RolesGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
  ) {}

  // =========================================================
  // GET ALL DOCUMENTS
  // =========================================================

  @Get()
  @Roles(
    Role.SUPERUSER,
    Role.FLEET_MANAGER,
  )
  @ApiOperation({
    summary: 'List all documents',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Search documents by ID, owner, vehicle, driver, type, dates, status or file name',
  })
  findAll(
    @Query('search')
    search?: string,
  ) {
    return this.documentsService.findAll(
      search,
    );
  }

  // =========================================================
  // GET DOCUMENT BY ID
  // =========================================================

  @Get(':id')
  @Roles(
    Role.SUPERUSER,
    Role.FLEET_MANAGER,
  )
  @ApiOperation({
    summary: 'Get document by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Document ID',
  })
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.documentsService.findOne(
      id,
    );
  }

  // =========================================================
  // CREATE DOCUMENT METADATA
  // =========================================================

  @Post()
  @Roles(
    Role.SUPERUSER,
    Role.FLEET_MANAGER,
  )
  @ApiOperation({
    summary: 'Create a document record',
  })
  create(
    @Body()
    dto: CreateDocumentDto,
  ) {
    return this.documentsService.create(
      dto,
    );
  }

  // =========================================================
  // UPLOAD DOCUMENT FILE
  // =========================================================

  @Post('upload')
  @Roles(
    Role.SUPERUSER,
    Role.FLEET_MANAGER,
  )
  @ApiOperation({
    summary:
      'Upload a document file and save its metadata',
    description:
      'Accepts PDF, JPG/JPEG and PNG files up to 5 MB. ' +
      'The uploaded file is stored in uploads/documents ' +
      'and a document record is saved in documents.json.',
  })
  @ApiConsumes(
    'multipart/form-data',
  )
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'PDF, JPG/JPEG or PNG file (maximum 5 MB)',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination:
          './uploads/documents',

        filename: (
          req,
          file,
          callback,
        ) => {
          const extension =
            extname(
              file.originalname,
            ).toLowerCase();

          const uniqueName =
            `${Date.now()}-${Math.round(
              Math.random() * 1_000_000_000,
            )}${extension}`;

          callback(
            null,
            uniqueName,
          );
        },
      }),

      limits: {
        fileSize:
          5 * 1024 * 1024,
      },

      fileFilter: (
        req,
        file,
        callback,
      ) => {
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
        ];

        if (
          allowedTypes.includes(
            file.mimetype,
          )
        ) {
          callback(
            null,
            true,
          );

          return;
        }

        callback(
          new Error(
            'Only PDF, JPG/JPEG and PNG files are allowed.',
          ),
          false,
        );
      },
    }),
  )
  uploadDocument(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize:
              5 * 1024 * 1024,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,

    @Headers('x-user-role')
    userRole: string,
  ) {
    /*
     * Save the uploaded file information
     * as a real document record.
     */
    const document =
      this.documentsService.createFromUpload(
        file,
        userRole,
      );

    return {
      success: true,

      message:
        'Document uploaded and saved successfully.',

      document,
    };
  }

  // =========================================================
  // UPDATE DOCUMENT
  // =========================================================

  @Put(':id')
  @Roles(
    Role.SUPERUSER,
    Role.FLEET_MANAGER,
  )
  @ApiOperation({
    summary:
      'Update a document',
  })
  @ApiParam({
    name: 'id',
    description: 'Document ID',
  })
  update(
    @Param('id')
    id: string,

    @Body()
    dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(
      id,
      dto,
    );
  }

  // =========================================================
  // DELETE DOCUMENT
  // =========================================================

  @Delete(':id')
  @Roles(
    Role.SUPERUSER,
    Role.FLEET_MANAGER,
  )
  @ApiOperation({
    summary:
      'Delete a document',
    description:
      'Deletes the document record and, if present, the associated uploaded file.',
  })
  @ApiParam({
    name: 'id',
    description: 'Document ID',
  })
  delete(
    @Param('id')
    id: string,
  ) {
    return this.documentsService.delete(
      id,
    );
  }
}