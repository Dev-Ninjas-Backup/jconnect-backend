import { Global, Module } from "@nestjs/common";

import { JwtService } from "@nestjs/jwt";
import { UtilsService } from "./utils.service";

@Global()
@Module({
    providers: [UtilsService, JwtService],
    exports: [UtilsService],
})
export class UtilsModule {}
