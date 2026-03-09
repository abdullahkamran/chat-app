import express from "express";
import userController from '../controllers/user.controller';
import { requireAuth } from '../middleware/auth.middleware';

const userRouter = express.Router();

userRouter.get('/', (req, res) => {
    userController.getByUsername(req, res);
});

userRouter.get('/all', (req, res) => {
    userController.getAll(req, res);
});

userRouter.get('/:id/avatar', requireAuth, (req, res) => {
    userController.getSelectedAvatar(req, res, req.params.id);
});

userRouter.get('/:id', (req, res) => {
    userController.getByID(req, res, req.params.id);
});

userRouter.get('/:id/rooms', (req, res) => {
    userController.getRooms(req, res, req.params.id);
});

userRouter.delete('/delete', (req, res) => {
    userController.deleteUser(req, res);
});

userRouter.post('/push-token', requireAuth, (req, res) => {
    userController.savePushToken(req, res);
});

userRouter.delete('/push-token', requireAuth, (req, res) => {
    userController.removePushToken(req, res);
});

export default userRouter;