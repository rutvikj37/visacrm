import useApiCallUtils from '@/hooks/useApiCallUtils'
import { Avatar, Button, Input, Modal, ModalBody, ModalContent, ModalHeader, Pagination, Spinner, Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, getKeyValue, useDisclosure, Chip } from '@nextui-org/react'
import { Edit, Search, Mail, Phone, Globe, Palette, Building2, LockKeyhole } from 'lucide-react'
import LoginCodeDialog, { LoginCodeInfo } from '@/modules/Saas/LoginCodeDialog'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { phoneInputProps, phoneOnChange } from "@/utils/phone";
import { apiBase } from "@/utils/product";

const BaseUrl = apiBase()

const Agents = () => {
    // Construct image URL - static files are typically served from the base domain without /api
    const getImageUrl = (filename: string | null) => {
        if (!filename) return null
        // Remove /api from base URL for static file serving
        const baseUrlWithoutApi = BaseUrl?.replace(/\/api$/, '') || BaseUrl
        return `${baseUrlWithoutApi}/profiles/${filename}`
    }

    const { commonPostAPICall } = useApiCallUtils()

    const [agentsListing, setAgentListing] = useState([])

    const [search, setSearch] = useState("")

    const [total, setTotal] = useState(0)
    const [offset, setOffset] = useState(0)

    const [isLoading, setIsLoading] = useState(true)
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [togglingUuid, setTogglingUuid] = useState<string | null>(null)
    const [loginInfo, setLoginInfo] = useState<LoginCodeInfo>(null)
    const [resettingUuid, setResettingUuid] = useState<string | null>(null)

    // owner forgot passcode / locked out: clear it, sign out everywhere, show a one-time login code (also emailed)
    const resetPasscode = async (row: any) => {
        if (!window.confirm(`Reset the passcode for ${row?.app_name || row?.username || "this agency"}? The current passcode stops working and the owner is signed out of all devices.`)) return
        setResettingUuid(row.uuid)
        const { success, data } = await commonPostAPICall({}, `saas_admin/agencies/${row.uuid}/reset_passcode`, true)
        setResettingUuid(null)
        if (success && data?.login_code) setLoginInfo({ phone: data.phone, code: data.login_code, reset: true, emailedTo: data.email_sent ? row.email : null, loginUrl: data.login_url })
    }
    const hasLoadedOnce = React.useRef(false)
    const prevDebouncedSearch = React.useRef(debouncedSearch)

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
        }, "/agent/list_agents")
        if (success && success == true) {
            setAgentListing(data)
            setTotal(+total)
            hasLoadedOnce.current = true
        }
        setIsLoading(false)
    }

    // new agent

    // Handle form input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('option_')) {
            const optionKey = name.split('_')[1];
            setForm({
                ...form
            });
        } else {
            setForm({ ...form, [name]: value });
        }
    };

    const [form, setForm] = useState({
        uuid: null,
        phone_number: "",
        country_code: "+91",
        user_name: "",
        email: ""
    });

    const { isOpen: isOpenAdd, onOpenChange: onOpenChangeAdd } = useDisclosure();

    const handleSubmitQuestion = async (e) => {
        e.preventDefault()
        const { uuid,
            phone_number,
            country_code,
            user_name,
            email
        } = form;
        const {
            data,
            success
        } = await commonPostAPICall({
            phone_number: uuid ? undefined : phone_number,
            user_name,
            country_code: "+91",
            email,
            uuid: uuid ? uuid : undefined
        }, uuid ? "agent/update" : "agent/create")
        if (success && success == true) {
            findAgents()
            setForm({
                uuid: null,
                country_code: "+91",
                email: "",
                phone_number: "",
                user_name: ""
            });
            onOpenChangeAdd()
        }
    }

    const statusChangeApiCall = async (uuid: string | null, action: string) => {
        if (!uuid || togglingUuid) return
        setTogglingUuid(uuid)
        setAgentListing((prev: any[]) =>
            prev.map((row: any) =>
                getKeyValue(row, "uuid") === uuid ? { ...row, status: action } : row
            )
        )
        const { success } = await commonPostAPICall({
            uuid, 
            action
        }, "/agent/toggle")
        setTogglingUuid(null)
        if (!success) findAgents({ soft: true })
    }

    const navigate = useNavigate()

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Agents</h1>
                    <p className="text-sm text-default-500">Agency accounts, branding and portal settings. Plans and trials live under SaaS.</p>
                </div>
                <Button
                    color='primary'
                    onPress={() => {
                        navigate("/saas/agencies")
                    }}
                >
                    Manage plans & trials
                </Button>
            </div>
            <Table
                aria-label="Agents"
                topContent={
                    <div className='flex flex-wrap items-center gap-2'>
                        <Input
                            className='w-full max-w-sm'
                            size="sm"
                            startContent={<Search className='h-4 text-default-400' />}
                            placeholder='Search name, email, phone...'
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                            }}
                            isClearable
                        />
                    </div>
                }
                bottomContent={
                    <section className='mx-auto'>
                        <Pagination
                            isCompact
                            showControls
                            defaultChecked
                            defaultValue={1}
                            total={Math.ceil(total / 5)}
                            onChange={(value) => {
                                setOffset(value * 5 - 5)
                            }}
                        />
                    </section>
                }
            >
                <TableHeader>
                    <TableColumn key="profile_info">Profile & Basic Info</TableColumn>
                    <TableColumn key="branding_info">Branding & Support</TableColumn>
                    <TableColumn key="domain_seo">Domain & SEO</TableColumn>
                    <TableColumn key="status_info">Status & Actions</TableColumn>
                </TableHeader>
                <TableBody
                    items={agentsListing}
                    emptyContent={"No rows to display."}
                    loadingContent={<Spinner />}
                    isLoading={isLoading && agentsListing.length === 0}
                >
                    {(item: any) => (
                        <TableRow key={item?.uuid} onClick={(e) => {
                            e.stopPropagation()
                            // navigate(`/agents/${getKeyValue(item, "uuid")}`,)
                            window.open(`/agents/${getKeyValue(item, "uuid")}`, "_blank")
                        }}
                            className='cursor-pointer'
                        >

                            {(columnKey) => {
                                const getValue = (key: string) => item?.[key] ?? null

                                if (columnKey === "profile_info") {
                                    return (
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar
                                                    size="md"
                                                    src={getValue("profile_image") || getValue("profile_image") || undefined}
                                                    alt={getValue("username") || "Agent"}
                                                    name={getValue("username") || "A"}
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <p className="font-semibold text-sm">{getValue("username") || "N/A"}</p>
                                                    <p className="text-xs text-default-500 flex items-center gap-1">
                                                        <Mail className="h-3 w-3" />
                                                        {getValue("email") || "No email"}
                                                    </p>
                                                    <p className="text-xs text-default-500 flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {getValue("phone_number") || "No phone"}
                                                    </p>
                                                    <Chip size="sm" variant="flat" color="secondary">
                                                        {getValue("role") || "agent"}
                                                    </Chip>
                                                </div>
                                            </div>
                                        </TableCell>
                                    )
                                } else if (columnKey === "branding_info") {
                                    return (
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                {getValue("app_name") && (
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="h-3 w-3 text-default-400" />
                                                        <p className="text-sm font-medium">{getValue("app_name")}</p>
                                                    </div>
                                                )}
                                                {(getValue("primary_color") || getValue("primary_foreground_color")) && (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Palette className="h-3 w-3 text-default-400" />
                                                        {getValue("primary_color") && (
                                                            <div className="flex items-center gap-1">
                                                                <div
                                                                    className="w-4 h-4 rounded border border-gray-300"
                                                                    style={{ backgroundColor: getValue("primary_color") }}
                                                                />
                                                                <span className="text-xs text-default-600">{getValue("primary_color")}</span>
                                                            </div>
                                                        )}
                                                        {getValue("primary_foreground_color") && (
                                                            <div className="flex items-center gap-1">
                                                                <div
                                                                    className="w-4 h-4 rounded border border-gray-300"
                                                                    style={{ backgroundColor: getValue("primary_foreground_color") }}
                                                                />
                                                                <span className="text-xs text-default-600">{getValue("primary_foreground_color")}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {getValue("support_email") && (
                                                    <div className="flex items-center gap-2">
                                                        <Mail className="h-3 w-3 text-default-400" />
                                                        <p className="text-xs text-default-600">{getValue("support_email")}</p>
                                                    </div>
                                                )}
                                                {getValue("support_number") && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="h-3 w-3 text-default-400" />
                                                        <p className="text-xs text-default-600">{getValue("support_number")}</p>
                                                    </div>
                                                )}
                                                {getValue("agency_address") && (
                                                    <div className="flex items-start gap-2">
                                                        <Building2 className="h-3 w-3 text-default-400 mt-0.5" />
                                                        <p className="text-xs text-default-600 line-clamp-2">{getValue("agency_address")}</p>
                                                    </div>
                                                )}
                                                {(!getValue("app_name") && !getValue("primary_color") && !getValue("support_email")) && (
                                                    <p className="text-xs text-default-400">No branding info</p>
                                                )}
                                            </div>
                                        </TableCell>
                                    )
                                } else if (columnKey === "domain_seo") {
                                    return (
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                {(getValue("domain") || getValue("sudomain")) && (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Globe className="h-3 w-3 text-default-400" />
                                                        {getValue("domain") && (
                                                            <Chip size="sm" variant="flat" color="primary">
                                                                {getValue("domain")}
                                                            </Chip>
                                                        )}
                                                        {getValue("sudomain") && (
                                                            <Chip size="sm" variant="flat">
                                                                {getValue("sudomain")}
                                                            </Chip>
                                                        )}
                                                    </div>
                                                )}
                                                {getValue("favicon_url") && (
                                                    <div className="flex items-center gap-2">
                                                        <img
                                                            src={getImageUrl(getValue("favicon_url")) || ''}
                                                            alt="Favicon"
                                                            className="w-5 h-5 object-contain"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none'
                                                            }}
                                                        />
                                                        <span className="text-xs text-default-600">Favicon</span>
                                                    </div>
                                                )}
                                                {getValue("og_image") && (
                                                    <div className="flex items-center gap-2">
                                                        <img
                                                            src={getImageUrl(getValue("og_image")) || ''}
                                                            alt="OG Image"
                                                            className="w-5 h-5 object-contain"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none'
                                                            }}
                                                        />
                                                        <span className="text-xs text-default-600">OG Image</span>
                                                    </div>
                                                )}
                                                {getValue("meta_description") && (
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-xs text-default-400">Meta:</span>
                                                        <p className="text-xs text-default-600 line-clamp-2">{getValue("meta_description")}</p>
                                                    </div>
                                                )}
                                                {getValue("certificate_url") && (
                                                    <div className="flex items-center gap-2">
                                                        <Globe className="h-3 w-3 text-default-400" />
                                                        <a
                                                            href={getValue("certificate_url")?.startsWith("http") ? getValue("certificate_url") : `https://${getValue("certificate_url")}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-primary hover:underline line-clamp-1"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            Certificate URL
                                                        </a>
                                                    </div>
                                                )}
                                                {(!getValue("domain") && !getValue("sudomain") && !getValue("favicon_url") && !getValue("meta_description")) && (
                                                    <p className="text-xs text-default-400">No domain/SEO info</p>
                                                )}
                                            </div>
                                        </TableCell>
                                    )
                                } else if (columnKey === "status_info") {
                                    return (
                                        <TableCell>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        isSelected={getValue("status") === "active"}
                                                        size="sm"
                                                        isDisabled={togglingUuid === getValue("uuid")}
                                                        onValueChange={(v) => {
                                                            statusChangeApiCall(getValue("uuid"), v ? "active" : "inactive")
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                        }}
                                                    >
                                                        <span className="text-xs">{getValue("status")?.toUpperCase() || "INACTIVE"}</span>
                                                    </Switch>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Chip
                                                        size="sm"
                                                        variant="flat"
                                                        color={getValue("is_verified") === 1 ? "success" : "default"}
                                                    >
                                                        {getValue("is_verified") === 1 ? "Verified" : "Not Verified"}
                                                    </Chip>
                                                </div>
                                                <p className="text-xs text-default-500">
                                                    {getValue("createdAt") ? new Date(getValue("createdAt")).toLocaleDateString() : "N/A"}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        isIconOnly
                                                        variant="light"
                                                        color="secondary"
                                                        size="sm"
                                                        onPress={() => {
                                                            navigate(`/agent/edit_agent/${getValue("uuid")}`)
                                                        }}
                                                       
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    {(getValue("role") || "agent") === "agent" && (
                                                        <span onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="flat"
                                                            color="warning"
                                                            size="sm"
                                                            startContent={<LockKeyhole className="h-4 w-4" />}
                                                            isLoading={resettingUuid === getValue("uuid")}
                                                            onPress={() => resetPasscode(item)}
                                                        >
                                                            Reset passcode
                                                        </Button>
                                                        </span>
                                                    )}
                                                </div>
                                        </div>
                                    </TableCell>
                                    )
                                }
                                
                                return <TableCell>{getValue(String(columnKey)) || "N/A"}</TableCell>
                            }}

                        </TableRow>
                    )}
                </TableBody>
            </Table>
            <Modal
                isOpen={isOpenAdd}
                onOpenChange={onOpenChangeAdd}
                scrollBehavior="inside"
                backdrop='blur'
                size='3xl'
                placement="center"
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                Agent
                            </ModalHeader>
                            <ModalBody>
                                {/* Form for adding/updating questions */}
                                <form onSubmit={handleSubmitQuestion} className="space-y-4 mb-8">
                                    <div>
                                        {/* <label className="block text-lg">Email</label> */}
                                        <Input
                                            type="email"
                                            label="email"
                                            name="email"
                                            value={form.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div>
                                        {/* <label className="block text-lg">Name</label> */}
                                        <Input
                                            type="text"
                                            name="user_name"
                                            label="Name"
                                            value={form.user_name}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Input
                                            type="tel"
                                            {...phoneInputProps}
                                            name="phone_number"
                                            label="Phone Number"
                                            value={form.phone_number}
                                            onChange={phoneOnChange(handleChange)}
                                            required
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        // className="bg-blue-600 text-white py-2 px-4 rounded-md"
                                        variant='shadow'
                                        color='primary'
                                    >
                                        {form.uuid ? 'Update Agent' : 'Add Agent'}
                                    </Button>
                                </form>
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
            <LoginCodeDialog info={loginInfo} onClose={() => setLoginInfo(null)} />
        </div>
    )
}

export default Agents