import React, { useEffect, useState } from "react";
import { Input, InputGroup, Form, Notification, useToaster } from "rsuite";
import { Facebook, Instagram, Linkedin, Twitter, Youtube, Globe, Mail, Phone, MessageCircle, FacebookIcon } from "lucide-react";
import { BsMeta } from "react-icons/bs";
import { commonPostAPICall } from "@/utils/ApiCallUtils";
import { Button, Spinner } from "@heroui/react";

const BasicContact = () => {
    const [isLoading, setIsLoading] = useState(false)
    const [socialFacebook, setsocialFacebook] = useState("");
    const [socialInstagram, setsocialInstagram] = useState("");
    const [socialLinkedIn, setsocialLinkedIn] = useState("");
    const [socialTwitter, setsocialTwitter] = useState("");
    const [socialYouTube, setsocialYouTube] = useState("");
    const [socialOther, setsocialOther] = useState("");
    const [contactEmail, setcontactEmail] = useState("");
    const [contactPhoneNumber, setcontactPhoneNumber] = useState("");
    const [contactWhatsApp, setcontactWhatsApp] = useState("");

    useEffect(() => {
        getBasicContact()
    }, [])

    const getBasicContact = async (opts?: { soft?: boolean }) => {
        if (!opts?.soft) setIsLoading(true)
        const { data, success } = await commonPostAPICall({}, "agent_profile/get_contact_profile")
        if (success && success == true) {

            if (data) {
                setsocialFacebook(data?.socialFacebook ?? "")
                setsocialInstagram(data?.socialInstagram ?? "")
                setsocialLinkedIn(data?.socialLinkedIn ?? "")
                setsocialTwitter(data?.socialTwitter ?? "")
                setsocialYouTube(data?.socialYouTube ?? "")
                setsocialOther(data?.socialOther ?? "")
                setcontactEmail(data?.contactEmail ?? "")
                setcontactPhoneNumber(data?.contactPhoneNumber ?? "")
                setcontactWhatsApp(data?.contactWhatsApp ?? "")
            }
        }
        setIsLoading(false)
    }

    const handleSubmit = async () => {

        const { success } = await commonPostAPICall({
            socialFacebook,
            socialInstagram,
            socialLinkedIn,
            socialTwitter,
            socialYouTube,
            socialOther,
            contactEmail,
            contactPhoneNumber,
            contactWhatsApp,
        }, "agent_profile/update_basic_profile", true)
        if (success && success == true) {
            getBasicContact({ soft: true })
        }
    };

    return (
        <div className="mx-auto p-6">
            {isLoading == true ? <div className='flex items-center justify-center my-5'><Spinner /></div> :
                <Form layout="vertical" className="container mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {/* Social Media Links */}
                    <InputGroup inside className="mb-4">
                        <InputGroup.Addon>
                            <FacebookIcon className="text-blue-600" />
                        </InputGroup.Addon>
                        <Input
                            placeholder="Facebook"
                            value={socialFacebook}
                            onChange={(value) => setsocialFacebook(value)}
                        />
                    </InputGroup>

                    <InputGroup inside className="mb-4">
                        <InputGroup.Addon>
                            <Instagram className="text-pink-600" />
                        </InputGroup.Addon>
                        <Input
                            placeholder="Instagram"
                            value={socialInstagram}
                            onChange={(value) => setsocialInstagram(value)}
                        />
                    </InputGroup>

                    <InputGroup inside className="mb-4">
                        <InputGroup.Addon>
                            <Linkedin className="text-blue-500" />
                        </InputGroup.Addon>
                        <Input
                            placeholder="LinkedIn"
                            value={socialLinkedIn}
                            onChange={(value) => setsocialLinkedIn(value)}
                        />
                    </InputGroup>

                    <InputGroup inside className="mb-4">
                        <InputGroup.Addon>
                            <Twitter className="text-blue-400" />
                        </InputGroup.Addon>
                        <Input
                            placeholder="Twitter"
                            value={socialTwitter}
                            onChange={(value) => setsocialTwitter(value)}
                        />
                    </InputGroup>

                    <InputGroup inside className="mb-4">
                        <InputGroup.Addon>
                            <Youtube className="text-red-600" />
                        </InputGroup.Addon>
                        <Input
                            placeholder="YouTube"
                            value={socialYouTube}
                            onChange={(value) => setsocialYouTube(value)}
                        />
                    </InputGroup>

                    <InputGroup inside className="mb-4">
                        <InputGroup.Addon>
                            <Globe className="text-gray-500" />
                        </InputGroup.Addon>
                        <Input
                            placeholder="Other Social Link"
                            value={socialOther}
                            onChange={(value) => setsocialOther(value)}
                        />
                    </InputGroup>

                    {/* Contact Information */}
                    <InputGroup inside className="mb-4">
                        <InputGroup.Addon>
                            <Mail className="text-gray-600" />
                        </InputGroup.Addon>
                        <Input
                            placeholder="Email"
                            type="email"
                            value={contactEmail}
                            onChange={(value) => setcontactEmail(value)}
                        />
                    </InputGroup>

                    <InputGroup inside className="mb-4">
                        <InputGroup.Addon>
                            <Phone className="text-green-600" />
                        </InputGroup.Addon>
                        <Input
                            placeholder="Phone Number"
                            type="tel"
                            value={contactPhoneNumber}
                            onChange={(value) => setcontactPhoneNumber(value)}
                        />
                    </InputGroup>

                    <InputGroup inside className="mb-4">
                        <InputGroup.Addon>
                            <MessageCircle className="text-blue-500" />
                        </InputGroup.Addon>
                        <Input
                            placeholder="WhatsApp"
                            type="tel"
                            value={contactWhatsApp}
                            onChange={(value) => setcontactWhatsApp(value)}
                        />
                    </InputGroup>


                </Form>
            }
            {isLoading == false &&
                <Button variant='shadow' color="primary" onPress={handleSubmit} className="mt-4 w-fit">
                    Update
                </Button>
            }
        </div>
    );
}

export default BasicContact