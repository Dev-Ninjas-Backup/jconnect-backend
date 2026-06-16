import { Module } from "@nestjs/common";
import { PrismaModule } from "src/lib/prisma/prisma.module";
import { ShareController } from "./share.controller";
import { ShareService } from "./share.service";

@Module({
    imports: [PrismaModule],
    controllers: [ShareController],
    providers: [ShareService],
})
export class ShareModule {}
