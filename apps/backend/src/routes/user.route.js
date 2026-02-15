import express from "express";
import userController from '../controllers/user.controller.js'

const userRouter = express.Router();

userRouter.get('/', (req, res) => {
    userController.getByUsername(req, res);
});

userRouter.get('/all', (req, res) => {
    userController.getAll(req, res);
});

userRouter.get('/:id', (req, res) => {
    userController.getByID(req, res, req.params.id);
});

userRouter.get('/:id/rooms', (req, res) => {
    userController.getRooms(req, res, req.params.id);
});

userRouter.post('/add', (req, res) => {
    userController.addUser(req, res);
});

userRouter.delete('/delete', (req, res) => {
    userController.deleteUser(req, res);
});


export default userRouter;