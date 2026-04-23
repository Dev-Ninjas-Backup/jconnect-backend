import { IAppMetadata } from "@type/app-metadata";
import * as fs from "fs";
import * as path from "path";

class AppMetadata implements IAppMetadata {
    private readonly metadata: Record<string, string>;

    constructor() {
        const packageJsonPath = path.join(process.cwd(), "package.json");
        const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
        this.metadata = JSON.parse(packageJsonContent);
    }

    get name(): string {
        return this.metadata.name;
    }
    get displayName(): string {
        return this.metadata.displayName;
    }

    get version(): string {
        return this.metadata.version;
    }

    get description(): string {
        return this.metadata.description;
    }
}
export default new AppMetadata();
