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

export async function saveImage(key: string, file: File): Promise<void> {
    const db = await getDb();
    await db.put(STORE_NAME, file, key);
}

// New function to download and cache an image from a URL
export async function cacheImageFromUrl(key: string, url: string): Promise<void> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image for caching: ${response.statusText}`);
        }
        const blob = await response.blob();
        // Convert blob to file to match the DB schema type
        const file = new File([blob], key.split('/').pop() || 'cached-image', { type: blob.type });
        await saveImage(key, file);
    } catch (error) {
        console.error("Failed to cache image:", error);
        // Do not re-throw, as caching is a background enhancement, not a critical failure.
    }
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