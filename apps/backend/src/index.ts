import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import express from "express";
import cors from "cors";
import { Server } from "socket.io"

import userRouter from './routes/user.route.js';
import roomRouter from './routes/room.route.js';
import connect from './db/connect.js'

import socketHandler from './sockets/socketHandler.js'

const PORT = process.env.port;

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/v1/users/', userRouter);
app.use('/api/v1/rooms/', roomRouter);

await connect();

const server = createServer(app);
const io = new Server(server, {
    // ...
});
server.listen(PORT, () => console.log(`Server started. Listening on port ${PORT}`));



app.get('/', (req, res) => {
    res.send({name: 'lallu'});
});

io.on('connection', socketHandler.clientConnected);
