import { Spinner } from '@nextui-org/react'
import { useEffect, useState } from 'react'
import { Globe, MapPin, Mail, Phone, Info, Clock, Facebook, Instagram, Linkedin, Twitter, Youtube, MessageSquare, User, CheckCircle, XCircle } from "lucide-react";
import useApiCallUtils from '@/hooks/useApiCallUtils';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5 min-w-0">
        <div className="text-xs text-default-500">{label}</div>
        <div className="text-sm text-default-700 break-words">{children}</div>
    </div>
)

const AgentProfile = ({ agentUuid }) => {
    const { commonPostAPICall } = useApiCallUtils()
    const [isLoading, setIsLoading] = useState(true)
    const [profile, setProfile] = useState<any>({})

    useEffect(() => {
        findAgentProfile()
    }, [])

    const findAgentProfile = async () => {
        setIsLoading(true)
        const { success, data } = await commonPostAPICall({
            agentUuid: agentUuid
        }, "agent_profile/admin/get_basic_profile")

        if (success && success == true) {
            setProfile(data)
        }

        setIsLoading(false)
    }

    if (isLoading) {
        return (
            <div className='flex items-center justify-center py-10'>
                <Spinner />
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            {profile?.information && (
                <section className="rounded-xl border border-default-200 bg-content1 p-4 space-y-3">
                    <h3 className="text-base font-semibold flex items-center gap-2 text-default-700">
                        <User className="h-4 w-4" />
                        Agent information
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Field label="Name">{profile?.information?.username}</Field>
                        <Field label="Email">{profile?.information?.email}</Field>
                        <Field label="Phone">{profile?.information?.phone}</Field>
                        <Field label="Account status">
                            <span className="inline-flex items-center gap-1.5">
                                {profile?.information?.is_verified ? (
                                    <CheckCircle className="h-4 w-4 text-success" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-danger" />
                                )}
                                {profile?.information?.is_verified ? 'Verified' : 'Unverified'}
                            </span>
                        </Field>
                        <Field label="Account created">
                            {new Date(profile?.information?.createdAt).toLocaleDateString()}
                        </Field>
                        <Field label="Last updated">
                            {new Date(profile?.information?.updatedAt).toLocaleDateString()}
                        </Field>
                    </div>
                </section>
            )}
            {profile?.basic_profile ? (
                <section className="rounded-xl border border-default-200 bg-content1 p-4 space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-default-700">Basic profile</h3>
                        <p className="text-xs text-default-500">UUID: {profile?.basic_profile?.uuid}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <h4 className="text-sm font-medium text-default-600 mb-1 flex items-center gap-1.5">
                                <MapPin className="h-4 w-4" />
                                Office address
                            </h4>
                            <p className="text-sm text-default-600">{profile?.basic_profile?.officeStreetAddress}</p>
                            <p className="text-sm text-default-600">{profile?.basic_profile?.officeCity}, {profile?.basic_profile?.officeStateProvince}</p>
                            <p className="text-sm text-default-600">{profile?.basic_profile?.officeCountry}</p>
                            <p className="text-sm text-default-600">{profile?.basic_profile?.officePostalCode}</p>
                        </div>

                        <div className="sm:col-span-2">
                            <h4 className="text-sm font-medium text-default-600 mb-1 flex items-center gap-1.5">
                                <Info className="h-4 w-4" />
                                About us
                            </h4>
                            <p className="text-sm text-default-600">{profile?.basic_profile?.aboutUs}</p>
                        </div>

                        <div className="col-span-full">
                            <h4 className="text-sm font-medium text-default-600 mb-1 flex items-center gap-1.5">
                                <Info className="h-4 w-4" />
                                Detailed description
                            </h4>
                            <div
                                className="text-sm text-default-600"
                                dangerouslySetInnerHTML={{ __html: profile?.basic_profile?.detailedDescription }}
                            />
                        </div>

                        <Field label="Email">
                            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-default-400" />{profile?.basic_profile?.contactEmail}</span>
                        </Field>
                        <Field label="Phone">
                            <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-default-400" />{profile?.basic_profile?.contactPhoneNumber || "N/A"}</span>
                        </Field>
                        <Field label="WhatsApp">
                            <span className="inline-flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-default-400" />{profile?.basic_profile?.contactWhatsApp || "N/A"}</span>
                        </Field>

                        <div className="sm:col-span-2">
                            <h4 className="text-sm font-medium text-default-600 mb-1 flex items-center gap-1.5">
                                <Globe className="h-4 w-4" />
                                Website
                            </h4>
                            <a href={`https://${profile?.basic_profile?.website}`} className="text-sm text-primary hover:underline">
                                {profile?.basic_profile?.website}
                            </a>
                        </div>

                        <div className="col-span-full">
                            <h4 className="text-sm font-medium text-default-600 mb-2 flex items-center gap-1.5">
                                <Globe className="h-4 w-4" />
                                Social media
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {profile?.basic_profile?.socialFacebook && (
                                    <a href={`https://${profile?.basic_profile?.socialFacebook}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-default-600 hover:text-primary">
                                        <Facebook className="h-4 w-4" />
                                        Facebook
                                    </a>
                                )}
                                {profile?.basic_profile?.socialInstagram && (
                                    <a href={`https://${profile?.basic_profile?.socialInstagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-default-600 hover:text-primary">
                                        <Instagram className="h-4 w-4" />
                                        Instagram
                                    </a>
                                )}
                                {profile?.basic_profile?.socialLinkedIn && (
                                    <a href={`https://${profile?.basic_profile?.socialLinkedIn}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-default-600 hover:text-primary">
                                        <Linkedin className="h-4 w-4" />
                                        LinkedIn
                                    </a>
                                )}
                                {profile?.basic_profile?.socialTwitter && (
                                    <a href={`https://${profile?.basic_profile?.socialTwitter}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-default-600 hover:text-primary">
                                        <Twitter className="h-4 w-4" />
                                        Twitter
                                    </a>
                                )}
                                {profile?.basic_profile?.socialYouTube && (
                                    <a href={`https://${profile?.basic_profile?.socialYouTube}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-default-600 hover:text-primary">
                                        <Youtube className="h-4 w-4" />
                                        YouTube
                                    </a>
                                )}
                                {profile?.basic_profile?.socialOther && (
                                    <a href={`https://${profile?.basic_profile?.socialOther}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-default-600 hover:text-primary">
                                        <Globe className="h-4 w-4" />
                                        Other
                                    </a>
                                )}
                            </div>
                        </div>

                        <Field label="Weekday hours">
                            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-default-400" />{profile?.basic_profile?.operatingHoursWeekdays}</span>
                        </Field>
                        <Field label="Weekend hours">
                            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-default-400" />{profile?.basic_profile?.operatingHoursWeekends}</span>
                        </Field>
                        <Field label="Time zone">
                            <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-default-400" />{profile?.basic_profile?.operatingHoursTimeZone}</span>
                        </Field>
                    </div>
                </section>
            ) : (
                <p className='text-center text-sm text-default-500 py-8'>Profile not updated yet</p>
            )}
        </div>
    )
}

export default AgentProfile
