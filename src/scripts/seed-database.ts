import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { DatabaseSeedService } from "../lib/seed/service/database-seed.service";

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const seedService = app.get(DatabaseSeedService);

    try {
        await seedService.seedDatabase();
        console.log("✅ Seeding completed successfully!");
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    } finally {
        await app.close();
    }
}

bootstrap();
