import { Injectable } from "@nestjs/common";
import { diskStorage } from "multer";
import * as path from "path";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { v4 as uuid } from "uuid";

export enum FileType {
    IMAGE = "image",
    DOCUMENT = "document",
    VIDEO = "video",
    AUDIO = "audio",
    PDF = "pdf",
    MEDIA = "media",
    ANY = "any",
}

@Injectable()
export class MulterService {
    private mimeTypesMap = {
        [FileType.IMAGE]: ["image/jpeg", "image/png", "image/webp"],
        [FileType.DOCUMENT]: [
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        [FileType.VIDEO]: ["video/mp4", "video/webm", "video/ogg"],
        [FileType.AUDIO]: ["audio/mpeg", "audio/ogg", "audio/wav"],
        [FileType.PDF]: ["application/pdf"],
        [FileType.MEDIA]: [
            // <-- Combine VIDEO + AUDIO
            "video/mp4",
            "video/webm",
            "video/ogg",
            "audio/mpeg",
            "audio/ogg",
            "audio/wav",
        ],
    };

    public createMulterOptions(
        destinationFolder: string = "./uploads",
        prefix: string,
        fileType: FileType = FileType.IMAGE,
        fileSizeLimit = 500 * 1024 * 1024,
        customMimeTypes?: string[],
    ): MulterOptions {
        const allowedMimeTypes =
            fileType === FileType.ANY ? null : customMimeTypes || this.mimeTypesMap[fileType] || [];

        return {
            storage: diskStorage({
                destination: destinationFolder,
                filename: (req, file, cb) => {
                    const ext = path.extname(file.originalname);
                    const filename = `${prefix}-${uuid()}${ext}`;
                    cb(null, filename);
                },
            }),
            limits: {
                fileSize: fileSizeLimit,
            },
            fileFilter: (req, file, cb) => {
                if (!allowedMimeTypes || allowedMimeTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
                }
            },
        };
    }
}
