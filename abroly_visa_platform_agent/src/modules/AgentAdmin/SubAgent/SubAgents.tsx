import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Avatar, Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tooltip, getKeyValue, useDisclosure, Chip } from "@heroui/react"
import { Edit, Search, Users, UserPlus, Mail, Phone, Award, CheckCircle2, XCircle, KeyRound, Copy, MailWarning, Trash2 } from 'lucide-react'
import { ErrorToast, SuccessToast } from '@/utils/Toaster'
import React, { useEffect, useRef, useState } from 'react'
import { PRIMARY_COLOR, BRAND_TEXT, getPrimaryGradient } from '@/lib/theme'
import { phoneInputProps, phoneOnChange } from "@/utils/phone";

const PAGE_SIZE = 10

const SubAgents = () => {

    const { commonPostAPICall } = useApiCallUtils()

    const [agentsListing, setAgentListing] = useState([])

    const [search, setSearch] = useState("")

    const [total, setTotal] = useState(0)
    const [offset, setOffset] = useState(0)

    const [isLoading, setIsLoading] = useState(true)
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [togglingUuid, setTogglingUuid] = useState<string | null>(null)
    const hasLoadedOnce = useRef(false)
    const prevDebouncedSearch = useRef(debouncedSearch)

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedSearch(search), 500)
        return () => clearTimeout(timeout)
    }, [search])

    useEffect(() => {
        const searchChanged = prevDebouncedSearch.current !== debouncedSearch
        prevDebouncedSearch.current = debouncedSearch
        if (searchChanged && offset !== 0) {
            setOffset(0)
            return
        }
        findAgents()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, offset])

    const findAgents = async (opts?: { soft?: boolean }) => {
        const soft = opts?.soft ?? hasLoadedOnce.current
        if (!soft) setIsLoading(true)
        const { data, success, total } = await commonPostAPICall({
            search: debouncedSearch,
            offset,
        }, "/sub_agent/list")
        if (success && success == true) {
            setAgentListing(data)
            setTotal(+total)
            hasLoadedOnce.current = true
        }
        setIsLoading(false)
    }

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const [form, setForm] = useState({
        uuid: null,
        phone_number: "",
        country_code: "+91",
        user_name: "",
        email: "",
        designation: ""
    });

    const { isOpen: isOpenAdd, onOpenChange: onOpenChangeAdd } = useDisclosure();
    const [loginInfo, setLoginInfo] = useState<{ name: string; phone: string; code: string } | null>(null);
    const [sendingCode, setSendingCode] = useState<string | null>(null);
    const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submittingRef = useRef(false);

    const openCreate = () => {
        setForm({ uuid: null, country_code: "+91", email: "", phone_number: "", user_name: "", designation: "" })
        onOpenChangeAdd()
    }

    const openEdit = (item: any) => {
        setForm({
            uuid: getKeyValue(item, "uuid"),
            country_code: "+91",
            email: getKeyValue(item, "email") || "",
            phone_number: getKeyValue(item, "phone_number") || "",
            user_name: getKeyValue(item, "username") || "",
            designation: getKeyValue(item, "designation") || "",
        })
        onOpenChangeAdd()
    }

    const sendLoginCode = async (item: any) => {
        const name = getKeyValue(item, "username")
        const email = getKeyValue(item, "email")
        if (!window.confirm(`Send ${name} a new login code${email ? ` at ${email}` : ""}? Their current code will stop working.`)) return
        setSendingCode(getKeyValue(item, "uuid"))
        const { success, data } = await commonPostAPICall({ uuid: getKeyValue(item, "uuid") }, "/sub_agent/send_login", true)
        setSendingCode(null)
        if (success && data?.login_code) setLoginInfo({ name, phone: data.phone, code: data.login_code })
    }

    const deleteMember = async (item: any) => {
        const uuid = getKeyValue(item, "uuid")
        const name = getKeyValue(item, "username")
        if (!window.confirm(`Delete ${name}? They will no longer be able to log in to the agency panel.`)) return
        if (deletingUuid) return
        setDeletingUuid(uuid)
        const { success } = await commonPostAPICall({ uuid }, "/sub_agent/delete", true)
        setDeletingUuid(null)
        if (success) findAgents({ soft: true })
    }

    const handleSubmitQuestion = async (e) => {
        e.preventDefault()
        if (submittingRef.current) return
        if (!form.uuid && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(form.email || "").trim())) {
            return ErrorToast("Please enter a valid email - the login details are sent there")
        }
        const { uuid, phone_number, user_name, email, designation } = form;
        submittingRef.current = true
        setIsSubmitting(true)
        try {
            const { data, success } = await commonPostAPICall({
                phone_number: uuid ? undefined : phone_number,
                user_name,
                country_code: "+91",
                email,
                uuid: uuid ? uuid : undefined,
                designation
            }, uuid ? "sub_agent/update" : "sub_agent/add", true)
            if (success && success == true) {
                if (!uuid && data?.login_code) setLoginInfo({ name: user_name, phone: data.phone, code: data.login_code })
                findAgents({ soft: true })
                setForm({
                    uuid: null,
                    country_code: "+91",
                    email: "",
                    phone_number: "",
                    user_name: "",
                    designation: ""
                });
                onOpenChangeAdd()
            }
        } finally {
            submittingRef.current = false
            setIsSubmitting(false)
        }
    }

    const statusChangeApiCall = async (uuid, action) => {
        if (togglingUuid) return
        setTogglingUuid(uuid)
        setAgentListing((prev: any[]) =>
            prev.map((row: any) =>
                getKeyValue(row, "uuid") === uuid ? { ...row, status: action } : row
            )
        )
        const { success } = await commonPostAPICall({ uuid, action }, "/sub_agent/toggle")
        setTogglingUuid(null)
        if (!success) findAgents({ soft: true })
    }

    const MemberActions = ({ item }: { item: any }) => {
        const uuid = getKeyValue(item, "uuid")
        const name = getKeyValue(item, "username")
        return (
            <div className="flex items-center gap-0.5 whitespace-nowrap">
                <Tooltip content="Edit">
                    <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        aria-label={`Edit ${name}`}
                        style={{ color: BRAND_TEXT }}
                        onPress={() => openEdit(item)}
                    >
                        <Edit className="h-4 w-4" />
                    </Button>
                </Tooltip>
                <Tooltip content="Send login code">
                    <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        aria-label={`Send ${name} a new login code`}
                        style={{ color: BRAND_TEXT }}
                        isLoading={sendingCode === uuid}
                        onPress={() => sendLoginCode(item)}
                    >
                        <KeyRound className="h-4 w-4" />
                    </Button>
                </Tooltip>
                <Tooltip content="Delete">
                    <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        color="danger"
                        aria-label={`Delete ${name}`}
                        isLoading={deletingUuid === uuid}
                        isDisabled={!!deletingUuid && deletingUuid !== uuid}
                        onPress={() => deleteMember(item)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </Tooltip>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Team</h1>
                    <p className="text-sm text-default-500">Add counsellors and staff who can work leads and cases</p>
                </div>
                <Button
                    color="primary"
                    className="w-full sm:w-auto shrink-0"
                    startContent={<UserPlus className="w-4 h-4" />}
                    onPress={openCreate}
                >
                    Add team member
                </Button>
            </div>

            <div className="flex flex-col gap-2">
                <Input
                    className="w-full sm:max-w-md"
                    startContent={<Search className="h-4 w-4 text-default-400" />}
                    placeholder="Search by name, email or phone"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    isClearable
                    onClear={() => setSearch("")}
                />
            </div>

            <div className="rounded-xl border border-default-200 bg-content1 overflow-hidden">
                <div className="p-3 sm:p-4">
                    {isLoading && agentsListing.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-14">
                            <div className="relative w-5 h-5">
                                <div className="absolute inset-0 border-2 rounded-full" style={{ borderColor: `${PRIMARY_COLOR}25` }} />
                                <div className="absolute inset-0 border-2 rounded-full border-t-transparent animate-spin" style={{ borderColor: PRIMARY_COLOR }} />
                            </div>
                            <p className="text-sm text-default-500">Loading team…</p>
                        </div>
                    ) : agentsListing.length === 0 ? (
                        <div className="text-center py-12 px-2">
                            <Users className="w-8 h-8 text-default-400 mx-auto mb-3" />
                            <p className="text-foreground font-semibold">No team members yet</p>
                            <p className="text-default-500 text-sm mt-1 mb-4">Add someone so they can log in and handle leads.</p>
                            <Button color="primary" className="w-full sm:w-auto" startContent={<UserPlus className="w-4 h-4" />} onPress={openCreate}>
                                Add team member
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Mobile cards */}
                            <div className="flex flex-col gap-3 md:hidden">
                                {agentsListing.map((item: any) => {
                                    const name = getKeyValue(item, "username") || "—"
                                    const designation = getKeyValue(item, "designation")
                                    const email = getKeyValue(item, "email")
                                    const phone = getKeyValue(item, "phone_number")
                                    const isActive = getKeyValue(item, "status") === "active"
                                    const isVerified = getKeyValue(item, "is_verified")
                                    const raw = getKeyValue(item, "createdAt")
                                    const joined = raw ? new Date(raw) : null
                                    return (
                                        <div key={item?.uuid} className="rounded-xl border border-default-200 p-3 space-y-3">
                                            <div className="flex items-start gap-3">
                                                <Avatar
                                                    size="md"
                                                    src={getKeyValue(item, "access_profile") || getKeyValue(item, "profile_image")}
                                                    name={name}
                                                    className="shrink-0"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-foreground truncate">{name}</p>
                                                    {designation ? <p className="text-xs text-default-500 truncate">{designation}</p> : null}
                                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                        <Chip size="sm" variant="flat" color={isVerified ? "success" : "default"}>
                                                            {isVerified ? "Verified" : "Pending"}
                                                        </Chip>
                                                        <Chip size="sm" variant="flat" color={isActive ? "success" : "default"}>
                                                            {isActive ? "Active" : "Inactive"}
                                                        </Chip>
                                                    </div>
                                                </div>
                                                <MemberActions item={item} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-1 text-sm min-w-0">
                                                {phone ? <a href={`tel:${phone}`} className="text-foreground truncate">{phone}</a> : null}
                                                {email ? <a href={`mailto:${email}`} className="text-default-500 text-xs truncate" title={email}>{email}</a> : null}
                                            </div>
                                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-default-100">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        isSelected={isActive}
                                                        size="sm"
                                                        isDisabled={togglingUuid === getKeyValue(item, "uuid")}
                                                        aria-label={`${isActive ? "Deactivate" : "Activate"} ${name}`}
                                                        classNames={{ wrapper: isActive ? "bg-primary" : "" }}
                                                        onValueChange={(v) => statusChangeApiCall(getKeyValue(item, "uuid"), v ? "active" : "inactive")}
                                                    />
                                                    <span className="text-xs text-default-500">{isActive ? "Active" : "Inactive"}</span>
                                                </div>
                                                <span className="text-xs text-default-400 whitespace-nowrap">
                                                    {joined && !Number.isNaN(joined.getTime())
                                                        ? joined.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                                        : "—"}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Desktop table */}
                            <div className="hidden md:block overflow-x-auto">
                                <Table
                                    aria-label="Team Members table"
                                    removeWrapper
                                    classNames={{
                                        table: "min-w-[760px]",
                                        th: "bg-default-100/80 text-default-600 text-xs font-semibold uppercase tracking-wide first:rounded-l-lg last:rounded-r-lg",
                                        td: "py-3 align-middle",
                                    }}
                                >
                                    <TableHeader>
                                        <TableColumn key="member">Member</TableColumn>
                                        <TableColumn key="contact">Contact</TableColumn>
                                        <TableColumn key="is_verified">Verified</TableColumn>
                                        <TableColumn key="status">Status</TableColumn>
                                        <TableColumn key="createdAt">Joined</TableColumn>
                                        <TableColumn key="action" align="end">Actions</TableColumn>
                                    </TableHeader>
                                    <TableBody items={agentsListing}>
                                        {(item: any) => (
                                            <TableRow key={item?.uuid} className="border-b border-default-100 last:border-b-0">
                                                {(columnKey) => {
                                                    if (columnKey === "member") {
                                                        const name = getKeyValue(item, "username") || "—"
                                                        const designation = getKeyValue(item, "designation")
                                                        return (
                                                            <TableCell>
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <Avatar
                                                                        size="sm"
                                                                        src={getKeyValue(item, "access_profile") || getKeyValue(item, "profile_image")}
                                                                        name={name}
                                                                        className="shrink-0"
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                                                                        {designation ? <p className="text-xs text-default-500 truncate">{designation}</p> : null}
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        )
                                                    }
                                                    if (columnKey === "contact") {
                                                        const email = getKeyValue(item, "email")
                                                        const phone = getKeyValue(item, "phone_number")
                                                        return (
                                                            <TableCell>
                                                                <div className="flex flex-col gap-0.5 min-w-0 max-w-[220px]">
                                                                    {phone ? <a href={`tel:${phone}`} className="text-sm text-foreground hover:text-primary truncate">{phone}</a> : <span className="text-sm text-default-400">—</span>}
                                                                    {email ? <a href={`mailto:${email}`} className="text-xs text-default-500 hover:text-primary truncate" title={email}>{email}</a> : <span className="text-xs text-default-400">No email</span>}
                                                                </div>
                                                            </TableCell>
                                                        )
                                                    }
                                                    if (columnKey === "is_verified") {
                                                        const isVerified = getKeyValue(item, "is_verified")
                                                        return (
                                                            <TableCell>
                                                                <Chip
                                                                    size="sm"
                                                                    variant="flat"
                                                                    color={isVerified ? "success" : "default"}
                                                                    startContent={isVerified ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                                >
                                                                    {isVerified ? "Verified" : "Pending"}
                                                                </Chip>
                                                            </TableCell>
                                                        )
                                                    }
                                                    if (columnKey === "status") {
                                                        const isActive = getKeyValue(item, "status") === "active"
                                                        return (
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Switch
                                                                        isSelected={isActive}
                                                                        size="sm"
                                                                        isDisabled={togglingUuid === getKeyValue(item, "uuid")}
                                                                        aria-label={`${isActive ? "Deactivate" : "Activate"} ${getKeyValue(item, "username")}`}
                                                                        classNames={{ wrapper: isActive ? "bg-primary" : "" }}
                                                                        onValueChange={(v) => statusChangeApiCall(getKeyValue(item, "uuid"), v ? "active" : "inactive")}
                                                                    />
                                                                    <span className={`text-xs font-medium ${isActive ? "text-success" : "text-default-400"}`}>
                                                                        {isActive ? "Active" : "Inactive"}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                        )
                                                    }
                                                    if (columnKey === "createdAt") {
                                                        const raw = getKeyValue(item, "createdAt")
                                                        const d = raw ? new Date(raw) : null
                                                        return (
                                                            <TableCell>
                                                                <span className="text-sm text-default-600 whitespace-nowrap">
                                                                    {d && !Number.isNaN(d.getTime())
                                                                        ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                                                        : "—"}
                                                                </span>
                                                            </TableCell>
                                                        )
                                                    }
                                                    if (columnKey === "action") {
                                                        return (
                                                            <TableCell>
                                                                <div className="flex justify-end">
                                                                    <MemberActions item={item} />
                                                                </div>
                                                            </TableCell>
                                                        )
                                                    }
                                                    return <TableCell>{getKeyValue(item, columnKey)}</TableCell>
                                                }}
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}

                    {total > 0 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-4 border-t border-default-200">
                            <p className="text-sm text-default-500">
                                <span className="font-semibold text-foreground">{total}</span> member{total === 1 ? "" : "s"}
                            </p>
                            <Pagination
                                total={Math.max(1, Math.ceil(total / PAGE_SIZE))}
                                page={Math.floor(offset / PAGE_SIZE) + 1}
                                onChange={(value) => setOffset((value - 1) * PAGE_SIZE)}
                                showControls
                                size="sm"
                                classNames={{ cursor: "bg-primary text-primary-foreground" }}
                            />
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isOpenAdd}
                onOpenChange={onOpenChangeAdd}
                scrollBehavior="inside"
                backdrop="blur"
                size="2xl"
                placement="center"
                classNames={{
                    base: "mx-2 sm:mx-auto max-h-[90vh]",
                    header: "border-b border-default-200",
                    body: "py-5",
                }}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-0.5">
                                <h3 className="text-base sm:text-lg font-semibold text-foreground">
                                    {form.uuid ? "Edit team member" : "Add team member"}
                                </h3>
                                <p className="text-xs text-default-500 font-normal">
                                    {form.uuid ? "Update their contact details" : "They’ll get a login code by email"}
                                </p>
                            </ModalHeader>
                            <ModalBody>
                                <form onSubmit={handleSubmitQuestion} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <Input
                                            type="email"
                                            placeholder="Email (login details are sent here)"
                                            name="email"
                                            value={form.email}
                                            onChange={handleChange}
                                            required
                                            startContent={<Mail className="w-4 h-4 text-default-400" />}
                                        />
                                        <Input
                                            type="text"
                                            name="user_name"
                                            placeholder="Enter name"
                                            value={form.user_name}
                                            onChange={handleChange}
                                            required
                                            startContent={<Users className="w-4 h-4 text-default-400" />}
                                        />
                                        <Input
                                            type="text"
                                            name="designation"
                                            placeholder="Enter designation"
                                            value={form.designation}
                                            onChange={handleChange}
                                            required
                                            startContent={<Award className="w-4 h-4 text-default-400" />}
                                        />
                                        <Input
                                            type="tel"
                                            {...phoneInputProps}
                                            name="phone_number"
                                            placeholder="Enter phone number"
                                            value={form.phone_number}
                                            onChange={phoneOnChange(handleChange)}
                                            required
                                            isDisabled={!!form.uuid}
                                            startContent={<Phone className="w-4 h-4 text-default-400" />}
                                        />
                                    </div>

                                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                                        <Button
                                            variant="light"
                                            onPress={onClose}
                                            isDisabled={isSubmitting}
                                            className="w-full sm:w-auto border border-default-300"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            isLoading={isSubmitting}
                                            isDisabled={isSubmitting}
                                            className="w-full sm:w-auto font-semibold"
                                            style={{
                                                background: getPrimaryGradient("to-r"),
                                                color: "white"
                                            }}
                                        >
                                            {form.uuid ? "Update Team Member" : "Add Team Member"}
                                        </Button>
                                    </div>
                                </form>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal
                isOpen={!!loginInfo}
                onOpenChange={(open) => !open && setLoginInfo(null)}
                isDismissable={false}
                size="md"
                classNames={{ base: "mx-2 sm:mx-auto" }}
            >
                <ModalContent>
                    {(close) => loginInfo && (
                        <>
                            <ModalHeader className="flex items-start gap-2 text-base sm:text-lg">
                                <MailWarning size={18} className="text-warning shrink-0 mt-0.5" />
                                <span>Email not sent — share the login code</span>
                            </ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-default-600">
                                    The email to {loginInfo.name} couldn't be sent. Share these login details with them yourself.
                                    This is the only time the code is shown — if it's lost, use the key button to send a new one.
                                </p>
                                <div className="rounded-xl border border-default-200 divide-y divide-default-200">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3 text-sm">
                                        <span className="text-default-500">Mobile number</span>
                                        <span className="font-semibold break-all">{loginInfo.phone}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3 text-sm">
                                        <span className="text-default-500">Login code</span>
                                        <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest break-all">{loginInfo.code}</span>
                                    </div>
                                </div>
                            </ModalBody>
                            <ModalFooter className="flex flex-col-reverse sm:flex-row gap-2">
                                <Button
                                    className="w-full sm:w-auto"
                                    variant="flat"
                                    startContent={<Copy size={16} />}
                                    onPress={() => navigator.clipboard.writeText(`Your TechX CRM login\nMobile number: ${loginInfo.phone}\nLogin code: ${loginInfo.code}`).then(() => SuccessToast("Login details copied"), () => ErrorToast("Couldn't copy"))}
                                >
                                    Copy details
                                </Button>
                                <Button className="w-full sm:w-auto" color="primary" onPress={close}>Done</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}

export default SubAgents
