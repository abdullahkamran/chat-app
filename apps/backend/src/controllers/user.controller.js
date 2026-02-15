import User from '../models/user.model.js'
import mongoose from 'mongoose';

const controller = {};

controller.getAll = async (_req, res) => {
    try {
        const users = await User.getAll();
        res.send(users);
    }
    catch (e) {
        console.error(`Error: ${e}`);
        res.sendStatus(500);
    }
}

controller.getByID = async (_req, res, id) => {
    try {
        const user = await User.findById(mongoose.Types.ObjectId(`${id}`));
        res.send(user);
    }
    catch (e) {
        console.error(`Error: ${e}`);
        res.sendStatus(500);
    }
}

controller.getByUsername = async (req, res) => {
    try {
        const user = await User.find({username: req.params.username});
        res.send(user);
    }
    catch (e) {
        console.error(`Error: ${e}`);
        res.sendStatus(500);
    }
}

controller.addUser = async (req, res) => {
    let userToAdd = User(req.body);
    try {
        const addedUser = await User.addUser(userToAdd);
        res.send(json(addedUser));
    }
    catch (e) {
        console.error(`Error: ${e}`);
        res.sendStatus(500);
    }
}

controller.deleteUser = async (req, res) => {
    const user = req.body;
    try {
        await User.deleteByID(user);
        res.sendStatus(200);
    }
    catch (e) {
        console.error(`Error: ${e}`);
        res.sendStatus(500);
    }
}

controller.getRooms = async (_req, res, id) => {
    try {
        const user = await User.findById(mongoose.Types.ObjectId(`${id}`)).populate("rooms");
        res.send(user.rooms);
    }
    catch(e) {
        console.error(`Error: ${e}`);
        res.sendStatus(500);
    }
}

export default controller;