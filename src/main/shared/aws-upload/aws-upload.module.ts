import { Global, Module } from "@nestjs/common";
import { AwsS3Controller } from "./additional.controller";
import { AwsS3Service } from "./additional.service";

@Global()
@Module({
    providers: [AwsS3Service],
    exports: [AwsS3Service],
    controllers: [AwsS3Controller],
})
export class UploadAwsModule {}
