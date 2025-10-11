// services/offlineService.ts
import { DBSchema, openDB, IDBPDatabase } from 'idb';
import { Trade, Account, Note } from '../types';

const DB_NAME = 'TradingJournalDB';
const DB_VERSION = 1;

// Define the shape of the database
interface JournalDB extends DBSchema {
  trades: {
    key: string;
    value: Trade;
  };
  accounts: {
    key: string;
    value: Account;
  };
  notes: {
    key: string;
    value: Note;
  };
  settings: {
      key: string;
      value: any;
  };
  sync_queue: {
      key: string;
      value: {
          id: string;
          type: 'trade' | 'account' | 'note' | 'settings';
          action: 'create' | 'update' | 'delete';
          payload: any;
          timestamp: number;
      };
  };
}

let dbPromise: Promise<IDBPDatabase<JournalDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<JournalDB>> => {    
    if (!dbPromise) {
        dbPromise = openDB<JournalDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('trades')) {
                    db.createObjectStore('trades', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('accounts')) {
                    db.createObjectStore('accounts', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('notes')) {
                    db.createObjectStore('notes', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('sync_queue')) {
                    db.createObjectStore('sync_queue', { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
};

// Generic function to get all items from a table
export async function getTable<T>(tableName: keyof JournalDB): Promise<T[]> {
    const db = await getDb();
    return db.getAll(tableName as any) as Promise<T[]>;
}

// Generic function to put multiple items into a table
export async function bulkPut<T extends { id: string }>(
    tableName: keyof JournalDB,
    items: T[]
): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(tableName as any, 'readwrite');
    await Promise.all(items.map(item => tx.store.put(item)));
    await tx.done;
}

// FIX: Added deleteItem function to remove a single record from a table.
export async function deleteItem(tableName: keyof JournalDB, key: string): Promise<void> {
    const db = await getDb();
    await db.delete(tableName as any, key);
}

// Get all items in the sync queue
export async function getSyncQueue(): Promise<JournalDB['sync_queue']['value'][]> {
    const db = await getDb();
    return db.getAll('sync_queue');
}

// Add an item to the sync queue
export async function putSyncQueue(item: JournalDB['sync_queue']['value']): Promise<void> {
    const db = await getDb();
    await db.put('sync_queue', item);
}

// Clear the entire sync queue
export async function clearSyncQueue(): Promise<void> {
    const db = await getDb();
    await db.clear('sync_queue');
}

export async function clearAllData(): Promise<void> {
    const db = await getDb();
    await Promise.all([
        db.clear('trades'),
        db.clear('accounts'),
        db.clear('notes'),
        db.clear('settings'),
        db.clear('sync_queue'),
    ]);
}

// Generic function to get a single item by key
export async function bulkGet<T>(
  tableName: keyof JournalDB,
  keys: string[]
): Promise<(T | undefined)[]> {
  const db = await getDb();
  const tx = db.transaction(tableName as any, 'readonly');
  const results = await Promise.all(keys.map(key => tx.store.get(key)));
  await tx.done;
  return results as (T | undefined)[];
}