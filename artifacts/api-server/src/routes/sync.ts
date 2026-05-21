import { Router, type IRouter } from "express";
import { db, syncData } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

router.post("/sync/new", async (req, res) => {
  try {
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.select().from(syncData).where(eq(syncData.code, code));
      if (existing.length === 0) break;
      code = generateCode();
      attempts++;
    }
    await db.insert(syncData).values({ code, trades: [], accounts: [] });
    res.json({ code });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to generate sync code" });
  }
});

router.get("/sync/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const rows = await db.select().from(syncData).where(eq(syncData.code, code.toUpperCase()));
    if (rows.length === 0) {
      res.status(404).json({ error: "Sync code not found" });
      return;
    }
    const row = rows[0];
    res.json({ trades: row.trades, accounts: row.accounts, updatedAt: row.updatedAt });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch sync data" });
  }
});

router.put("/sync/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const { trades, accounts } = req.body;
    if (!Array.isArray(trades) || !Array.isArray(accounts)) {
      res.status(400).json({ error: "Invalid data format" });
      return;
    }
    const upper = code.toUpperCase();
    const rows = await db.select().from(syncData).where(eq(syncData.code, upper));
    if (rows.length === 0) {
      res.status(404).json({ error: "Sync code not found" });
      return;
    }
    await db
      .update(syncData)
      .set({ trades, accounts, updatedAt: new Date() })
      .where(eq(syncData.code, upper));
    res.json({ ok: true });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to save sync data" });
  }
});

export default router;
