import { PrismaClient } from "@prisma/client";
import * as https from "https";
import * as http from "http";

const prisma = new PrismaClient();
const PROD_API = "http://103.174.189.183:5050";

async function fetchFromAPI(endpoint: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const url = `${PROD_API}${endpoint}`;
        const client = url.startsWith("https") ? https : http;

        client
            .get(url, (res) => {
                let data = "";
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve(data);
                    }
                });
            })
            .on("error", reject);
    });
}

async function main() {
    console.log("🌐 Fetching data from production API...");
    console.log(`📍 API: ${PROD_API}/api-docs`);

    try {
        // Fetch users
        console.log("👥 Fetching users...");
        const usersData = await fetchFromAPI("/users");
        console.log(`✅ Found ${usersData?.length || 0} users`);

        // Fetch services
        console.log("🛠️  Fetching services...");
        const servicesData = await fetchFromAPI("/services");
        console.log(`✅ Found ${servicesData?.length || 0} services`);

        // Fetch orders
        console.log("📦 Fetching orders...");
        const ordersData = await fetchFromAPI("/orders");
        console.log(`✅ Found ${ordersData?.length || 0} orders`);

        console.log("\n📊 Production Data Summary:");
        console.log(`- Users: ${usersData?.length || 0}`);
        console.log(`- Services: ${servicesData?.length || 0}`);
        console.log(`- Orders: ${ordersData?.length || 0}`);

        console.log("\n💡 Note: Check API documentation at:");
        console.log(`   ${PROD_API}/api-docs`);
    } catch (error) {
        console.error("❌ Error fetching production data:", error.message);
        console.log("\n💡 Tips:");
        console.log("1. Check if production API is accessible");
        console.log("2. Verify API endpoints in Swagger docs");
        console.log("3. Check if authentication is required");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
