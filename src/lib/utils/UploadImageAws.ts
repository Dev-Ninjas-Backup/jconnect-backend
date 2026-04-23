import { S3 } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import mime from "mime-types";
import path from "path";

const s3 = new S3({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
});

const UploadFileToAwsS3 = async (filePath: string) => {
    const fileContent = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const fileName = `${Date.now()}-${path.basename(filePath)}`;
    const contentType = mime.lookup(ext) || "application/octet-stream";

    const upload = new Upload({
        client: s3,
        params: {
            Bucket: process.env.AWS_BUCKET_NAME!,
            Key: fileName,
            Body: fileContent,
            ContentType: contentType,
        },
    });

    try {
        const result = await upload.done();
        fs.unlinkSync(filePath);

        return {
            url: result.Location,
            key: fileName,
        };
    } catch (error) {
        fs.unlinkSync(filePath);
        console.error(" S3 Upload Error:", error);
        throw error;
    }
};

export default UploadFileToAwsS3;
