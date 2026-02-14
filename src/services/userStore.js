// User Store — IndexedDB for persistent user data, sessions, tokens, security events

const DB_NAME = 'ProofOfLifeDB';
const DB_VERSION = 1;

const STORES = {
    users: 'users',
    sessions: 'sessions',
    securityEvents: 'securityEvents',
};

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORES.users)) {
                const userStore = db.createObjectStore(STORES.users, { keyPath: 'walletAddress' });
                userStore.createIndex('status', 'status', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.sessions)) {
                const sessionStore = db.createObjectStore(STORES.sessions, { keyPath: 'sessionId' });
                sessionStore.createIndex('walletAddress', 'walletAddress', { unique: false });
                sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.securityEvents)) {
                const eventStore = db.createObjectStore(STORES.securityEvents, { keyPath: 'id', autoIncrement: true });
                eventStore.createIndex('walletAddress', 'walletAddress', { unique: false });
                eventStore.createIndex('eventType', 'eventType', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// === User Operations ===

export async function registerUser(walletAddress, faceEncoding, metadata = {}) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.users, 'readwrite');
        const store = tx.objectStore(STORES.users);

        const user = {
            walletAddress,
            faceEncoding,
            encodingMetadata: {
                algorithm: 'face-api.js',
                version: '1.0',
                qualityScore: metadata.qualityScore || 0,
                framesUsed: metadata.framesUsed || 0,
            },
            registrationTimestamp: Date.now(),
            lastVerificationTimestamp: null,
            totalVerifications: 0,
            failedAttempts: 0,
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const request = store.put(user);
        request.onsuccess = () => resolve(user);
        request.onerror = () => reject(request.error);
    });
}

export async function getUser(walletAddress) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.users, 'readonly');
        const store = tx.objectStore(STORES.users);
        const request = store.get(walletAddress);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

export async function isRegistered(walletAddress) {
    const user = await getUser(walletAddress);
    return user !== null && user.status === 'active';
}

export async function updateUserVerification(walletAddress, success) {
    const db = await openDB();
    const user = await getUser(walletAddress);
    if (!user) throw new Error('User not found');

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.users, 'readwrite');
        const store = tx.objectStore(STORES.users);

        user.lastVerificationTimestamp = Date.now();
        user.totalVerifications += 1;
        if (!success) user.failedAttempts += 1;
        user.updatedAt = Date.now();

        const request = store.put(user);
        request.onsuccess = () => resolve(user);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteUser(walletAddress) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.users, 'readwrite');
        const store = tx.objectStore(STORES.users);
        const request = store.delete(walletAddress);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

// === Session Operations ===

export async function addVerificationSession(session) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.sessions, 'readwrite');
        const store = tx.objectStore(STORES.sessions);
        const request = store.put({
            ...session,
            timestamp: Date.now(),
        });
        request.onsuccess = () => resolve(session);
        request.onerror = () => reject(request.error);
    });
}

export async function getVerificationHistory(walletAddress, limit = 10) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.sessions, 'readonly');
        const store = tx.objectStore(STORES.sessions);
        const index = store.index('walletAddress');
        const request = index.getAll(walletAddress);

        request.onsuccess = () => {
            const sessions = request.result
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);
            resolve(sessions);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function getVerificationStats(walletAddress) {
    const history = await getVerificationHistory(walletAddress, 100);
    const successful = history.filter((s) => s.success);
    const avgConfidence = successful.length > 0
        ? successful.reduce((sum, s) => sum + (s.confidenceScore || 0), 0) / successful.length
        : 0;

    return {
        total: history.length,
        successful: successful.length,
        failed: history.length - successful.length,
        successRate: history.length > 0 ? Math.round((successful.length / history.length) * 1000) / 10 : 0,
        averageConfidence: Math.round(avgConfidence * 10) / 10,
        lastVerification: history[0] || null,
    };
}

// === Security Events ===

export async function logSecurityEvent(event) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.securityEvents, 'readwrite');
        const store = tx.objectStore(STORES.securityEvents);
        const request = store.add({
            ...event,
            timestamp: Date.now(),
        });
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}
