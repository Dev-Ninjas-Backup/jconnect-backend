import { Injectable } from "@nestjs/common";
import { S3 } from "aws-sdk";

@Injectable()
export class AwsService {
    private readonly s3: S3;
    private readonly bucketName: string;

    constructor() {
        // Trim credentials to remove any accidental spaces
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
        const region = process.env.AWS_BUCKET_REGION?.trim();
        this.bucketName = process.env.AWS_BUCKET_NAME?.trim() || "";

        // Validate credentials
        if (!accessKeyId || !secretAccessKey || !region || !this.bucketName) {
            console.error("❌ Missing AWS credentials:", {
                hasAccessKeyId: !!accessKeyId,
                hasSecretAccessKey: !!secretAccessKey,
                hasRegion: !!region,
                hasBucketName: !!this.bucketName,
            });
            throw new Error("AWS credentials are not properly configured");
        }

        console.log("✅ AWS Config:", {
            region,
            bucketName: this.bucketName,
            accessKeyIdLength: accessKeyId.length,
        });

        this.s3 = new S3({
            accessKeyId,
            secretAccessKey,
            region,
            signatureVersion: "v4",
        });
    }

    async testConnection(): Promise<any> {
        try {
            console.log("🔍 Testing AWS S3 connection...");
            const result = await this.s3.headBucket({ Bucket: this.bucketName }).promise();
            console.log("✅ AWS S3 connection successful");
            return { success: true, message: "AWS S3 connection successful" };
        } catch (error) {
            console.error("❌ AWS S3 connection failed:", {
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
            });
            return {
                success: false,
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
            };
        }
    }

    private sanitizeFilename(filename: string): string {
        // Remove or replace non-ASCII characters with safe alternatives
        return filename
            .normalize("NFD") // Normalize Unicode
            .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
            .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII characters
            .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars with underscore
            .replace(/_{2,}/g, "_") // Replace multiple underscores with single
            .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
    }

    async upload(file: Express.Multer.File, isInline: boolean = false): Promise<any> {
        if (!file) {
            throw new Error("File not provided");
        }

        try {
            // Extract filename and extension
            const originalName = file.originalname;
            const lastDotIndex = originalName.lastIndexOf(".");
            const filenameRaw =
                lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;
            const extension = lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : "";

            // Sanitize filename to remove non-ASCII characters
            const filenameSafe = this.sanitizeFilename(filenameRaw) || "file";

            // Create fileKey with timestamp before extension
            const fileKey = `${filenameSafe}-${Date.now()}${extension}`;

            console.log("📤 Uploading file:", {
                originalName,
                sanitizedName: filenameSafe,
                fileKey,
                bucket: this.bucketName,
                disposition: isInline ? "inline" : "attachment",
            });

            // Use safe filename for ContentDisposition as well
            const downloadFilename = `${filenameSafe}${extension}`;

            // Set ContentDisposition based on parameter
            const contentDisposition = isInline
                ? "inline"
                : `attachment; filename="${downloadFilename}"`;

            const uploadResult = await this.s3
                .upload({
                    Bucket: this.bucketName,
                    Key: fileKey,
                    Body: file.buffer,
                    ContentDisposition: contentDisposition,
                    ContentType: file.mimetype,
                })
                .promise();

            console.log("✅ Upload successful:", uploadResult.Location);

            return {
                status: "success",
                message: "File uploaded successfully",
                url: uploadResult.Location,
            };
        } catch (error) {
            console.error("❌ Upload error:", {
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
            });
            throw error;
        }
    }

    async deleteFile(fileUrl: string): Promise<any> {
        try {
            // Extract the file key from the URL
            // URL format: https://bucketname.s3.region.amazonaws.com/filename
            const urlParts = fileUrl.split("/");
            const fileKey = urlParts[urlParts.length - 1];

            if (!fileKey || fileKey === "no file") {
                console.log("⚠️ Skipping deletion: Invalid file key");
                return { success: true, message: "No file to delete" };
            }

            console.log("🗑️ Deleting file:", {
                fileKey,
                bucket: this.bucketName,
            });

            await this.s3
                .deleteObject({
                    Bucket: this.bucketName,
                    Key: decodeURIComponent(fileKey),
                })
                .promise();

            console.log("✅ File deleted successfully");

            return {
                success: true,
                message: "File deleted successfully",
            };
        } catch (error) {
            console.error("❌ Delete error:", {
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
            });
            // Don't throw error, just log it and continue
            return {
                success: false,
                message: error.message,
            };
        }
    }
}
