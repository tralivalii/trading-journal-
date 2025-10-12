import { useState, useEffect } from 'react';
import { getImage, cacheImageFromUrl } from '../services/imageDB';
import { supabase } from '../services/supabase';
import { useAppContext } from '../services/appState';

const useImageBlobUrl = (imagePath: string | undefined | null): string | null => {
    const { state } = useAppContext();
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        // This effect manages the entire lifecycle of getting a URL for the image.
        // It will also handle cleanup of blob URLs.
        if (!imagePath) {
            setImageUrl(null);
            return;
        }

        let isMounted = true;
        let objectUrlToRevoke: string | null = null;

        const getUrl = async () => {
            try {
                // Priority 1: Check local cache (IndexedDB)
                const localFile = await getImage(imagePath);
                if (isMounted && localFile) {
                    objectUrlToRevoke = URL.createObjectURL(localFile);
                    setImageUrl(objectUrlToRevoke);
                    return; // Found locally, we are done.
                }

                // Priority 2: Fetch from remote (Supabase) if online
                if (isMounted && state.syncStatus === 'online') {
                    const { data, error } = await supabase.storage.from('screenshots').createSignedUrl(imagePath, 3600);
                    
                    if (error) {
                        // This is a likely failure point if the file doesn't exist or RLS fails.
                        console.error(`Supabase createSignedUrl failed for "${imagePath}":`, error);
                        if (isMounted) setImageUrl(null);
                        return;
                    }

                    if (isMounted && data?.signedUrl) {
                        // We have a remote URL. We will use it directly for display.
                        setImageUrl(data.signedUrl);
                        // And we'll try to cache it for next time. This can happen in the background.
                        cacheImageFromUrl(imagePath, data.signedUrl).catch(cacheError => {
                            console.warn("Failed to cache remote image:", cacheError);
                        });
                    }
                } else {
                    // Not found locally and we are offline.
                    if (isMounted) setImageUrl(null);
                }
            } catch (e) {
                console.error(`Exception while fetching/loading image for path "${imagePath}":`, e);
                if (isMounted) setImageUrl(null);
            }
        };

        getUrl();

        return () => {
            isMounted = false;
            // The key part: revoke the blob URL if one was created to prevent memory leaks.
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        };
    }, [imagePath, state.syncStatus]); // Rerun if path or online status changes

    return imageUrl;
};

export default useImageBlobUrl;