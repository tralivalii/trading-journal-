// utils/caseConverter.ts

function toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function convertToSnakeCase(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(v => convertToSnakeCase(v));
    } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
        return Object.keys(obj).reduce((acc, key) => {
            acc[toSnakeCase(key)] = convertToSnakeCase(obj[key]);
            return acc;
        }, {} as any);
    }
    return obj;
}
