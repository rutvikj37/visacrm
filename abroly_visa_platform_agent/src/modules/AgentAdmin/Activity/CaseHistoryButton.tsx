import { useEffect, useState } from "react";
import { Button, Drawer, DrawerBody, DrawerContent, DrawerHeader, Spinner, useDisclosure } from "@heroui/react";
import { History } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import HistoryList from "./HistoryList";

/** "History" on a visa case: stage changes, results, steps, documents, invoices and payments - who and when. */
const CaseHistoryButton = ({ caseId }: { caseId: string | number }) => {
    const { commonGetAPICalls } = useApiCallUtils();
    const d = useDisclosure();
    const [entries, setEntries] = useState<any[] | null>(null);
    const [placement, setPlacement] = useState<"right" | "bottom">("right");
    useEffect(() => { setPlacement(window.innerWidth < 640 ? "bottom" : "right"); }, [d.isOpen]);
    useEffect(() => {
        if (!d.isOpen) return;
        setEntries(null);
        (async () => {
            const { success, data } = await commonGetAPICalls(`/crm/cases/${caseId}/history`);
            setEntries(success ? data.entries : []);
        })();
    }, [d.isOpen, caseId]);
    return (
        <>
            <Button size="sm" variant="light" startContent={<History size={14} />} onPress={d.onOpen}>History</Button>
            <Drawer isOpen={d.isOpen} onOpenChange={d.onOpenChange} placement={placement} size={placement === "bottom" ? "lg" : "md"}>
                <DrawerContent>
                    <DrawerHeader className="flex items-center gap-2"><History size={18} /> Case history</DrawerHeader>
                    <DrawerBody className="pb-6">
                        {!entries ? <div className="flex justify-center p-6"><Spinner /></div>
                            : <HistoryList entries={entries} empty="No changes recorded yet. Stage changes, results, steps, documents and payments will show here." />}
                    </DrawerBody>
                </DrawerContent>
            </Drawer>
        </>
    );
};

export default CaseHistoryButton;
