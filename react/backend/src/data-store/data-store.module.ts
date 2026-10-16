import { Global, Module } from '@nestjs/common';
import { DataStoreService } from './data-store.service';
import { ChangesController } from './changes.controller';

@Global()
@Module({
  controllers: [ChangesController],
  providers: [DataStoreService],
  exports: [DataStoreService],
})
export class DataStoreModule {}
