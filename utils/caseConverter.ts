// utils/caseConverter.ts

const toSnakeCase = (str: string): string => {
    // Handles cases like 'userID' -> 'user_id' and 'someURL' -> 'some_url'
    return str.replace(/[A-Z]/g, (letter, index) => {
        return index === 0 ? letter.toLowerCase() : `_${letter.toLowerCase()}`;
    });
};

const toCamelCase = (str: string): string => {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

const convertKeys = (obj: any, converter: (key: string) => string): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeys(v, converter));
    } else if (obj !== null && obj.constructor === Object) { // Ensure it's a plain object
        return Object.keys(obj).reduce((acc, key) => {
            const newKey = converter(key);
            acc[newKey] = convertKeys(obj[key], converter);
            return acc;
        }, {} as any);
    }
    return obj;
};

export const caseConverter = {
    toSnake: (obj: any): any => convertKeys(obj, toSnakeCase),
    toCamel: (obj: any): any => convertKeys(obj, toCamelCase),
};
