import { useState, useEffect } from 'react';
import { getImage, cacheImageFromUrl } from '../services/imageDB';
import { supabase } from '../services/supabase';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

// This hook now takes a storage path instead of a full URL.
// It's responsible for finding the image locally or generating a secure URL to fetch it.
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

                // --- Priority 2: If not in cache, fetch from Supabase Storage ---
                if (!navigator.onLine) {
                    throw new Error("Offline and image not found in cache.");
                }

                // Generate a short-lived signed URL to securely access the private object.
                const { data, error: signedUrlError } = await supabase.storage
                    .from('trade-attachments')
                    .createSignedUrl(storagePath, 300); // URL is valid for 5 minutes

                if (signedUrlError) {
                    throw signedUrlError;
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
            // Clean up the created blob URL to prevent memory leaks
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        };
    }, [storagePath]);

    return imageState;
};

export default useImageBlobUrl;