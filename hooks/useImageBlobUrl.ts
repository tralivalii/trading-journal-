import { useState, useEffect } from 'react';
import { getImage } from '../services/imageDB';

const useImageBlobUrl = (imageKey: string | undefined | null): string | null => {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!imageKey) {
            setUrl(null);
            return;
        }

        let isMounted = true;
        let objectUrl: string | null = null;

        const getLocalImage = async () => {
            try {
                const imageBlob = await getImage(imageKey);
                if (isMounted && imageBlob) {
                    objectUrl = URL.createObjectURL(imageBlob);
                    setUrl(objectUrl);
                } else if (isMounted) {
                    setUrl(null);
                }
            } catch (error) {
                console.error("Error loading image from IndexedDB:", error);
                if (isMounted) {
                    setUrl(null);
                }
            }
        };

        getLocalImage();

        return () => {
            isMounted = false;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [imageKey]);

    return url;
};

export default useImageBlobUrl;
