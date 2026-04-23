import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

@Injectable()
export class MultipartParserMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Parse socialProfiles if it exists in the body
        if (req.body && req.body.socialProfiles) {
            try {
                // If it's a string, try to parse it as JSON
                if (typeof req.body.socialProfiles === "string") {
                    req.body.socialProfiles = JSON.parse(req.body.socialProfiles);
                }

                // Ensure it's an array
                if (!Array.isArray(req.body.socialProfiles)) {
                    req.body.socialProfiles = [req.body.socialProfiles];
                }

                // Filter out empty objects
                req.body.socialProfiles = req.body.socialProfiles.filter(
                    (item) =>
                        item &&
                        typeof item === "object" &&
                        Object.keys(item).length > 0 &&
                        item.orderId !== undefined &&
                        item.platformName &&
                        item.platformLink,
                );

                console.log("Parsed socialProfiles:", req.body.socialProfiles);
            } catch (error) {
                console.error("Error parsing socialProfiles:", error);
                req.body.socialProfiles = [];
            }
        }

        next();
    }
}
