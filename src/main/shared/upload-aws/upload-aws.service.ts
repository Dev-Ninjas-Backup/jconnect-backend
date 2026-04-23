// aws.service.ts
import { Injectable } from "@nestjs/common";
import * as aws from "aws-sdk";
import * as crypto from "crypto";
import { ENVEnum } from "src/common/enum/env.enum";

@Injectable()
export class AwsService {
    private s3: aws.S3;
    private bucketName: string;

    constructor() {
        const region = "ap-southeast-1";
        this.bucketName = "milon32";

        this.s3 = new aws.S3({
            region,
            accessKeyId: ENVEnum.ACCESS_KEY,
            secretAccessKey: ENVEnum.ACCESS_SECRET,
            signatureVersion: "v4",
        });
    }

    // Direct file upload
    async uploadFileToS3(file: Express.Multer.File) {
        const randomName = crypto.randomBytes(16).toString("hex");
        const ext = file.originalname.split(".").pop();
        const fileKey = `uploads/${randomName}.${ext}`;

        const params: aws.S3.PutObjectRequest = {
            Bucket: this.bucketName,
            Key: fileKey,
            Body: file.buffer,
            ContentType: file.mimetype,
            ACL: "public-read",
        };

        const uploadResult = await this.s3.upload(params).promise();
        return uploadResult;
    }
}
