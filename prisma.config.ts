import "dotenv/config";
import path from "node:path";
import type { PrismaConfig } from "prisma";

const config: PrismaConfig = {
    schema: path.join("prisma", "schema"),
    migrations: {
        path: path.join("prisma", "migrations"),
        seed: "tsx prisma/seed.ts",
    },
    views: {
        path: path.join("prisma", "views"),
    },
    typedSql: {
        path: path.join("prisma", "queries"),
    },
    experimental: {
        studio: true,
        adapter: true,
        externalTables: true,
    },
};

export default config;
