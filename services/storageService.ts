import { supabase } from './supabase';

const BUCKET_NAME = 'screenshots';

/**
 * Uploads an image to the Supabase storage bucket.
 * @param file The file to upload.
 * @param userId The ID of the user uploading the file.
 * @returns The storage path of the uploaded file.
 */
export const uploadImage = async (file: File, userId: string): Promise<string> => {
    try {
        const fileExtension = file.name.split('.').pop();
        const newFileName = `${crypto.randomUUID()}.${fileExtension}`;
        const storagePath = `${userId}/${newFileName}`;

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, file, {
                upsert: true, // Overwrite file if it exists, useful for retries
            });

        if (error) {
            console.error("Supabase upload error:", error);
            throw new Error(`Upload failed: ${error.message}`);
        }

        return storagePath;
    } catch (error) {
        console.error("Error in uploadImage service:", error);
        // Re-throw the error to be handled by the calling component
        throw error;
    }
};

/**
 * Generates a signed URL for a private image.
 * @param path The storage path of the file.
 * @returns A temporary URL to access the image, or null if an error occurs.
 */
export const getImageUrl = async (path: string | null | undefined): Promise<string | null> => {
    if (!path) {
        return null;
    }
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(path, 60 * 5); // URL valid for 5 minutes

        if (error) {
            console.error('Error creating signed URL:', error);
            return null;
        }
        return data.signedUrl;
    } catch (error) {
        console.error('Error in getImageUrl service:', error);
        return null;
    }
};

/**
 * Deletes an image from the Supabase storage bucket.
 * @param path The storage path of the file to delete.
 */
export const deleteImage = async (path: string | null | undefined): Promise<void> => {
    if (!path) {
        return;
    }
    try {
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([path]);

        if (error) {
            console.error('Error deleting image from storage:', error);
        }
    } catch (error) {
        console.error('Error in deleteImage service:', error);
    }
};