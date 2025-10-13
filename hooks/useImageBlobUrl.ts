import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

interface ImageState {
    url: string | null;
    error: boolean;
    isLoading: boolean;
}

/**
 * A hook to get a public URL for an image from Supabase Storage.
 * This assumes the 'trade-attachments' bucket is public.
 * @param storagePath The path to the file in the storage bucket (e.g., "user-id/image.png").
 * @returns An object with the public URL, loading state, and error state.
 */
const useImageBlobUrl = (storagePath: string | undefined | null): ImageState => {
    const [imageState, setImageState] = useState<ImageState>({
        url: null,
        error: false,
        isLoading: true, // Start with loading true
    });

    useEffect(() => {
        if (storagePath) {
            // This hook now assumes all images are stored in Supabase Storage and the bucket is public.
            // Remnants of blob URL logic for offline mode have been removed.
            const { data } = supabase.storage
                .from('trade-attachments')
                .getPublicUrl(storagePath);
            
            setImageState({ url: data.publicUrl, isLoading: false, error: false });
        } else {
            // If there's no path, we're done loading and there's no URL.
            setImageState({ url: null, isLoading: false, error: false });
        }
    }, [storagePath]);

    return imageState;
};

export default useImageBlobUrl;
