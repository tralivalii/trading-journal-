import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

/**
 * A simplified, online-only hook to get a secure, temporary URL for an image from Supabase Storage.
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
        if (!storagePath) {
            setImageState({ url: null, error: false, isLoading: false });
            return;
        }

        let isMounted = true;
        setImageState({ url: null, error: false, isLoading: true });

        const getSignedUrl = async () => {
            try {
                // Generate a signed URL valid for 1 hour. This is the secure method for private buckets.
                const { data, error } = await supabase.storage
                    .from('trade-attachments')
                    .createSignedUrl(storagePath, 3600); // 1 hour validity

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