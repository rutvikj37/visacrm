import { Button, Switch } from "@heroui/react";
import { Eye } from "lucide-react";
import { ImageUpload, useOpenPdf } from "../travelActions";
import { Panel, useQuote } from "./QuoteContext";

const THEMES = [
    { key: "classic", title: "Classic", text: "Clean white pages, brand colour accents", swatch: ["bg-white", "bg-primary", "bg-default-200"] },
    { key: "modern", title: "Modern", text: "Bold photo header, rounded cards", swatch: ["bg-zinc-900", "bg-primary", "bg-white"] },
    { key: "elegant", title: "Elegant", text: "Serif headings, soft cream tones", swatch: ["bg-amber-50", "bg-amber-800", "bg-stone-300"] },
];

/** Step 6: how the quote PDF and the customer's web link look, and what they show. */
const StepDesign = () => {
    const { q, set, canEdit, save } = useQuote();
    const openPdf = useOpenPdf();
    const design = q.design || {};
    const setDesign = (patch: Record<string, any>) => set({ design: { ...design, ...patch } });

    return (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-4">
                <Panel title="Theme" sub="Uses your agency logo and brand colour">
                    <div className="grid sm:grid-cols-3 gap-3">
                        {THEMES.map((th) => {
                            const on = (design.theme || "classic") === th.key;
                            return (
                                <button key={th.key} type="button" disabled={!canEdit} onClick={() => setDesign({ theme: th.key })} className={`rounded-2xl border p-3 text-left transition-all ${on ? "border-primary ring-2 ring-primary/30" : "border-default-200 hover:border-default-400"}`}>
                                    <div className="h-20 rounded-xl overflow-hidden border border-default-200 flex flex-col">
                                        <div className={`h-8 ${th.swatch[0]}`} />
                                        <div className="flex-1 flex gap-1 p-1.5 bg-content1"><span className={`w-1/3 rounded ${th.swatch[1]}`} /><span className={`flex-1 rounded ${th.swatch[2]}`} /></div>
                                    </div>
                                    <div className={`mt-2 text-sm font-medium ${on ? "text-primary" : ""}`}>{th.title}</div>
                                    <div className="text-xs text-default-500">{th.text}</div>
                                </button>
                            );
                        })}
                    </div>
                </Panel>
                <Panel title="Header image" sub="Wide photo for the top of the PDF and web link. Day photos are never used here.">
                    {canEdit ? <ImageUpload value={design.cover_image || null} onChange={(url) => setDesign({ cover_image: url })} label="Upload header image" /> : design.cover_image ? <img src={design.cover_image} alt="" className="h-28 rounded-xl object-cover" /> : <p className="text-sm text-default-500">No header image.</p>}
                </Panel>
            </div>
            <div className="flex flex-col gap-4">
                <Panel title="What to show">
                    <div className="flex flex-col gap-4">
                        <Toggle title="Show pricing" text="The total payable and how to pay" on={design.show_price !== false} disabled={!canEdit} onChange={(v) => setDesign({ show_price: v })} />
                        <Toggle title="Price per service" text={design.show_price === false ? "Turn on Show pricing first" : "Amount next to each service"} on={design.show_price !== false && design.show_breakup !== false} disabled={!canEdit || design.show_price === false} onChange={(v) => setDesign({ show_breakup: v })} />
                        <Toggle title="Per-person price" text="Highlight the price per traveller" on={design.show_per_person !== false} disabled={!canEdit || design.show_price === false} onChange={(v) => setDesign({ show_per_person: v })} />
                    </div>
                </Panel>
                <Button color="primary" variant="flat" startContent={<Eye size={16} />} onPress={async () => { if (await save()) openPdf(`travel/quotes/${q.id}/pdf`); }}>Preview PDF</Button>
            </div>
        </div>
    );
};

const Toggle = ({ title, text, on, disabled, onChange }: { title: string; text: string; on: boolean; disabled?: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-start justify-between gap-3">
        <div><div className="text-sm font-medium">{title}</div><div className="text-xs text-default-500">{text}</div></div>
        <Switch size="sm" isDisabled={disabled} isSelected={on} onValueChange={onChange} aria-label={title} />
    </div>
);

export default StepDesign;
