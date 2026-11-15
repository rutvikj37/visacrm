import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Kbd, Modal, ModalBody, ModalContent, Spinner } from "@heroui/react";
import { FileText, Inbox, Search, UserRound } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const ICON: Record<string, any> = { lead: Inbox, case: UserRound, invoice: FileText };
const LABEL: Record<string, string> = { lead: "Lead", case: "Student", invoice: "Invoice" };

/** Find a lead, student (visa case) or invoice by name, phone, email or invoice number. Ctrl/Cmd+K opens it. */
const GlobalSearch = () => {
    const navigate = useNavigate();
    const { commonGetAPICalls } = useApiCallUtils();
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(0);
    const seq = useRef(0);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
        };
        const onOpen = () => setOpen(true); // "/" shortcut (KeyboardShortcuts)
        window.addEventListener("keydown", onKey);
        window.addEventListener("open-search", onOpen);
        return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-search", onOpen); };
    }, []);

    useEffect(() => {
        if (!open) { setQ(""); setResults([]); return; }
    }, [open]);

    useEffect(() => {
        const term = q.trim();
        if (term.length < 2) { setResults([]); return; }
        const id = ++seq.current;
        setLoading(true);
        const t = setTimeout(async () => {
            const { success, data } = await commonGetAPICalls(`/crm/search?q=${encodeURIComponent(term)}`);
            if (id !== seq.current) return; // a newer search is running
            setResults(success ? data?.results || [] : []);
            setActive(0);
            setLoading(false);
        }, 250);
        return () => clearTimeout(t);
    }, [q]);

    const go = (r: any) => { setOpen(false); navigate(r.link); };

    return (
        <>
            <Button variant="flat" size="sm" onPress={() => setOpen(true)} aria-label="Search"
                className="max-sm:min-w-9 max-sm:w-9 max-sm:px-0 sm:w-56 sm:justify-start text-default-500" startContent={<Search size={16} />}>
                <span className="max-sm:hidden">Search...</span>
                <Kbd className="max-sm:hidden ml-auto" keys={["command"]}>K</Kbd>
            </Button>
            <Modal isOpen={open} onOpenChange={setOpen} placement="top" size="xl" hideCloseButton>
                <ModalContent>
                    <ModalBody className="p-3 gap-2">
                        <Input autoFocus aria-label="Search" placeholder="Name, phone, email or invoice number" startContent={<Search size={16} />}
                            endContent={loading ? <Spinner size="sm" /> : null} value={q} onValueChange={setQ}
                            onKeyDown={(e) => {
                                // one Escape closes the search (the input would otherwise only clear its text first)
                                if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
                                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
                                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                                if (e.key === "Enter" && results[active]) go(results[active]);
                            }} />
                        <div className="max-h-[60vh] overflow-y-auto flex flex-col">
                            {q.trim().length < 2 && <div className="text-sm text-default-500 px-2 py-3">Type at least 2 letters or 4 digits of a phone number.</div>}
                            {q.trim().length >= 2 && !loading && !results.length && <div className="text-sm text-default-500 px-2 py-3">Nothing found for "{q}".</div>}
                            {results.map((r, i) => {
                                const Icon = ICON[r.type] || Search;
                                return (
                                    <button key={`${r.type}-${r.link}`} type="button" onMouseEnter={() => setActive(i)} onClick={() => go(r)}
                                        className={`flex items-center gap-3 rounded-lg px-2 py-2 text-left ${i === active ? "bg-primary-50" : ""}`}>
                                        <Icon size={18} className="text-default-500 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium truncate">{r.title}</div>
                                            <div className="text-xs text-default-500 truncate">{r.subtitle}</div>
                                        </div>
                                        <span className="text-[11px] text-default-400 shrink-0">{LABEL[r.type]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </>
    );
};

export default GlobalSearch;
