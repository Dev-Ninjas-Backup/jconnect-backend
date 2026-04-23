import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Production database credentials from docker-compose
const PROD_DB = {
    host: "103.174.189.183",
    port: "5433",
    user: "jconnect_user",
    password: "jconnect123Pass",
    database: "jconnect_db",
};

async function main() {
    console.log("🔄 Syncing production database to local...");
    console.log(`📍 Source: ${PROD_DB.host}:${PROD_DB.port}`);

    try {
        // Create dump from production
        console.log("\n📥 Creating database dump from production...");
        const dumpFile = "production_dump.sql";

        const dumpCmd = `PGPASSWORD=${PROD_DB.password} pg_dump -h ${PROD_DB.host} -p ${PROD_DB.port} -U ${PROD_DB.user} -d ${PROD_DB.database} -f ${dumpFile} --clean --if-exists`;

        await execAsync(dumpCmd);
        console.log("✅ Dump created successfully");

        // Restore to local database
        console.log("\n📤 Restoring to local database...");
        const localDbUrl = process.env.DATABASE_URL;

        if (!localDbUrl) {
            throw new Error("DATABASE_URL not found in environment");
        }

        const restoreCmd = `psql ${localDbUrl} -f ${dumpFile}`;
        await execAsync(restoreCmd);

        console.log("✅ Database restored successfully");
        console.log("\n🎉 Production data synced to local database!");

        // Cleanup
        await execAsync(`rm ${dumpFile}`);
    } catch (error) {
        console.error("❌ Error syncing database:", error.message);
        console.log("\n💡 Manual steps:");
        console.log(
            `1. pg_dump -h ${PROD_DB.host} -p ${PROD_DB.port} -U ${PROD_DB.user} -d ${PROD_DB.database} > dump.sql`,
        );
        console.log(`2. psql $DATABASE_URL < dump.sql`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
