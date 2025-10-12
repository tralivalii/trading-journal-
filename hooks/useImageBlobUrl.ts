import { useState, useEffect } from 'react';
import { getImage, cacheImageFromUrl } from '../services/imageDB';
import { supabase } from '../services/supabase';
import { useAppContext } from '../services/appState';

const useImageBlobUrl = (imagePath: string | undefined | null): string | null => {
    const { state } = useAppContext();
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!imagePath) {
            setUrl(null);
            return;
        }

        let isMounted = true;
        let objectUrl: string | null = null;

        const getUrl = async () => {
            try {
                // 1. Try to get from local DB (IndexedDB)
                const imageFile = await getImage(imagePath);
                if (isMounted && imageFile) {
                    objectUrl = URL.createObjectURL(imageFile);
                    setUrl(objectUrl);
                    return; // Found locally, we're done.
                }
                
                // 2. Not found locally, try to get from remote (Supabase) if online
                if (isMounted && state.syncStatus === 'online') {
                    const { data, error } = await supabase.storage.from('screenshots').createSignedUrl(imagePath, 3600); // 1 hour expiry
                    if (error) {
                        // Don't throw, just log, as it might be a new upload not yet synced.
                        console.warn(`Could not get signed URL for "${imagePath}": ${error.message}`);
                        setUrl(null);
                        return;
                    }
                    if (isMounted && data?.signedUrl) {
                        setUrl(data.signedUrl);
                        // 3. Cache the remote image locally for future offline access
                        await cacheImageFromUrl(imagePath, data.signedUrl);
                    }
                }

            } catch (error) {
                console.error(`Error loading image for path "${imagePath}":`, error);
                if (isMounted) {
                    setUrl(null); // Set to null on any error
                }
            }
        };

        getUrl();

        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [imagePath, state.syncStatus]);

    return url;
};

export default useImageBlobUrl;