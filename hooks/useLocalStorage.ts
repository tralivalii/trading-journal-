import { useState, useEffect, Dispatch, SetStateAction } from 'react';

function useLocalStorage<T>(key: string, initialValue: T, userIdentifier?: string | null): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = userIdentifier ? `${userIdentifier}_${key}` : key;

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(storageKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  // Re-initialize state when the storageKey changes (e.g., user logs in/out)
  useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            const item = window.localStorage.getItem(storageKey);
            setStoredValue(item ? JSON.parse(item) : initialValue);
        } catch (error) {
            console.log(error);
            setStoredValue(initialValue);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === storageKey) {
             try {
                const item = window.localStorage.getItem(storageKey);
                setStoredValue(item ? JSON.parse(item) : initialValue);
            } catch (error) {
                console.log(error);
                setStoredValue(initialValue);
            }
        }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, initialValue]);

  return [storedValue, setValue];
}

export default useLocalStorage;