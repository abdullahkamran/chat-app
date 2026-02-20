import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountPath) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not set — push notifications disabled');
} else {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

export default admin;
