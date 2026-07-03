import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "src/lib/prisma/prisma.service";

@Injectable()
export class ShareService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    private get serverUrl(): string {
        return this.config.get<string>("SERVER_URL") || "http://localhost:5050";
    }

    private get appScheme(): string {
        return this.config.get<string>("APP_DEEP_LINK_SCHEME") || "jconnect";
    }

    async getProfileShareLink(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                full_name: true,
                username: true,
                profilePhoto: true,
                profile: { select: { short_bio: true, profile_image_url: true } },
            },
        });
        if (!user) throw new NotFoundException("User not found");

        const displayName = user.username || user.full_name;
        const image = user.profile?.profile_image_url || user.profilePhoto || "";
        const bio = user.profile?.short_bio || "";
        const shareUrl = `${this.serverUrl}/share/profile/${userId}`;

        return {
            url: shareUrl,
            title: `${displayName} on JConnect`,
            description: bio || `Check out ${displayName}'s profile on JConnect`,
            image,
            shareText: `Check out ${displayName} on JConnect! ${shareUrl}`,
        };
    }

    async getServiceShareLink(serviceId: string) {
        const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
            select: {
                id: true,
                serviceName: true,
                description: true,
                price: true,
                currency: true,
                socialLogoForSocialService: true,
                creator: { select: { full_name: true, username: true } },
            },
        });
        if (!service) throw new NotFoundException("Service not found");

        const creatorName = service.creator.username || service.creator.full_name;
        const shareUrl = `${this.serverUrl}/share/service/${serviceId}`;
        const image = service.socialLogoForSocialService || "";

        return {
            url: shareUrl,
            title: service.serviceName,
            description:
                service.description ||
                `${service.serviceName} by ${creatorName} — $${service.price} ${service.currency}`,
            image,
            shareText: `Check out "${service.serviceName}" by ${creatorName} on JConnect! ${shareUrl}`,
        };
    }

    async renderProfilePage(userId: string): Promise<string> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                full_name: true,
                username: true,
                profilePhoto: true,
                profile: { select: { short_bio: true, profile_image_url: true } },
            },
        });
        if (!user) throw new NotFoundException("User not found");

        const displayName = user.username || user.full_name;
        const image = user.profile?.profile_image_url || user.profilePhoto || "";
        const bio = user.profile?.short_bio || `Check out ${displayName}'s profile on JConnect`;
        const shareUrl = `${this.serverUrl}/share/profile/${userId}`;
        const deepLink = `${this.appScheme}://profile/${userId}`;

        return this.buildHtml({
            title: `${displayName} on JConnect`,
            description: bio,
            image,
            url: shareUrl,
            deepLink,
        });
    }

    async renderServicePage(serviceId: string): Promise<string> {
        const service = await this.prisma.service.findUnique({
            where: { id: serviceId },
            select: {
                id: true,
                serviceName: true,
                description: true,
                price: true,
                currency: true,
                socialLogoForSocialService: true,
                creator: { select: { full_name: true, username: true } },
            },
        });
        if (!service) throw new NotFoundException("Service not found");

        const creatorName = service.creator.username || service.creator.full_name;
        const description =
            service.description ||
            `${service.serviceName} by ${creatorName} — $${service.price} ${service.currency}`;
        const shareUrl = `${this.serverUrl}/share/service/${serviceId}`;
        const deepLink = `${this.appScheme}://service/${serviceId}`;

        return this.buildHtml({
            title: `${service.serviceName} — JConnect`,
            description,
            image: service.socialLogoForSocialService || "",
            url: shareUrl,
            deepLink,
        });
    }

    private buildHtml(opts: {
        title: string;
        description: string;
        image: string;
        url: string;
        deepLink: string;
    }): string {
        const { title, description, image, url, deepLink } = opts;
        const escapedTitle = this.escapeHtml(title);
        const escapedDesc = this.escapeHtml(description);

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle}</title>

  <!-- Open Graph -->
  <meta property="og:title" content="${escapedTitle}" />
  <meta property="og:description" content="${escapedDesc}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="JConnect" />
  ${image ? `<meta property="og:image" content="${image}" />` : ""}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title" content="${escapedTitle}" />
  <meta name="twitter:description" content="${escapedDesc}" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ""}

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 32px 24px; max-width: 400px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .logo { font-size: 28px; font-weight: 800; color: #6C3CE3; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
    p { font-size: 14px; color: #666; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: inline-block; background: #6C3CE3; color: #fff; padding: 14px 32px; border-radius: 50px; font-size: 16px; font-weight: 600; text-decoration: none; }
    .btn:hover { background: #5a2fd4; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">JConnect</div>
    <h1>${escapedTitle}</h1>
    <p>${escapedDesc}</p>
    <a class="btn" href="${deepLink}" id="openApp">Open in JConnect</a>
  </div>
  <script>
    (function () {
      var deepLink = "${deepLink}";
      var start = Date.now();
      window.location.href = deepLink;
      setTimeout(function () {
        if (Date.now() - start < 2000) {
          document.getElementById("openApp").style.display = "inline-block";
        }
      }, 1500);
    })();
  </script>
</body>
</html>`;
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
}
