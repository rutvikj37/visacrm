/**
 * MySQL returns JSON columns as objects, MariaDB returns them as strings.
 * Use this getter so models behave the same on both.
 */
export const parseJsonValue = (value: any) => {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

export const jsonGetter = (field: string) => function (this: any) {
    return parseJsonValue(this.getDataValue(field));
};
