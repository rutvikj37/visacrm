import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from "@heroui/react";
import FormField from "./FormField";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { ErrorToast, SuccessToast } from "@/utils/Toaster";

interface Props {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    team?: any[];
    canAssign?: boolean;
    onImported: () => void;
}

const TEMPLATE =
    "Name,Phone,Country Code,Email,City,Country,Course,Visa Type,Intake,Message,Campaign,Tags\n" +
    "Rahul Sharma,9876543210,+91,rahul@example.com,Ahmedabad,Canada,MBA,Student Visa,Sep 2026,Wants IELTS help too,Diwali Offer,hot\n";

const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
};

const ImportLeadsModal = ({ isOpen, onOpenChange, team = [], canAssign = false, onImported }: Props) => {
    const { commonPostAPICallWithFile } = useApiCallUtils();
    const fileRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [assignedTo, setAssignedTo] = useState("");
    const [tags, setTags] = useState("");
    const [uploading, setUploading] = useState(false);
    const [summary, setSummary] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            setFile(null);
            setSummary(null);
            setAssignedTo("");
            setTags("");
        }
    }, [isOpen]);

    const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0] || null;
        if (picked && !/\.(csv|xlsx)$/i.test(picked.name)) {
            ErrorToast("Please choose a .csv or .xlsx file");
            return;
        }
        if (picked && picked.size > 5 * 1024 * 1024) {
            ErrorToast("File is too big (max 5 MB)");
            return;
        }
        setFile(picked);
        setSummary(null);
    };

    const upload = async () => {
        if (!file) {
            ErrorToast("Please choose a file");
            return;
        }
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        if (canAssign && assignedTo) formData.append("assigned_to", assignedTo);
        if (tags.trim()) formData.append("tags", tags.trim());
        const { success, data } = await commonPostAPICallWithFile(formData, "crm/leads/import");
        setUploading(false);
        if (success) {
            setSummary(data);
            SuccessToast(`${data?.created || 0} new lead(s) imported`);
            onImported();
        }
    };

    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="xl" scrollBehavior="inside">
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader>Import leads from CSV / Excel</ModalHeader>
                        <ModalBody>
                            <p className="text-sm text-default-500">
                                Upload a .csv or .xlsx file (max 5,000 rows). We match columns like <b>Name</b>, <b>Phone / Mobile</b>,{" "}
                                <b>Email</b>, <b>Country</b>, <b>Course</b> automatically. Exports from Facebook, Google Sheets and other
                                CRMs usually work as they are. People already in your leads are merged, not duplicated.
                            </p>
                            <Button size="sm" variant="flat" startContent={<Download size={16} />} onPress={downloadTemplate} className="self-start">
                                Download sample file
                            </Button>

                            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={onPick} />
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="border-2 border-dashed border-default-300 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary transition-colors"
                            >
                                {file ? <FileSpreadsheet size={28} /> : <Upload size={28} />}
                                <span className="text-sm font-medium break-all">{file ? file.name : "Click to choose a file"}</span>
                            </button>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {canAssign && team.length > 0 && (
                                    <FormField label="Assign all to (optional)"><Select aria-label="Assign all to (optional)" selectedKeys={assignedTo ? [assignedTo] : []} onChange={(e) => setAssignedTo(e.target.value)}>
                                        {team.map((m: any) => <SelectItem key={String(m.id)}>{m.username || `#${m.id}`}</SelectItem>)}
                                    </Select></FormField>
                                )}
                                <FormField label="Add tags (optional)"><Input aria-label="Add tags (optional)" placeholder="e.g. expo-2026" value={tags} onValueChange={setTags} /></FormField>
                            </div>

                            {summary && (
                                <div className="rounded-xl bg-default-100 p-4 text-sm space-y-1">
                                    <div><b>{summary.created}</b> new lead(s) added</div>
                                    <div><b>{summary.duplicates}</b> already existed (merged as re-enquiry)</div>
                                    <div><b>{summary.failed}</b> row(s) skipped</div>
                                    {summary.errors?.length > 0 && (
                                        <ul className="list-disc ml-5 text-danger">
                                            {summary.errors.slice(0, 10).map((e: any) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
                                        </ul>
                                    )}
                                    {summary.unmapped_columns?.length > 0 && (
                                        <div className="text-default-500">Kept as extra info: {summary.unmapped_columns.join(", ")}</div>
                                    )}
                                </div>
                            )}
                        </ModalBody>
                        <ModalFooter>
                            <Button variant="light" onPress={onClose}>{summary ? "Close" : "Cancel"}</Button>
                            <Button color="primary" isLoading={uploading} isDisabled={!file} onPress={upload}>Import</Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

export default ImportLeadsModal;
