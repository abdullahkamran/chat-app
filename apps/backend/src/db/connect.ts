import dns from 'node:dns';
import mongoose from 'mongoose';

// On some Windows setups Node's resolver ends up pointed at 127.0.0.1 with nothing
// listening, which breaks the SRV lookup for mongodb+srv:// URLs. Fall back to public DNS.
const ensureUsableDns = (): void => {
    const servers = dns.getServers();
    if (servers.length === 0 || servers.every((s) => s === '127.0.0.1' || s === '::1')) {
        dns.setServers(['1.1.1.1', '8.8.8.8']);
    }
};

const connect = async (): Promise<void> => {
    try {
        ensureUsableDns();
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
