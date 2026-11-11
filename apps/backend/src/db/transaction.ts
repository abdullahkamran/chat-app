import mongoose, { ClientSession } from 'mongoose';

/**
 * Runs `fn` in a MongoDB transaction and returns what it returned. Mongoose retries `fn` on a
 * transient error (another transaction wrote the same document, say), so it must not have side
 * effects outside the session. Throw to abort.
 */
export async function inTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    let result!: T;
    await mongoose.connection.transaction(async (session) => {
        result = await fn(session);
    });
    return result;
}
