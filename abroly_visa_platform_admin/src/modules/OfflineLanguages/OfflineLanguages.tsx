import React, { useState, useEffect } from "react"
import { Plus, Trash2, Edit } from "lucide-react";
import {
    Table,
    TableHeader,
    TableBody,
    TableColumn,
    TableRow,
    TableCell,
    Button,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Input,
    Select,
    SelectItem,
    Switch,
    Chip,
} from "@nextui-org/react";
import useApiCallUtils from "@/hooks/useApiCallUtils";

const OfflineLanguages = () => {
    const { commonGetAPICalls, commonPostAPICall, commonDeleteAPICall } = useApiCallUtils();
    const [languages, setLanguages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionBusy, setActionBusy] = useState(false);
    const [formData, setFormData] = useState({ title: "", is_active: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editUuid, setEditUuid] = useState(null);

    // Fetch language list on mount
    useEffect(() => {
        fetchLanguages();
    }, []);

    const fetchLanguages = async (opts?: { soft?: boolean }) => {
        if (!opts?.soft) setLoading(true);
        try {
            const response = await commonGetAPICalls("/offline-language-prep/list_admin");
            if (response.success) {
                setLanguages(response.data);
            } else {
                console.error(response.message);
            }
        } catch (error) {
            console.error("Error fetching languages:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddOrUpdate = async (e) => {
        e.preventDefault();
        setActionBusy(true);
        try {
            const response = await commonPostAPICall(formData,
                "/offline-language-prep/add",
                true
            );
            if (response.success) {
                fetchLanguages({ soft: true });
                setFormData({ title: "", is_active: 1 });
                setIsModalOpen(false);
                setEditUuid(null);
            } else {
                console.error(response.message);
            }
        } catch (error) {
            console.error("Error adding/updating language:", error);
        } finally {
            setActionBusy(false);
        }
    };

    const handleToggleStatus = async (uuid, currentStatus) => {
        setActionBusy(true);
        setLanguages((prev) =>
            prev.map((lang) =>
                lang.uuid === uuid ? { ...lang, is_active: currentStatus ? 0 : 1 } : lang
            )
        );
        try {
            const response = await commonPostAPICall({
                uuid,
            }, "/offline-language-prep/toggle", true);
            if (!response.success) {
                fetchLanguages({ soft: true });
                console.error(response.message);
            }
        } catch (error) {
            console.error("Error toggling status:", error);
            fetchLanguages({ soft: true });
        } finally {
            setActionBusy(false);
        }
    };

    const handleDelete = async (uuid) => {
        if (!window.confirm("Are you sure you want to delete this language?")) return;
        setActionBusy(true);
        try {
            const response = await commonDeleteAPICall({
                uuid,
            }, "/offline-language-prep/delete", true);
            if (response.success) {
                setLanguages((prev) => prev.filter((lang) => lang.uuid !== uuid));
            } else {
                console.error(response.message);
            }
        } catch (error) {
            console.error("Error deleting language:", error);
        } finally {
            setActionBusy(false);
        }
    };

    const openEditModal = (language) => {
        setFormData({ title: language.title, is_active: language.is_active });
        setEditUuid(language.uuid);
        setIsModalOpen(true);
    };

    return (
        <div className="min-h-scree">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">
                    Offline Language Management
                </h1>
                <Button
                    color="primary"
                    onPress={() => setIsModalOpen(true)}
                    startContent={<Plus size={20} />}
                    className="px-4 py-2"
                >
                    Add Language
                </Button>
            </div>

            {/* Descriptive Text */}
            <p className="text-gray-600 mb-4">
                Manage offline language preparation entries for your Rich CRM. Add, edit,
                toggle, or delete languages to keep your system up-to-date.
            </p>

            {/* NextUI Table */}
            {loading && languages.length === 0 ? (
                <div className="text-center text-gray-500">Loading...</div>
            ) : languages.length === 0 ? (
                <div className="text-center text-gray-500">
                    No languages found. Add one to get started!
                </div>
            ) : (
                <Table aria-label="Offline Languages Table" className="shadow-md rounded-lg">
                    <TableHeader>
                        <TableColumn>Title</TableColumn>
                        <TableColumn>Status</TableColumn>
                        <TableColumn>Created At</TableColumn>
                        <TableColumn>Actions</TableColumn>
                    </TableHeader>
                    <TableBody>
                        {languages.map((language) => (
                            <TableRow key={language.uuid}>
                                <TableCell>{language.title}</TableCell>
                                <TableCell>
                                    <Chip
                                        color={language.is_active ? "success" : "danger"}
                                        variant="flat"
                                    >
                                        {language.is_active ? "Active" : "Inactive"}
                                    </Chip>
                                </TableCell>
                                <TableCell>
                                    {new Date(language.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2">
                                        <Button
                                            isIconOnly
                                            color="warning"
                                            variant="light"
                                            onPress={() => openEditModal(language)}
                                        >
                                            <Edit size={18} />
                                        </Button>
                                        <Switch
                                            isSelected={language.is_active === 1}
                                            onChange={() =>
                                                handleToggleStatus(language.uuid, language.is_active)
                                            }
                                            color="success"
                                            size="sm"
                                        />
                                        <Button
                                            isIconOnly
                                            color="danger"
                                            variant="light"
                                            onPress={() => handleDelete(language.uuid)}
                                        >
                                            <Trash2 size={18} />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {/* NextUI Modal for Add/Edit */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditUuid(null);
                    setFormData({ title: "", is_active: 1 });
                }}
                className="max-w-md"
            >
                <ModalContent>
                    <ModalHeader>
                        <h2 className="text-xl font-semibold">
                            {editUuid ? "Edit Language" : "Add New Language"}
                        </h2>
                    </ModalHeader>
                    <ModalBody>
                        <form onSubmit={handleAddOrUpdate}>
                            <Input
                                label="Language Title"
                                placeholder="Enter language title"
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData({ ...formData, title: e.target.value })
                                }
                                required
                                className="mb-4"
                            />
                            <Select
                                label="Status"
                                value={formData.is_active.toString()}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        is_active: parseInt(e.target.value),
                                    })
                                }
                                defaultSelectedKeys={[formData.is_active.toString()]}
                                className="mb-4"
                            >
                                <SelectItem key="1" value="1">
                                    Active
                                </SelectItem>
                                <SelectItem key="0" value="0">
                                    Inactive
                                </SelectItem>
                            </Select>
                            <ModalFooter>
                                <Button
                                    color="default"
                                    variant="flat"
                                    onPress={() => {
                                        setIsModalOpen(false);
                                        setEditUuid(null);
                                        setFormData({ title: "", is_active: 1 });
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    color="primary"
                                    isLoading={actionBusy}
                                    disabled={actionBusy}
                                >
                                    {actionBusy ? "Saving..." : editUuid ? "Update" : "Add"}
                                </Button>
                            </ModalFooter>
                        </form>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </div>
    );
};

export default OfflineLanguages;