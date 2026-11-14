import admin from 'firebase-admin';
import { readFileSync } from 'fs';

/**
 * Firebase Admin, for push notifications. `FIREBASE_SERVICE_ACCOUNT_KEY` is the path to the service
 * account JSON. When it's unset or unreadable, pushes are disabled and the server still starts:
 * the senders check `admin.apps.length`.
 */
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountPath) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not set — push notifications disabled');
} else {
    try {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log(`Firebase Admin ready for project ${serviceAccount.project_id} — push notifications enabled`);
    } catch (e) {
        console.error(`Could not load the Firebase service account at ${serviceAccountPath} — push notifications disabled:`, e);
    }
}

export default admin;
