import React, { useEffect, useState } from "react";
import {
    Button,
    Input,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Textarea,
    Switch,
    useDisclosure,
} from "@nextui-org/react";
import { MdDelete, MdEdit } from "react-icons/md";
import { commonGetAPICalls, commonPostAPICall } from "../../utils/ApiCallUtils";
import CommonConfirmation from "../../components/CommonConfirmation";
import { ErrorToast } from "@/utils/Toaster";

const AccommodationManagement = () => {
    const [accommodations, setAccommodations] = useState([]);

    const [newImageURL, setNewImageURL] = useState("");

    // Fetch accommodations list
    useEffect(() => {
        fetchAccommodations();
    }, []);

    const fetchAccommodations = async () => {
        const { data, success } = await commonGetAPICalls("/accommodation/list");
        if (success) {
            setAccommodations(data);
        }
    };

    // Add modal state and handlers
    const { isOpen: isAddOpen, onOpenChange: toggleAddModal } = useDisclosure();
    const [newAccommodation, setNewAccommodation] = useState({
        company_name: "",
        short_description: "",
        link: "",
        images: [],
        is_destination_confirmed: false,
        has_specific_move_in_date: false,
        knows_accommodation_duration: false,
        has_fixed_budget: false,
        prefers_private_room: false,
        wants_fully_furnished: false,
        needs_utilities_included: false,
        prefers_near_university_or_work: false,
        requires_accessibility_features: false,
        wants_shared_kitchen_or_meal_plan: false,
        needs_additional_facilities: false,
        has_documents_ready: false,
        wants_student_reviews: false,
        wants_flexible_cancellation: false,
        interested_in_verified_listings: false,
    });

    const handleAddAccommodation = async () => {
        const { success } = await commonPostAPICall(newAccommodation, "/accommodation/add", true);
        if (success) {
            fetchAccommodations();
            toggleAddModal();
            setNewAccommodation({
                company_name: "",
                short_description: "",
                link: "",
                images: [],
                is_destination_confirmed: false,
                has_specific_move_in_date: false,
                knows_accommodation_duration: false,
                has_fixed_budget: false,
                prefers_private_room: false,
                wants_fully_furnished: false,
                needs_utilities_included: false,
                prefers_near_university_or_work: false,
                requires_accessibility_features: false,
                wants_shared_kitchen_or_meal_plan: false,
                needs_additional_facilities: false,
                has_documents_ready: false,
                wants_student_reviews: false,
                wants_flexible_cancellation: false,
                interested_in_verified_listings: false,
            });
        }
    };

    // Update modal state and handlers
    const { isOpen: isUpdateOpen, onOpenChange: toggleUpdateModal } = useDisclosure();
    const [updateAccommodation, setUpdateAccommodation] = useState({
        id: "",
        company_name: "",
        short_description: "",
        link: "",
        images: [],
        is_destination_confirmed: false,
        has_specific_move_in_date: false,
        knows_accommodation_duration: false,
        has_fixed_budget: false,
        prefers_private_room: false,
        wants_fully_furnished: false,
        needs_utilities_included: false,
        prefers_near_university_or_work: false,
        requires_accessibility_features: false,
        wants_shared_kitchen_or_meal_plan: false,
        needs_additional_facilities: false,
        has_documents_ready: false,
        wants_student_reviews: false,
        wants_flexible_cancellation: false,
        interested_in_verified_listings: false,
    });

    const questions = [
        { key: 'is_destination_confirmed', label: "Is your destination country and city confirmed?" },
        { key: 'has_specific_move_in_date', label: "Do you have a specific move-in date?" },
        { key: 'knows_accommodation_duration', label: "Do you know how long you’ll need accommodation for?" },
        { key: 'has_fixed_budget', label: "Do you have a fixed monthly budget for accommodation?" },
        { key: 'prefers_private_room', label: "Do you prefer a private room over a shared one?" },
        { key: 'wants_fully_furnished', label: "Are you looking for a fully furnished accommodation option?" },
        { key: 'needs_utilities_included', label: "Do you need utilities (electricity, water, internet) included in the rent?" },
        { key: 'prefers_near_university_or_work', label: "Do you want your accommodation to be within walking distance of your university/workplace?" },
        { key: 'requires_accessibility_features', label: "Do you require accessibility features (for differently-abled individuals)?" },
        { key: 'wants_shared_kitchen_or_meal_plan', label: "Would you like access to a shared kitchen or meal-inclusive plans?" },
        { key: 'needs_additional_facilities', label: "Do you need additional facilities like laundry, gym, or parking?" },
        { key: 'has_documents_ready', label: "Do you have the necessary documents ready, such as ID proof and admission letters?" },
        { key: 'wants_student_reviews', label: "Would you like to see student reviews before making a decision?" },
        { key: 'wants_flexible_cancellation', label: "Do you want flexible cancellation options in case your plans change?" },
        { key: 'interested_in_verified_listings', label: "Are you interested in verified listings from trusted sources?" }
    ];

    const handleUpdateAccommodation = async () => {
        const { success } = await commonPostAPICall(updateAccommodation, "/accommodation/update", true);
        if (success) {
            fetchAccommodations();
            toggleUpdateModal();
            setUpdateAccommodation({
                id: "",
                company_name: "",
                short_description: "",
                link: "",
                images: [],
                is_destination_confirmed: false,
                has_specific_move_in_date: false,
                knows_accommodation_duration: false,
                has_fixed_budget: false,
                prefers_private_room: false,
                wants_fully_furnished: false,
                needs_utilities_included: false,
                prefers_near_university_or_work: false,
                requires_accessibility_features: false,
                wants_shared_kitchen_or_meal_plan: false,
                needs_additional_facilities: false,
                has_documents_ready: false,
                wants_student_reviews: false,
                wants_flexible_cancellation: false,
                interested_in_verified_listings: false,
            });
        }
    };

    // Delete modal state and handlers
    const { isOpen: isDeleteOpen, onOpenChange: toggleDeleteModal } = useDisclosure();
    const [deleteUUID, setDeleteUUID] = useState("");

    const handleDeleteAccommodation = async () => {
        const { success } = await commonPostAPICall({ id: deleteUUID }, "/accommodation/delete", true);
        if (success) {
            fetchAccommodations();
            toggleDeleteModal();
            setDeleteUUID("");
        }
    };
    // Add image URL to list
    const handleAddImage = (url) => {
        if (url == "") {
            ErrorToast("Please enter a valid URL");
        } else {
            setNewAccommodation((prevState) => ({
                ...prevState,
                images: [...prevState.images, url]
            }));
        }
        setNewImageURL("");
    };

    // Remove image URL from list
    const handleRemoveImage = (url) => {
        setNewAccommodation((prevState) => ({
            ...prevState,
            images: prevState?.images?.filter((image) => image !== url)
        }));
    };

    // Add image URL to list
    const handleAddImageUpdate = (url) => {
        if (url == "") {
            ErrorToast("Please enter a valid URL");
        } else {
            setUpdateAccommodation((prevState) => ({
                ...prevState,
                images: [...prevState.images, url]
            }));
        }
        setNewImageURL("");
    };

    const handleRemoveImageUpdate = (url) => {
        setUpdateAccommodation((prevState) => ({
            ...prevState,
            images: prevState?.images?.filter((image) => image !== url)
        }));
    };


    return (
        <div className="container mx-auto w-screen">
            <Table
                aria-label="Accommodation Management Table"
                topContent={
                    <div className="flex justify-between items-center">
                        <h1 className="text-lg font-bold">Accommodation Management</h1>
                        <Button color="primary" onPress={toggleAddModal}>+ Add</Button>
                    </div>
                }
            >
                <TableHeader>
                    <TableColumn>Company Name</TableColumn>
                    <TableColumn>Link</TableColumn>
                    <TableColumn>Clicks</TableColumn>
                    <TableColumn>Created At</TableColumn>
                    <TableColumn>Actions</TableColumn>
                </TableHeader>
                <TableBody items={accommodations} emptyContent="No accommodations available.">
                    {(item) => (
                        <TableRow key={item.id}>
                            <TableCell>{item.company_name}</TableCell>
                            <TableCell>{item.link}</TableCell>
                            <TableCell>{item.clicks}</TableCell>
                            <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                            <TableCell>
                                <div className="flex gap-2">
                                    <Button
                                        isIconOnly
                                        variant="flat"
                                        color="primary"
                                        onPress={() => {
                                            setUpdateAccommodation({ ...item, images: JSON.parse(item?.images) });
                                            toggleUpdateModal();
                                        }}
                                    >
                                        <MdEdit className="w-5 h-5" />
                                    </Button>
                                    <Button
                                        isIconOnly
                                        variant="flat"
                                        color="danger"
                                        onPress={() => {
                                            setDeleteUUID(item?.id);
                                            toggleDeleteModal();
                                        }}
                                    >
                                        <MdDelete className="w-5 h-5" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {/* Add Modal */}
            <Modal isOpen={isAddOpen} onOpenChange={toggleAddModal} 
            onClose={()=>{
                setNewAccommodation({
                   company_name: "",
                   short_description: "",
                   link: "",
                   images: [],
                   is_destination_confirmed: false,
                   has_specific_move_in_date: false,
                   knows_accommodation_duration: false,
                   has_fixed_budget: false,
                   prefers_private_room: false,
                   wants_fully_furnished: false,
                   needs_utilities_included: false,
                   prefers_near_university_or_work: false,
                   requires_accessibility_features: false,
                   wants_shared_kitchen_or_meal_plan: false,
                   needs_additional_facilities: false,
                   has_documents_ready: false,
                   wants_student_reviews: false,
                   wants_flexible_cancellation: false,
                   interested_in_verified_listings: false,
               });
           }}
            backdrop="blur" scrollBehavior="inside" size="4xl">
                <ModalContent>
                    <ModalHeader>Add Accommodation</ModalHeader>
                    <ModalBody>
                        <Input
                            label="Company Name"
                            value={newAccommodation.company_name}
                            onChange={(e) => setNewAccommodation({ ...newAccommodation, company_name: e.target.value })}
                        />
                        <Textarea
                            label="Short Description"
                            value={newAccommodation.short_description}
                            onChange={(e) => setNewAccommodation({ ...newAccommodation, short_description: e.target.value })}
                        />
                        <Input
                            label="Link"
                            value={newAccommodation.link}
                            onChange={(e) => setNewAccommodation({ ...newAccommodation, link: e.target.value })}
                        />
                        <div className="">
                            <Input
                                label="Image URL"
                                value={newImageURL}
                                onChange={(e) => setNewImageURL(e.target.value)}
                            />
                            {newImageURL !== "" &&
                                <Button
                                    onPress={() => handleAddImage(newImageURL)}
                                    color="primary"
                                    className="mt-2"
                                >
                                    Add Image
                                </Button>
                            }
                            <div className="flex flex-col gap-2 mt-2">
                                {newAccommodation?.images?.map((url, index) => (
                                    <div key={index} className="flex justify-between items-center">
                                        <a href={url} className="text-tiny text-blue-500 underline">{url}</a>
                                        <Button
                                            size="sm"
                                            color="danger"
                                            onPress={() => handleRemoveImage(url)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* <div className="flex flex-col gap-4">
                            {questions.map(({ key, label }) => (
                                <Switch
                                    key={key}
                                    isSelected={newAccommodation[key]}
                                    onValueChange={(value) => setNewAccommodation({ ...newAccommodation, [key]: value })}
                                >
                                    {label}
                                </Switch>
                            ))}
                        </div> */}
                        <div className="flex flex-col gap-4 touch-pan-y">
                            {questions.map(({ key, label }) => (
                                <span className="flex items-center gap-2">
                                    <Switch
                                        key={key}
                                        isSelected={newAccommodation[key]}
                                        onValueChange={(value) => setNewAccommodation({ ...newAccommodation, [key]: value })}
                                    >

                                    </Switch>
                                    <p>{label}</p>
                                </span>
                            ))}
                        </div>

                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" color="danger" onPress={toggleAddModal}>
                            Cancel
                        </Button>
                        <Button color="primary" onPress={handleAddAccommodation}>
                            Save
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Update Modal */}
            <Modal isOpen={isUpdateOpen} onClose={()=>{
                 setUpdateAccommodation({
                    id: "",
                    company_name: "",
                    short_description: "",
                    link: "",
                    images: [],
                    is_destination_confirmed: false,
                    has_specific_move_in_date: false,
                    knows_accommodation_duration: false,
                    has_fixed_budget: false,
                    prefers_private_room: false,
                    wants_fully_furnished: false,
                    needs_utilities_included: false,
                    prefers_near_university_or_work: false,
                    requires_accessibility_features: false,
                    wants_shared_kitchen_or_meal_plan: false,
                    needs_additional_facilities: false,
                    has_documents_ready: false,
                    wants_student_reviews: false,
                    wants_flexible_cancellation: false,
                    interested_in_verified_listings: false,
                });
            }} onOpenChange={toggleUpdateModal} backdrop="blur" scrollBehavior="inside" size="4xl">
                <ModalContent>
                    <ModalHeader>Update Accommodation</ModalHeader>
                    <ModalBody>
                        <Input
                            label="Company Name"
                            value={updateAccommodation.company_name}
                            onChange={(e) => setUpdateAccommodation({ ...updateAccommodation, company_name: e.target.value })}
                        />
                        <Textarea
                            label="Short Description"
                            value={updateAccommodation.short_description}
                            onChange={(e) => setUpdateAccommodation({ ...updateAccommodation, short_description: e.target.value })}
                        />
                        <Input
                            label="Link"
                            value={updateAccommodation.link}
                            onChange={(e) => setUpdateAccommodation({ ...updateAccommodation, link: e.target.value })}
                        />
                        <div className="">
                            {/* Image URLs */}
                            <div className="">
                                <Input
                                    label="Image URL"
                                    value={newImageURL}
                                    onChange={(e) => setNewImageURL(e.target.value)}
                                />
                                {newImageURL !== "" &&
                                    <Button
                                        onPress={() => handleAddImageUpdate(newImageURL)}
                                        color="primary"
                                        className="mt-2"
                                    >
                                        Add Image
                                    </Button>
                                }
                                <div className="mt-2 flex flex-col gap-2">
                                    {updateAccommodation?.images?.map((url, index) => (
                                        <div key={index} className="flex justify-between items-center">
                                            <a href={url} className="text-tiny text-blue-500 underline">{url}</a>
                                            <Button
                                                size="sm"
                                                color="danger"
                                                onPress={() => handleRemoveImageUpdate(url)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 touch-pan-y">
                            {questions.map(({ key, label }) => (
                                <span className="flex items-center gap-2">
                                    <Switch
                                        key={key}
                                        isSelected={updateAccommodation[key]}
                                        onValueChange={(value) => setUpdateAccommodation({ ...updateAccommodation, [key]: value })}
                                    >

                                    </Switch>
                                    <p>{label}</p>
                                </span>
                            ))}
                        </div>

                    </ModalBody>
                    <ModalFooter>
                        <Button variant="flat" color="danger" onPress={toggleUpdateModal}>
                            Cancel
                        </Button>
                        <Button color="primary" onPress={handleUpdateAccommodation}>
                            Update
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Confirmation */}
            <CommonConfirmation
                isOpen={isDeleteOpen}
                onClose={toggleDeleteModal}
                handleSubmit={handleDeleteAccommodation}
                title="Are you sure you want to delete this accommodation?"
                nagativeTitle="No, cancel"
                positiveTitle="Yes, delete"
            />

        </div>
    );
};

export default AccommodationManagement;
