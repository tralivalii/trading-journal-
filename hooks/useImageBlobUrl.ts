import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

/**
 * A hook to get the public URL for an image from Supabase Storage.
 * This assumes the 'trade-attachments' bucket is public.
 * @param storagePath The path to the file in the storage bucket (e.g., "user-id/image.png").
 * @returns An object with the public URL, loading state, and error state.
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
        
        // Handle old blob URLs that might still be in the data from the previous offline implementation
        if (storagePath.startsWith('blob:')) {
            setImageState({ url: storagePath, error: false, isLoading: false });
            return;
        }

        let isMounted = true;
        setImageState({ url: null, error: false, isLoading: true });

        const getPublicUrl = () => {
            try {
                const { data } = supabase.storage
                    .from('trade-attachments')
                    .getPublicUrl(storagePath);

                if (isMounted) {
                    setImageState({ url: data.publicUrl, error: false, isLoading: false });
                }
            } catch (err) {
                console.error(`Failed to get public URL for ${storagePath}:`, err);
                if (isMounted) {
                    setImageState({ url: null, error: true, isLoading: false });
                }
            }
        };

        getPublicUrl();

        return () => {
            isMounted = false;
        };
    }, [storagePath]);

    return imageState;
};

export default useImageBlobUrl;