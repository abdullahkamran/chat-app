import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../services/auth.service';

declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).send({ error: 'Unauthorized' });
        return;
    }

    const token = authHeader.slice(7);
    try {
        req.user = verifyAccessToken(token);
        next();
    } catch {
        res.status(401).send({ error: 'Invalid or expired token' });
    }
}
