import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    UploadedFile,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";

import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { FileType, MulterService } from "src/lib/multer/multer.service";
import UploadFileToAwsS3 from "src/lib/utils/UploadImageAws";
import { AwsS3Service } from "./additional.service";
import { Additionaldto, AdditionalMultipleDto } from "./dto/uploadadditional.dto";
@ApiTags("aws-s3-file-upload")
@Controller("aws-file-upload-additional-all")
export class AwsS3Controller {
    constructor(private readonly AdditionalS3Service: AwsS3Service) {}
    // --------------------upload single file to s3-------------
    @Post("upload-image-single")
    @ApiConsumes("multipart/form-data")
    @UseInterceptors(
        FileInterceptor(
            "file",
            new MulterService().createMulterOptions("./uploads", "content", FileType.ANY),
        ),
    )
    async create(
        @Body() createTestawDto: Additionaldto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            return { message: "No file uploaded" };
        }

        //  Upload to AWS S3
        const s3Result = await UploadFileToAwsS3(file?.path);
        console.log(" Uploaded to S3:", s3Result.url);

        return {
            message: " File uploaded successfully to S3",
            file: s3Result.url,
            // key: s3Result.key,
        };
    }

    // --------------------upload multiple files to s3-------------
    @Post("upload-image-multiple")
    @ApiConsumes("multipart/form-data")
    @UseInterceptors(
        FilesInterceptor(
            "files",
            10,
            new MulterService().createMulterOptions("./uploads", "content", FileType.ANY),
        ),
    )
    async createMultiple(
        @Body() createTestawDto: AdditionalMultipleDto,
        @UploadedFiles() files: Express.Multer.File[],
    ) {
        if (!files || files.length === 0) {
            return { message: "No files uploaded" };
        }

        const s3Results = await Promise.all(files.map((file) => UploadFileToAwsS3(file?.path)));

        return {
            message: "Files uploaded successfully to S3",
            files: s3Results.map((result) => result.url),
            // keys: s3Results.map((result) => result.key),
        };
    }
}
