import { useState, useEffect } from 'react';
import { getImage, cacheImageFromUrl } from '../services/imageDB';
import { useAppContext } from '../services/appState';

const useImageBlobUrl = (imageUrl: string | undefined | null): string | null => {
    const { state } = useAppContext();
    const [displayUrl, setDisplayUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!imageUrl) {
            setDisplayUrl(null);
            return;
        }

        let isMounted = true;
        let objectUrlToRevoke: string | null = null;

        const getUrl = async () => {
            // Handle guest/local-only images which use a temporary key
            if (imageUrl.startsWith('local://')) {
                const localFile = await getImage(imageUrl);
                if (isMounted && localFile) {
                    objectUrlToRevoke = URL.createObjectURL(localFile);
                    setDisplayUrl(objectUrlToRevoke);
                } else {
                    setDisplayUrl(null); // Local image not found in cache
                }
                return;
            }

            // Handle public HTTPS URLs from Supabase Storage
            // Priority 1: Check local cache first for instant offline access. The key is the full public URL.
            const cachedFile = await getImage(imageUrl);
            if (isMounted && cachedFile) {
                objectUrlToRevoke = URL.createObjectURL(cachedFile);
                setDisplayUrl(objectUrlToRevoke);
                return; // Found in cache, we're done.
            }

            // Priority 2: Not cached. Use the public URL directly for display.
            if (isMounted) {
                setDisplayUrl(imageUrl);
            }

            // In the background, if we are online, fetch the image and cache it for next time.
            if (state.syncStatus === 'online') {
                // The key and the URL to fetch are the same.
                cacheImageFromUrl(imageUrl, imageUrl);
            }
        };

        getUrl();

        return () => {
            isMounted = false;
            // Revoke the blob URL if one was created to prevent memory leaks.
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        };
    }, [imageUrl, state.syncStatus]); // Rerun if URL or online status changes

    return displayUrl;
};

export default useImageBlobUrl;
