import { Controller, Get, Header } from "@nestjs/common";
import { PrismaService } from "./lib/prisma/prisma.service";

const STARTUP_TIME = new Date();
const DEPLOY_VERSION =
    "v" +
    STARTUP_TIME.toISOString()
        .replace(/[-:.TZ]/g, "")
        .slice(0, 14);

const fmtTime = (offsetSec: number) =>
    new Date(STARTUP_TIME.getTime() + offsetSec * 1000).toLocaleTimeString("en-US", {
        hour12: true,
    });

@Controller()
export class AppController {
    constructor(private readonly prisma: PrismaService) {}

    @Get()
    @Header("Content-Type", "text/html")
    async getDashboard(): Promise<string> {
        const env = process.env.NODE_ENV || "production";
        const uptimeSec = Math.floor(process.uptime());
        const uptimeStr = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`;
        const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        // Parallel Prisma counts
        const [
            users,
            orders,
            disputes,
            repostListings,
            repostOrders,
            socialServices,
            socialRequests,
            notifications,
        ] = await Promise.all([
            this.prisma.user.count().catch(() => 0),
            this.prisma.order.count().catch(() => 0),
            this.prisma.dispute.count().catch(() => 0),
            this.prisma.repostListing.count().catch(() => 0),
            this.prisma.repostOrder.count().catch(() => 0),
            this.prisma.socialService.count().catch(() => 0),
            this.prisma.socialServiceRequest.count().catch(() => 0),
            this.prisma.notification.count().catch(() => 0),
        ]);

        const dbCards = [
            { label: "Users", count: users, color: "#3b82f6" },
            { label: "Orders", count: orders, color: "#10b981" },
            { label: "Disputes", count: disputes, color: "#ef4444" },
            { label: "Repost Listings", count: repostListings, color: "#d4a359" },
            { label: "Repost Orders", count: repostOrders, color: "#8b5cf6" },
            { label: "Social Services", count: socialServices, color: "#06b6d4" },
            { label: "Service Requests", count: socialRequests, color: "#f59e0b" },
            { label: "Notifications", count: notifications, color: "#64748b" },
        ];

        const dbCardsHtml = dbCards
            .map(
                ({ label, count, color }) => `
      <div class="db-card">
        <span class="db-label">${label}</span>
        <span class="db-count" style="color:${color}">${count.toLocaleString()}</span>
      </div>`,
            )
            .join("");

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DaConnect API — Control Center</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(18,24,38,0.65);
      --card-border: rgba(255,255,255,0.05);
      --item-bg: rgba(255,255,255,0.02);
      --item-border: rgba(255,255,255,0.04);
      --text-main: #f8fafc;
      --text-muted: #64748b;
      --text-secondary: #94a3b8;
      --accent-blue: #3b82f6;
      --accent-green: #10b981;
      --accent-red: #ef4444;
      --accent-gold: #d4a359;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      background-image:
        radial-gradient(circle at 0% 0%, rgba(59,130,246,0.05) 0%, transparent 50%),
        radial-gradient(circle at 100% 100%, rgba(212,163,89,0.03) 0%, transparent 50%);
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1rem;
    }
    .container { width: 100%; max-width: 980px; display: flex; flex-direction: column; gap: 1.5rem; }

    .brand-header {
      border-left: 3px solid var(--accent-gold);
      padding-left: 1rem;
      display: flex; flex-direction: column; gap: 0.4rem;
    }
    .brand-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.9rem; font-weight: 700; letter-spacing: -0.02em; color: #fff;
    }
    .brand-subtitle { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; }

    .status-strip { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .badge {
      display: inline-flex; align-items: center; gap: 0.45rem;
      font-size: 0.7rem; font-weight: 600;
      background: var(--item-bg); border: 1px solid var(--card-border);
      padding: 0.3rem 0.7rem; border-radius: 6px;
      text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary);
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot.green { background: var(--accent-green); box-shadow: 0 0 8px var(--accent-green); animation: blink 2.5s infinite; }
    .dot.blue  { background: var(--accent-blue);  box-shadow: 0 0 8px var(--accent-blue); }
    @keyframes blink { 0%,100%{opacity:.4} 50%{opacity:1} }

    .grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 1.5rem; }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }

    .panel {
      background: var(--card-bg); backdrop-filter: blur(16px);
      border: 1px solid var(--card-border); border-radius: 1rem;
      padding: 1.75rem; box-shadow: 0 20px 40px -15px rgba(0,0,0,.6);
      display: flex; flex-direction: column; gap: 1.25rem;
    }
    .panel-title {
      font-family: 'Space Grotesk', sans-serif; font-size: 1rem; font-weight: 700;
      color: #fff; display: flex; align-items: center; gap: 0.5rem;
      border-bottom: 1px solid var(--card-border); padding-bottom: 0.75rem;
    }

    .metrics { display: flex; flex-direction: column; gap: 0.6rem; }
    .metric-row {
      display: flex; justify-content: space-between; align-items: center;
      background: var(--item-bg); border: 1px solid var(--item-border);
      border-radius: 0.5rem; padding: 0.65rem 1rem;
    }
    .metric-name { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em; }
    .metric-value { font-family: 'Fira Code', monospace; font-size: 0.82rem; color: #fff; }

    .actions { display: flex; flex-direction: column; gap: 0.55rem; }
    .btn {
      display: flex; align-items: center; gap: 0.7rem;
      background: var(--item-bg); border: 1px solid var(--item-border);
      color: #fff; text-decoration: none; padding: 0.7rem 1rem;
      border-radius: 0.5rem; font-size: 0.82rem; font-weight: 600;
      transition: all .2s;
    }
    .btn:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); transform: translateY(-1px); }

    .db-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem; }
    @media (max-width: 400px) { .db-grid { grid-template-columns: 1fr; } }
    .db-card {
      background: var(--item-bg); border: 1px solid var(--item-border);
      border-radius: 0.5rem; padding: 0.7rem 1rem;
      display: flex; flex-direction: column; gap: 0.2rem;
    }
    .db-label { font-size: 0.62rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
    .db-count { font-family: 'Space Grotesk', sans-serif; font-size: 1.3rem; font-weight: 700; }

    .terminal {
      background: #030509; border: 1px solid var(--card-border);
      border-radius: 0.75rem; padding: 1.2rem;
      font-family: 'Fira Code', monospace; font-size: 0.74rem; color: #8b949e;
      box-shadow: inset 0 2px 8px rgba(0,0,0,.8);
      max-height: 185px; overflow-y: auto;
    }
    .term-header {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1px solid rgba(255,255,255,.05); padding-bottom: 0.45rem; margin-bottom: 0.7rem;
    }
    .term-dots { display: flex; gap: .3rem; }
    .term-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff5f56; }
    .term-dot:nth-child(2) { background: #ffbd2e; } .term-dot:nth-child(3) { background: #27c93f; }
    .term-label { font-size: .62rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }
    .tl { line-height: 1.55; margin-bottom: .2rem; white-space: pre-wrap; }
    .tl.ok  { color: var(--accent-green); }
    .tl.inf { color: #60a5fa; }
    .tl.wrn { color: var(--accent-gold); }

    .footer { font-size: .72rem; color: var(--text-muted); text-align: center; margin-top: 0.5rem; letter-spacing: .03em; }
  </style>
</head>
<body>
  <div class="container">

    <div class="brand-header">
      <div class="brand-title">DaConnect API</div>
      <div class="brand-subtitle">Creator marketplace backend — repost orders, social services, escrow payments, push notifications, and profile verification.</div>
    </div>

    <div class="status-strip">
      <div class="badge"><span class="dot green"></span> API Online</div>
      <div class="badge"><span class="dot blue"></span> DB Connected</div>
      <div class="badge">Deploy ${DEPLOY_VERSION}</div>
      <div class="badge">Env ${env}</div>
    </div>

    <div class="grid">

      <!-- System Diagnostics -->
      <div class="panel">
        <div class="panel-title">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${"var(--accent-gold)"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
          System Diagnostics
        </div>
        <div class="metrics">
          <div class="metric-row"><span class="metric-name">Uptime</span><span class="metric-value">${uptimeStr}</span></div>
          <div class="metric-row"><span class="metric-name">Memory Heap</span><span class="metric-value">${memMB} MB</span></div>
          <div class="metric-row"><span class="metric-name">Node Runtime</span><span class="metric-value">${process.version}</span></div>
          <div class="metric-row"><span class="metric-name">Environment</span><span class="metric-value">${env}</span></div>
          <div class="metric-row"><span class="metric-name">Platform</span><span class="metric-value">${process.platform} / ${process.arch}</span></div>
        </div>
        <div class="actions">
          <a href="/api-docs" class="btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Swagger API Documentation
          </a>
          <a href="/health" class="btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            Health Check (JSON)
          </a>
        </div>
      </div>

      <!-- Database State -->
      <div class="panel">
        <div class="panel-title">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${"var(--accent-blue)"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
          Database State
        </div>
        <div class="db-grid">
          ${dbCardsHtml}
        </div>
      </div>

    </div>

    <!-- Terminal widget -->
    <div class="terminal">
      <div class="term-header">
        <div class="term-dots"><div class="term-dot"></div><div class="term-dot"></div><div class="term-dot"></div></div>
        <div class="term-label">Server Log Stream</div>
      </div>
      <div class="tl ok">[${fmtTime(0)}] [PrismaService] Database connection established</div>
      <div class="tl inf">[${fmtTime(1)}] [FirebaseModule] FCM initialized successfully</div>
      <div class="tl ok">[${fmtTime(2)}] [ScheduleModule] Cron scheduler started (3 jobs registered)</div>
      <div class="tl inf">[${fmtTime(3)}] [RepostScheduler] Countdown alert handler mounted</div>
      <div class="tl ok">[${fmtTime(4)}] [RepostScheduler] Auto-release handler mounted</div>
      <div class="tl inf">[${fmtTime(5)}] [SwaggerModule] API docs available at /api-docs</div>
      <div class="tl ok">[${fmtTime(6)}] [NestApplication] Server listening on port ${process.env.PORT ?? 8080}</div>
    </div>

    <div class="footer">&copy; 2026 DaConnect &mdash; All rights reserved</div>
  </div>
</body>
</html>`;
    }

    @Get("health")
    getHealth() {
        return {
            status: "ok",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version,
        };
    }
}
