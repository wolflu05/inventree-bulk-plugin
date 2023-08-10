export const isEqual = (x: any, y: any): boolean => {
    if (x === y) return true;

    if ((x === null && y !== null) || (x !== null && y === null)) {
        return false;
    }

    if (typeof x !== typeof y) return false;

    if (Array.isArray(x) && Array.isArray(y)) {
        if (x.length !== y.length) return false;

        return x.every((_, i) => isEqual(x[i], y[i]));
    }

    if (x instanceof Date && y instanceof Date) {
        return x.getTime() === y.getTime();
    }

    if (typeof x === "object") {
        const xKeys = Object.keys(x);
        const yKeys = Object.keys(y);
        if (xKeys.length !== yKeys.length) return false;
        return xKeys.every(k => isEqual(x[k], y[k]));
    }

    return false;
};

export const beautifyChildSchema = (childSchema) => {
    const out = { ...childSchema };

    for (const k of ["parent_name_match", "extends"]) {
        if (out[k] === "") {
            delete out[k];
        }
    }

    out.count = childSchema.count.map(c => c || null);
    out.childs = childSchema.childs.map(beautifyChildSchema);

    return out;
};

export const beautifySchema = (schema) => {
    return {
        ...schema,
        templates: schema.templates.map(beautifyChildSchema),
        output: beautifyChildSchema(schema.output)
    }
}

export const getUsedGenerateKeys = (schema) => {
    const keys = new Set();

    const collectKeys = (childSchema) => {
        for (const k of Object.keys(childSchema.generate)) {
            keys.add(k)
        }
        childSchema.childs.forEach(x => collectKeys(x));
    }

    collectKeys(schema.output);
    schema.templates.forEach(x => collectKeys(x));

    return [...keys];
}