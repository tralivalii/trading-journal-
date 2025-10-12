import { useState, useEffect } from 'react';
import { getImage, cacheImageFromUrl } from '../services/imageDB';
import { supabase } from '../services/supabase';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

// This hook takes a storage path and resolves it to a usable URL.
// It implements a robust offline-first strategy.
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

                // --- Priority 2: If not in cache, fetch from Supabase Storage using a public URL ---
                if (!navigator.onLine) {
                    throw new Error("Offline and image not found in cache.");
                }

                // Generate the public URL. This is the standard way for publicly readable buckets.
                const { data } = supabase.storage
                    .from('trade-attachments')
                    .getPublicUrl(storagePath);

                if (!data || !data.publicUrl) {
                    throw new Error(`Could not generate public URL for path: ${storagePath}`);
                }
                
                const publicUrl = data.publicUrl;

                if (isMounted) {
                    // Show the image immediately using the public URL
                    setImageState({ url: publicUrl, error: false, isLoading: false });
                    
                    // In the background, cache the image for future offline access.
                    // This is a "read-through" cache strategy.
                    cacheImageFromUrl(storagePath, publicUrl);
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