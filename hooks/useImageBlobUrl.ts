import { useState, useEffect } from 'react';
import { getImage, cacheImageFromUrl } from '../services/imageDB';
import { supabase } from '../services/supabase';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

// This hook takes a storage path and resolves it to a usable URL.
// It implements a robust offline-first strategy that works with private buckets.
const useImageBlobUrl = (storagePath: string | undefined | null): ImageState => {
    const [imageState, setImageState] = useState<ImageState>({
        url: null,
        error: false,
        isLoading: true,
    });

    useEffect(() => {
        if (!storagePath) {
            setImageState({ url: null, error: false, isLoading: false });
            return;
        }

        let isMounted = true;
        let objectUrlToRevoke: string | null = null;
        
        setImageState({ url: null, error: false, isLoading: true });

        const getUrl = async () => {
            try {
                // --- Priority 1: Check local cache (IndexedDB) first ---
                const cachedFile = await getImage(storagePath);
                if (isMounted && cachedFile) {
                    objectUrlToRevoke = URL.createObjectURL(cachedFile);
                    setImageState({ url: objectUrlToRevoke, error: false, isLoading: false });
                    return;
                }

                // --- Priority 2: If not in cache, fetch from Supabase Storage using a signed URL ---
                if (!navigator.onLine) {
                    throw new Error("Offline and image not found in cache.");
                }

                // Generate a signed URL. This is the secure method for private buckets.
                // The URL is valid for 1 minute, which is enough time to display and cache it.
                const { data, error: signedUrlError } = await supabase.storage
                    .from('trade-attachments')
                    .createSignedUrl(storagePath, 60); // 60 seconds validity

                if (signedUrlError || !data?.signedUrl) {
                    throw signedUrlError || new Error(`Could not generate signed URL for path: ${storagePath}`);
                }
                
                const signedUrl = data.signedUrl;

                if (isMounted) {
                    // Show the image immediately using the signed URL
                    setImageState({ url: signedUrl, error: false, isLoading: false });
                    
                    // In the background, cache the image for future offline access.
                    // This is a "read-through" cache strategy.
                    cacheImageFromUrl(storagePath, signedUrl);
                }

            } catch (err) {
                console.error(`Failed to load image from path ${storagePath}:`, err);
                if (isMounted) {
                    setImageState({ url: null, error: true, isLoading: false });
                }
            }
        };

        getUrl();

        return () => {
            isMounted = false;
            // Clean up any created blob URL to prevent memory leaks
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        };
    }, [storagePath]);

    return imageState;
};

export default useImageBlobUrl;