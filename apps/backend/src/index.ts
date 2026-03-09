import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { Server } from 'socket.io';

import userRouter from './routes/user.route';
import roomRouter from './routes/room.route';
import authRouter from './routes/auth.route';
import avatarRouter from './routes/avatar.route';
import { shopRouter, inventoryRouter } from './controllers/shop.controller';
import { avatarShopRouter, avatarInventoryRouter } from './controllers/avatar-shop.controller';
import { animationShopRouter, animationInventoryRouter } from './controllers/animation-shop.controller';
import { transactionRouter } from './controllers/transaction.controller';
import devRouter from './routes/dev.route';
import connect from './db/connect';
import socketHandler from './sockets/socketHandler';
import { syncCatalog } from './services/catalog-sync.service';

const PORT = process.env.PORT;

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan(process.env.LOG_FORMAT ?? 'dev'));

app.use('/api/v1/auth/', authRouter);
app.use('/api/v1/users/', userRouter);
app.use('/api/v1/rooms/', roomRouter);
app.use('/api/v1/shop', shopRouter);
app.use('/api/v1/inventory', inventoryRouter);
app.use('/api/v1/avatar', avatarRouter);
app.use('/api/v1/shop', avatarShopRouter);
app.use('/api/v1/inventory', avatarInventoryRouter);
app.use('/api/v1/shop', animationShopRouter);
app.use('/api/v1/inventory', animationInventoryRouter);
app.use('/api/v1/transaction-history', transactionRouter);

app.use('/api/v1/dev', devRouter);

app.get('/', (_req, res) => {
    res.send({ name: 'test' });
});

const server = createServer(app);
const io = new Server(server, {
    // ...
});

io.on('connection', socketHandler.clientConnected);

async function main() {
    await connect();
    await syncCatalog();
    server.listen(PORT, () => console.log(`Server started. Listening on port ${PORT}`));
}

main();
