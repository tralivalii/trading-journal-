// FIX: Implemented IndexedDB service for storing and retrieving images for notes.
const DB_NAME = 'TradeJournalImages';
const STORE_NAME = 'screenshots';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const getDb = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject('Error opening IndexedDB.');
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = () => {
                resolve(request.result);
            };
        });
    }
    return dbPromise;
};

export async function saveImage(userId: string, file: File): Promise<string> {
    const db = await getDb();
    const key = `${userId}-${crypto.randomUUID()}-${file.name}`;

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(file, key);

        transaction.oncomplete = () => resolve(key);
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function getImage(key: string): Promise<Blob | undefined> {
    if (!key) return undefined;
    const db = await getDb();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result as Blob | undefined);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function deleteImage(key: string): Promise<void> {
    if (!key) return;
    const db = await getDb();

    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete(key);

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
