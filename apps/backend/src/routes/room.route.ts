import express from "express";
import roomController from '../controllers/room.controller';
import mailController from '../controllers/mail.controller';
import { requireAuth } from '../middleware/auth.middleware';

const roomRouter = express.Router();

roomRouter.get('/:roomId/mail', requireAuth, (req, res) => {
    mailController.getMailbox(req, res);
});

roomRouter.post('/:roomId/mail', requireAuth, (req, res) => {
    mailController.postMail(req, res);
});

roomRouter.post('/:roomId/mail/read', requireAuth, (req, res) => {
    mailController.markRead(req, res);
});

roomRouter.delete('/:roomId/mail/:mailId', requireAuth, (req, res) => {
    mailController.deleteMail(req, res);
});

roomRouter.get('/', requireAuth, (req, res) => {
    roomController.getRooms(req, res);
});

roomRouter.get('/:roomId/details', requireAuth, (req, res) => {
    roomController.getDetails(req, res);
});

roomRouter.get('/:roomId/members', requireAuth, (req, res) => {
    roomController.getMembers(req, res);
});

roomRouter.post('/:roomId/members', requireAuth, (req, res) => {
    roomController.addMembers(req, res);
});

roomRouter.delete('/:roomId/members/:userId', requireAuth, (req, res) => {
    roomController.removeMember(req, res);
});

roomRouter.post('/:roomId/leave', requireAuth, (req, res) => {
    roomController.leave(req, res);
});

roomRouter.get('/:id', requireAuth, (req, res) => {
    roomController.getByID(req, res, req.params.id);
});

roomRouter.post('/', requireAuth, (req, res) => {
    roomController.createRoom(req, res);
});

roomRouter.patch('/:roomId/items', requireAuth, (req, res) => {
    roomController.updateItems(req, res);
});

export default roomRouter;
