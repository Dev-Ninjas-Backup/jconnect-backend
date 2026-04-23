// upload-aws.controller.ts
import { Controller, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { UploaddAwsdto } from "./upload-aws.dto";
import { AwsService } from "./upload-aws.service";

@Controller("upload-aws")
export class UploadAwsController {
    constructor(private readonly awsService: AwsService) {}

    // Single file upload
    @Post("upload-s3")
    @ApiConsumes("multipart/form-data")
    @ApiBody({ type: UploaddAwsdto })
    @UseInterceptors(FileInterceptor("file"))
    async uploadFileToS3(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            return { success: false, message: "File is required" };
        }
        const result = await this.awsService.uploadFileToS3(file);
        return { success: true, data: result };
    }
}
