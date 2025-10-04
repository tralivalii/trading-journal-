// services/imageDB.ts

const DB_NAME = 'TradingJournalImages';
const STORE_NAME = 'images';
const DB_VERSION = 1;

let db: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        const store = dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_user', 'userEmail', { unique: false });
      }
    };
  });
};

export const saveImage = async (userEmail: string, blob: Blob): Promise<string> => {
  const db = await openDB();
  const id = crypto.randomUUID();
  const data = { id, userEmail, blob };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => {
      resolve(id);
    };
    transaction.onerror = () => {
      reject(transaction.error);
    };
     transaction.onabort = () => {
      reject(transaction.error || new DOMException('Transaction aborted'));
    };

    const store = transaction.objectStore(STORE_NAME);
    store.put(data);
  });
};

export const getImage = async (id: string): Promise<Blob | null> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result ? request.result.blob : null);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteImage = async (id: string): Promise<void> => {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = () => {
            reject(transaction.error);
        };
        transaction.onabort = () => {
            reject(transaction.error || new DOMException('Transaction aborted'));
        };

        const store = transaction.objectStore(STORE_NAME);
        store.delete(id);
    });
}


export const deleteImagesForUser = async (userEmail: string): Promise<void> => {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('by_user');
        const request = index.openKeyCursor(IDBKeyRange.only(userEmail));

        const deletePromises: Promise<void>[] = [];
        
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                const deleteRequest = store.delete(cursor.primaryKey);
                deletePromises.push(new Promise((res, rej) => {
                    deleteRequest.onsuccess = () => res();
                    deleteRequest.onerror = () => rej(deleteRequest.error);
                }));
                cursor.continue();
            }
        };

        transaction.oncomplete = () => {
            Promise.all(deletePromises).then(() => resolve()).catch(reject);
        };
        transaction.onerror = () => reject(transaction.error);
    });
}