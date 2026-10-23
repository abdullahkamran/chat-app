import express from "express";
import friendController from '../controllers/friend.controller';
import { requireAuth } from '../middleware/auth.middleware';

const friendRouter = express.Router();

friendRouter.get('/', requireAuth, (req, res) => {
    friendController.getFriends(req, res);
});

friendRouter.get('/requests', requireAuth, (req, res) => {
    friendController.getIncomingRequests(req, res);
});

friendRouter.post('/requests', requireAuth, (req, res) => {
    friendController.sendRequest(req, res);
});

friendRouter.post('/requests/:userId/accept', requireAuth, (req, res) => {
    friendController.acceptRequest(req, res);
});

friendRouter.delete('/requests/:userId', requireAuth, (req, res) => {
    friendController.deleteRequest(req, res);
});

friendRouter.get('/suggestions', requireAuth, (req, res) => {
    friendController.getSuggestions(req, res);
});

friendRouter.post('/suggestions/:userId/dismiss', requireAuth, (req, res) => {
    friendController.dismissSuggestion(req, res);
});

friendRouter.post('/contacts/sync', requireAuth, (req, res) => {
    friendController.syncContacts(req, res);
});

friendRouter.delete('/:userId', requireAuth, (req, res) => {
    friendController.unfriend(req, res);
});

export default friendRouter;
