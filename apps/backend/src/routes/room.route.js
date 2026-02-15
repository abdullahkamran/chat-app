import express from "express";
import roomController from '../controllers/room.controller.js'

const roomRouter = express.Router();

roomRouter.get('/all', (req, res) => {
    roomController.getAll(req, res);
});

roomRouter.get('/:id', (req, res) => {
    roomController.getByID(req, res, req.params.id);
});

roomRouter.post('/add', (req, res) => {
    roomController.addRoom(req, res);
});

roomRouter.delete('/delete', (req, res) => {
    roomController.deleteRoom(req, res);
});


export default roomRouter;