import { Global, Module } from "@nestjs/common";

import { FileService } from "./service/file.service";
import { SuperAdminService } from "./service/super-admin.service";
import { seedSettingSrvice } from "./service/setting.service";
import { DatabaseSeedService } from "./service/database-seed.service";

@Global()
@Module({
    imports: [],
    providers: [SuperAdminService, FileService, seedSettingSrvice, DatabaseSeedService],
    exports: [DatabaseSeedService],
})
export class SeedModule {}
