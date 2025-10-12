// services/imageDB.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'TradeJournalImagesDB';
const STORE_NAME = 'screenshots';
const DB_VERSION = 2; // Bump version to trigger schema upgrade

// Define the shape of the data we will store
interface StoredImage {
    arrayBuffer: ArrayBuffer;
    type: string;
    name: string;
}

interface ImageDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: StoredImage; // The value is now a structured object, not a File
  };
}

let dbPromise: Promise<IDBPDatabase<ImageDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<ImageDB>> => {
    if (!dbPromise) {
        dbPromise = openDB<ImageDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                // This migration handles the change from storing File objects to StoredImage objects.
                // The simplest and safest migration is to delete the old store and create a new one.
                // Existing images will be re-cached from the cloud as needed.
                if (oldVersion < 2) {
                    if (db.objectStoreNames.contains(STORE_NAME)) {
                        db.deleteObjectStore(STORE_NAME);
                    }
                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    }
    return dbPromise;
};

/**
 * Saves a File to IndexedDB by converting it to a more stable ArrayBuffer format.
 * @param key The unique identifier for the image (usually its storage path).
 * @param file The File object to save.
 */
export async function saveImage(key: string, file: File): Promise<void> {
    const db = await getDb();
    const storedImage: StoredImage = {
        arrayBuffer: await file.arrayBuffer(), // Convert file to ArrayBuffer
        type: file.type,
        name: file.name,
    };
    await db.put(STORE_NAME, storedImage, key);
}

/**
 * Downloads an image from a URL and caches it locally using the robust saveImage function.
 * @param key The key to store the cached image under.
 * @param url The URL to download the image from.
 */
export async function cacheImageFromUrl(key: string, url: string): Promise<void> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image for caching: ${response.statusText}`);
        }
        const blob = await response.blob();
        const file = new File([blob], key.split('/').pop() || 'cached-image', { type: blob.type });
        await saveImage(key, file); // Uses the new, robust saving mechanism
    } catch (error) {
        console.error("Failed to cache image:", error);
    }
}

/**
 * Retrieves an image from IndexedDB and reconstructs it into a File object.
 * @param key The unique identifier for the image.
 * @returns A Promise that resolves to a File object, or undefined if not found.
 */
export async function getImage(key: string | undefined | null): Promise<File | undefined> {
    if (!key) return undefined;
    const db = await getDb();
    const storedImage = await db.get(STORE_NAME, key);
    if (storedImage) {
        // Reconstruct the File object from the stored ArrayBuffer
        return new File([storedImage.arrayBuffer], storedImage.name, { type: storedImage.type });
    }
    return undefined;
}

/**
 * Deletes an image from the local IndexedDB cache.
 * @param key The unique identifier for the image to delete.
 */
export async function deleteImage(key: string | undefined | null): Promise<void> {
    if (!key) return;
    const db = await getDb();
    await db.delete(STORE_NAME, key);
}
