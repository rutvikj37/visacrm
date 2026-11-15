import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@heroui/react";

type Member = { id: number; username?: string | null };

/** Textarea that offers a teammate picker when you type @. */
const MentionComposer = ({
    value,
    onChange,
    onMentionsChange,
    team,
    placeholder,
    minRows = 2,
    "aria-label": ariaLabel,
}: {
    value: string;
    onChange: (v: string) => void;
    onMentionsChange?: (ids: number[]) => void;
    team: Member[];
    placeholder?: string;
    minRows?: number;
    "aria-label"?: string;
}) => {
    const [query, setQuery] = useState<string | null>(null);
    const [picked, setPicked] = useState<Member[]>([]);
    const boxRef = useRef<HTMLDivElement>(null);

    const people = useMemo(
        () => team.filter((m) => m.id && String(m.username || "").trim()),
        [team],
    );

    const matches = useMemo(() => {
        if (query === null) return [];
        const q = query.toLowerCase();
        return people
            .filter((p) => !q || String(p.username).toLowerCase().includes(q))
            .slice(0, 6);
    }, [people, query]);

    useEffect(() => {
        onMentionsChange?.(picked.map((p) => p.id));
    }, [picked]);

    const detectAt = (text: string, caret: number) => {
        const before = text.slice(0, caret);
        const m = before.match(/@([A-Za-z0-9._\-]*)$/);
        setQuery(m ? m[1] : null);
    };

    const insert = (member: Member) => {
        const name = String(member.username).trim();
        const el = boxRef.current?.querySelector("textarea") as HTMLTextAreaElement | null;
        const caret = el?.selectionStart ?? value.length;
        const before = value.slice(0, caret);
        const after = value.slice(caret);
        const replaced = before.replace(/@([A-Za-z0-9._\-]*)$/, `@${name} `);
        onChange(replaced + after);
        setPicked((list) => (list.some((x) => x.id === member.id) ? list : [...list, member]));
        setQuery(null);
        requestAnimationFrame(() => {
            if (!el) return;
            const pos = replaced.length;
            el.focus();
            el.setSelectionRange(pos, pos);
        });
    };

    return (
        <div className="relative" ref={boxRef}>
            <Textarea
                aria-label={ariaLabel || "Note"}
                placeholder={placeholder}
                value={value}
                minRows={minRows}
                onValueChange={(v) => {
                    onChange(v);
                    // drop mentions removed from the text
                    setPicked((list) => list.filter((m) => v.toLowerCase().includes(`@${String(m.username).toLowerCase()}`)));
                }}
                onKeyUp={(e) => detectAt((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
                onClick={(e) => detectAt((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart)}
            />
            {query !== null && matches.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 bottom-full mb-1 max-h-40 overflow-y-auto rounded-lg border border-default-200 bg-content1 shadow-md py-1">
                    {matches.map((m) => (
                        <li key={m.id}>
                            <button
                                type="button"
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-default-100"
                                onMouseDown={(e) => { e.preventDefault(); insert(m); }}
                            >
                                @{m.username}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

/** Render note text with @names highlighted. */
export const MentionText = ({ text }: { text?: string | null }) => {
    if (!text) return null;
    const parts = String(text).split(/(@[A-Za-z0-9._\-]+)/g);
    return (
        <p className="text-sm text-default-700 whitespace-pre-wrap break-words">
            {parts.map((part, i) =>
                part.startsWith("@") ? (
                    <span key={i} className="text-primary font-medium">{part}</span>
                ) : (
                    <span key={i}>{part}</span>
                ),
            )}
        </p>
    );
};

export default MentionComposer;
