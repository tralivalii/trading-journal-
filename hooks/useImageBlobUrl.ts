import { useState, useEffect } from 'react';
import { getImage, cacheImageFromUrl } from '../services/imageDB';
import { supabase } from '../services/supabase';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

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
                // --- Online-First Strategy ---
                if (navigator.onLine) {
                    // Fetch a fresh signed URL from Supabase for online users.
                    const { data, error: signedUrlError } = await supabase.storage
                        .from('trade-attachments')
                        .createSignedUrl(storagePath, 300); // 5-minute validity

                    if (signedUrlError) throw signedUrlError;
                    
                    const signedUrl = data.signedUrl;

                    if (isMounted) {
                        // Display image immediately with the fresh URL
                        setImageState({ url: signedUrl, error: false, isLoading: false });
                        // Asynchronously update the local cache for future offline use.
                        cacheImageFromUrl(storagePath, signedUrl).catch(err => {
                            console.warn("Failed to cache image in background:", err);
                        });
                    }
                } else {
                    // --- Offline Fallback ---
                    // Try to find the image in the local cache (IndexedDB).
                    const cachedFile = await getImage(storagePath);
                    if (isMounted && cachedFile) {
                        objectUrlToRevoke = URL.createObjectURL(cachedFile);
                        setImageState({ url: objectUrlToRevoke, error: false, isLoading: false });
                    } else {
                        // If offline and not in cache, we can't display it.
                        throw new Error("Offline and image not found in cache.");
                    }
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
            if (objectUrlToRevoke) {
                URL.revokeObjectURL(objectUrlToRevoke);
            }
        };
    }, [storagePath]);

    return imageState;
};

export default useImageBlobUrl;