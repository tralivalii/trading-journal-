// services/imageDB.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'TradeJournalImagesDB';
const STORE_NAME = 'screenshots';
const DB_VERSION = 1;

interface ImageDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: File;
  };
}

let dbPromise: Promise<IDBPDatabase<ImageDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<ImageDB>> => {
    if (!dbPromise) {
        dbPromise = openDB<ImageDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    }
    return dbPromise;
};

export async function saveImage(userId: string, file: File): Promise<string> {
    const db = await getDb();
    const key = `${userId}-${crypto.randomUUID()}-${file.name}`;
    await db.put(STORE_NAME, file, key);
    return key;
}

export async function getImage(key: string | undefined | null): Promise<File | undefined> {
    if (!key) return undefined;
    const db = await getDb();
    return db.get(STORE_NAME, key);
}

export async function deleteImage(key: string | undefined | null): Promise<void> {
    if (!key) return;
    const db = await getDb();
    await db.delete(STORE_NAME, key);
}
