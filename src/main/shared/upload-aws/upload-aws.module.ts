import { Module } from "@nestjs/common";
import { LibModule } from "src/lib/lib.module";
import { UploadAwsController } from "./upload-aws.controller";
import { AwsService } from "./upload-aws.service";

@Module({
    imports: [LibModule],
    controllers: [UploadAwsController],
    providers: [AwsService],
})
export class AwsUploadModule {}
