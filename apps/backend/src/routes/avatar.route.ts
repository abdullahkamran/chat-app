import express from 'express';
import avatarController from '../controllers/avatar.controller';
import { requireAuth } from '../middleware/auth.middleware';

const avatarRouter = express.Router();

// Catalog — no auth required (browsing available parts)
avatarRouter.get('/defaults', avatarController.getDefaults);
avatarRouter.get('/items', avatarController.getCatalogItems);

// User avatar management — auth required
avatarRouter.get('/', requireAuth, avatarController.getMyAvatars);
avatarRouter.post('/', requireAuth, avatarController.createAvatar);
avatarRouter.put('/:id', requireAuth, avatarController.editAvatar);
avatarRouter.delete('/:id', requireAuth, avatarController.deleteAvatar);
avatarRouter.put('/:id/set-default', requireAuth, avatarController.setDefault);

export default avatarRouter;
