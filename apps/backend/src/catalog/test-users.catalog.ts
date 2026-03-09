/**
 * Test users seeded into the DB on startup (if they don't already exist).
 * All signup defaults (wallet, inventory, default room, etc.) are applied automatically.
 *
 * Passwords are stored in plain text here for dev convenience — they are hashed
 * before being written to the DB, just like a normal signup.
 *
 * To reset a test user: drop their document from the `users` collection and restart.
 */
export const TEST_USERS_CATALOG = [
    {
        username: 'abdullahk',
        password: 'P@ssword1',
        email: 'kamranabdullah1998@gmail.com',
        phoneNumber: '+923244647427',
        city: 'Lahore',
        state: 'Punjab',
        country: 'Pakistan',
    },
    {
        username: 'asadk',
        password: 'P@ssword2',
        email: 'kamranasad7@gmail.com',
        phoneNumber: '+923164222121',
        city: 'Lahore',
        state: 'Punjab',
        country: 'Pakistan',
    },
    {
        username: 'nimraht',
        password: 'P@ssword3',
        email: 'nimrahtariq488@gmail.com',
        phoneNumber: '+923344909835',
        city: 'Lagos',
        state: 'Abuja',
        country: 'Nigeria',
    },
];
