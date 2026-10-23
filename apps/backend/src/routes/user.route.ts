import express from "express";
import userController from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';

const userRouter = express.Router();

userRouter.get('/me', requireAuth, (req, res) => {
    userController.getMe(req, res);
});

userRouter.get('/search', requireAuth, (req, res) => {
    userController.search(req, res);
});

userRouter.get('/:id/avatar', requireAuth, (req, res) => {
    userController.getSelectedAvatar(req, res, req.params.id);
});

userRouter.get('/:id', requireAuth, (req, res) => {
    userController.getByID(req, res, req.params.id);
});

userRouter.post('/push-token', requireAuth, (req, res) => {
    userController.savePushToken(req, res);
});

userRouter.delete('/push-token', requireAuth, (req, res) => {
    userController.removePushToken(req, res);
});

export default userRouter;
