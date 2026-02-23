import express from "express";
import roomController from '../controllers/room.controller';
import { requireAuth } from '../middleware/auth.middleware';

const roomRouter = express.Router();

roomRouter.get('/', requireAuth, (req, res) => {
    roomController.getRooms(req, res);
});

roomRouter.get('/:roomId/details', requireAuth, (req, res) => {
    roomController.getDetails(req, res);
});

roomRouter.get('/all', (req, res) => {
    roomController.getAll(req, res);
});

roomRouter.get('/:id', (req, res) => {
    roomController.getByID(req, res, req.params.id);
});

roomRouter.post('/', requireAuth, (req, res) => {
    roomController.createRoom(req, res);
});

roomRouter.delete('/delete', (req, res) => {
    roomController.deleteRoom(req, res);
});


export default roomRouter;