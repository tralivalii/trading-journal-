import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

/**
 * A hook to get a signed URL for an image from a private Supabase Storage bucket.
 * @param storagePath The path to the file in the storage bucket (e.g., "user-id/image.png").
 * @returns An object with the signed URL, loading state, and error state.
 */
const useImageBlobUrl = (storagePath: string | undefined | null): ImageState => {
    const [imageState, setImageState] = useState<ImageState>({
        url: null,
        error: false,
        isLoading: true,
    });

    useEffect(() => {
        // If there's no path, we're done.
        if (!storagePath) {
            setImageState({ url: null, error: false, isLoading: false });
            return;
        }
        
        // Handle old blob URLs from the previous offline implementation for backward compatibility.
        if (storagePath.startsWith('blob:')) {
            setImageState({ url: storagePath, error: false, isLoading: false });
            return;
        }

        let isMounted = true;
        setImageState({ url: null, error: false, isLoading: true });

        const getSignedUrl = async () => {
            try {
                // Use createSignedUrl for private buckets. The URL is valid for 5 minutes.
                const { data, error } = await supabase.storage
                    .from('trade-attachments')
                    .createSignedUrl(storagePath, 300); // 300 seconds = 5 minutes

                if (error) {
                    throw error;
                }

                if (isMounted) {
                    setImageState({ url: data.signedUrl, error: false, isLoading: false });
                }
            } catch (err) {
                console.error(`Failed to get signed URL for ${storagePath}:`, err);
                if (isMounted) {
                    setImageState({ url: null, error: true, isLoading: false });
                }
            }
        };

        getSignedUrl();

        return () => {
            isMounted = false;
        };
    }, [storagePath]);

    return imageState;
};

export default useImageBlobUrl;