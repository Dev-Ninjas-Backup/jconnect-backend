import { S3 } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as mime from "mime-types";
import * as path from "path";
import { promisify } from "util";

const unlinkAsync = promisify(fs.unlink);

@Injectable()
export class AwsS3Service {
    private s3: S3;

    constructor() {
        this.s3 = new S3({
            region: process.env.AWS_BUCKET_REGION || "us-east-1",
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
            },
        });
    }

    async uploadFileToS3(localFilePath: string, prefix: string) {
        const fileContent = fs.readFileSync(localFilePath);
        const fileExt = path.extname(localFilePath);
        const fileName = `${prefix}-${path.basename(localFilePath)}`;
        const mimeType = mime.lookup(fileExt) || "application/octet-stream";

        try {
            const upload = new Upload({
                client: this.s3,
                params: {
                    Bucket: process.env.AWS_BUCKET_REGION!,
                    Key: fileName,
                    Body: fileContent,
                    ContentType: mimeType,
                },
            });

            const result = await upload.done();

            // Delete local file after successful upload
            await unlinkAsync(localFilePath);
            console.log(` Deleted local file: ${localFilePath}`);

            return {
                url: result.Location,
                key: fileName,
            };
        } catch (error) {
            console.error("Upload failed:", error);
            throw error;
        }
    }
}
