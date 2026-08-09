export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[VeloNet AutoBoot] Server initialized. Auto-starting WhatsApp Bot Engine & Cron Scheduler...");
    try {
      const { botEngine } = await import("./lib/bot-engine");
      const { startAutoCronScheduler } = await import("./lib/auto-cron-scheduler");

      // Auto-start WhatsApp Bot Engine upon server deployment / restart
      botEngine.startBot();
      startAutoCronScheduler();
      console.log("[VeloNet AutoBoot] WhatsApp Bot Engine & Cron Scheduler successfully auto-started!");
    } catch (err) {
      console.error("[VeloNet AutoBoot] Failed to auto-start Bot Engine on boot:", err);
    }
  }
}
