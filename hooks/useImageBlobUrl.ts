import { useState, useEffect } from 'react';
import { getImage, cacheImageFromUrl } from '../services/imageDB';
import { supabase } from '../services/supabase';
import { useAppContext } from '../services/appState';

const useImageBlobUrl = (imagePath: string | undefined | null): string | null => {
    const { state } = useAppContext();
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!imagePath) {
            setImageUrl(null);
            return;
        }

        let isMounted = true;
        let objectUrlToRevoke: string | null = null;

        const getUrl = async () => {
            try {
                // Priority 1: Check local cache (IndexedDB). This is the fastest method.
                const localFile = await getImage(imagePath);
                if (isMounted && localFile) {
                    objectUrlToRevoke = URL.createObjectURL(localFile);
                    setImageUrl(objectUrlToRevoke);
                    return; // Found locally, we are done.
                }

                // Priority 2: Not found locally. If online, fetch from remote (Supabase).
                if (isMounted && state.syncStatus === 'online') {
                    const { data, error } = await supabase.storage.from('screenshots').createSignedUrl(imagePath, 3600);
                    
                    if (error) {
                        console.error(`Supabase createSignedUrl failed for "${imagePath}":`, error.message);
                        if (isMounted) setImageUrl(null); // Explicitly set to null on failure
                        return;
                    }

                    if (isMounted && data?.signedUrl) {
                        // We have a remote URL. Use it for immediate display.
                        setImageUrl(data.signedUrl);
                        // In the background, cache this image locally for future offline access.
                        cacheImageFromUrl(imagePath, data.signedUrl);
                    }
                } else {
                    // Not found locally and we are offline. Cannot display the image.
                    if (isMounted) setImageUrl(null);
                }
            } catch (e) {
                console.error(`Exception while fetching image for path "${imagePath}":`, e);
                if (isMounted) setImageUrl(null);
            }
        };

        getUrl();

        return () => {
            isMounted = false;
            // Revoke the blob URL if one was created to prevent memory leaks.
            // Supabase signed URLs do not need to be revoked.
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        };
    }, [imagePath, state.syncStatus]); // Rerun if path or online status changes

    return imageUrl;
};

export default useImageBlobUrl;
