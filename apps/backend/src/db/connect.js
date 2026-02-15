import Mongoose from 'mongoose';
Mongoose.Promise = global.Promise;

const connect = async () => {
    try {
        const DB_URL = process.env.ATLAS_DB_URL;

        await Mongoose.connect(DB_URL);
        console.log('Connected to MongoDB');
    }
    catch (e) {
        console.log('Could not connect to MongoDB');
        console.log(e);
    }
}

export default connect;