/**
 * The agency panel shares its web address with the agency's student portal
 * (rutvik.techxsolutions.io/agency/ and rutvik.techxsolutions.io/), so both apps see the same
 * localStorage. Both use the same keys (token, website, persist:root, ...), which would make
 * them log each other out. This keeps every localStorage key of the agency panel under its own
 * "agency:" prefix, transparently for the rest of the code (redux-persist included).
 *
 * Imported first in main.tsx so it runs before anything reads storage.
 */
const PREFIX = "agency:";

try {
    const ls = window.localStorage;
    const proto = Object.getPrototypeOf(ls) as Storage;
    const { getItem, setItem, removeItem, clear, key } = proto;
    const ownKeys = () => {
        const out: string[] = [];
        for (let i = 0; i < ls.length; i++) {
            const k = key.call(ls, i);
            if (k && k.startsWith(PREFIX)) out.push(k);
        }
        return out;
    };

    proto.getItem = function (this: Storage, k: string) {
        return this === ls ? getItem.call(this, PREFIX + k) : getItem.call(this, k);
    };
    proto.setItem = function (this: Storage, k: string, v: string) {
        return this === ls ? setItem.call(this, PREFIX + k, v) : setItem.call(this, k, v);
    };
    proto.removeItem = function (this: Storage, k: string) {
        return this === ls ? removeItem.call(this, PREFIX + k) : removeItem.call(this, k);
    };
    // clear() only removes the agency panel's own keys, never the student portal's
    proto.clear = function (this: Storage) {
        if (this !== ls) return clear.call(this);
        ownKeys().forEach((k) => removeItem.call(ls, k));
    };
} catch {
    /* storage blocked (private mode etc.) - nothing to scope */
}

export {};
