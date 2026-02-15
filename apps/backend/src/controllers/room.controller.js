import mongoose from "mongoose";
import Room from "../models/room.model.js";

const controller = [];


controller.getAll = async (_req, res) => {
    try {
        const rooms = await Room.getAll();
        res.send(rooms);
    }
    catch (e) {
        console.log(`Error: ${e}`);
        res.sendStatus(500);
    }
}

controller.getByID = async (_req, res, id) => {
    try {
        const room = await Room.findById(mongoose.Types.ObjectId(`${id}`)).populate("owners").populate("members");
        res.send(room);
    }
    catch (e) {
        console.log(`Error: ${e}`);
        res.sendStatus(500);
    }
}

controller.addRoom = async (req, res) => {
    const room = Room(req.body);
    try {
        if (!room.owners || !room.owners.length) {
            res.sendStatus(400);
        }
        else{
            const addedRoom = await Room.addRoom(room);
            res.send(json(addedRoom));
        }
    }
    catch (e) {
        console.log(`Error: ${e}`);
        res.sendStatus(500);
    }
}

controller.deleteRoom = async (req, res) => {
    const room = req.body;
    try {
        await Room.deleteByID(room);
        res.sendStatus(200);
    }
    catch (e) {
        console.log(`Error: ${e}`);
        res.sendStatus(500);
    }
}

export default controller;