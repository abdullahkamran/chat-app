import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { syncCatalog } from '../services/catalog-sync.service';

const devRouter = Router();

/**
 * POST /api/v1/dev/reset
 * Drops all collections then re-seeds the catalog (items, avatar items, animations, test users).
 * DEV ONLY — remove this route before production.
 */
devRouter.post('/reset', async (_req: Request, res: Response): Promise<void> => {
    try {
        const db = mongoose.connection.db!;
        const collections = await db.listCollections().toArray();
        await Promise.all(collections.map(c => db.collection(c.name).deleteMany({})));
        await syncCatalog();
        res.send({ ok: true, cleared: collections.map(c => c.name) });
    } catch (e) {
        console.error('[dev] Reset failed:', e);
        res.sendStatus(500);
    }
});

export default devRouter;
