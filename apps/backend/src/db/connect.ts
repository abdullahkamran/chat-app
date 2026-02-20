import mongoose from 'mongoose';

const connect = async (): Promise<void> => {
    try {
        const DB_URL = process.env.ATLAS_DB_URL;
        if (!DB_URL) throw new Error('ATLAS_DB_URL environment variable is not set');

        await mongoose.connect(DB_URL);
        console.log('Connected to MongoDB');
    } catch (e) {
        console.log('Could not connect to MongoDB');
        console.log(e);
    }
};

export default connect;
