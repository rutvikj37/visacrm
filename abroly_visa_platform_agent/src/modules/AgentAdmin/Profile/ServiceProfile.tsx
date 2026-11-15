import React, { useEffect, useState } from "react";
import { Nav } from "rsuite";
import { LucideIcon } from "lucide-react";
import "rsuite/dist/rsuite.min.css";
import { Button, Chip, useDisclosure } from "@heroui/react";
import { commonPostAPICall } from "@/utils/ApiCallUtils";
import ReactFlagsSelect from 'react-flags-select'
import CommonConfirmation from "@/components/CommonConfirmation";
import { countries } from 'country-data'
import ReactCountryFlag from "react-country-flag";

const AgentServiceDetails = () => {
  const [formData, setFormData] = useState({});
  const [activeKey, setActiveKey] = useState("academic");

  const [country, setCountry] = useState("")
  const [addCountryFlag, setAddCountryFlag] = useState(false)

  const [allCountries, setAllCountries] = useState([])

  const handleInputChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    getServiceProfile();
    getSpecializationCountry()
  }, []);

  const renderBooleanField = (key, label, dependencyKey = null, children = null) => (
    <div className="mb-4">
      <label className="flex items-center space-x-3">
        <input
          type="checkbox"
          className="w-5 h-5 text-blue-500"
          checked={formData?.[key] || false}
          onChange={(e) => handleInputChange(key, e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {formData?.[key] && dependencyKey && children}
    </div>
  );

  const renderTextInput = (key, label) => (
    <div className="mb-4">
      <label className="block text-gray-700 mb-2">{label}</label>
      <input
        type="text"
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
        value={formData?.[key] || ""}
        onChange={(e) => handleInputChange(key, e.target.value)}
      />
    </div>
  );

  const renderTextArea = (key, label) => (
    <div className="mb-4">
      <label className="block text-gray-700 mb-2">{label}</label>
      <textarea
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
        rows={4}
        value={formData?.[key] || ""}
        onChange={(e) => handleInputChange(key, e.target.value)}
      />
    </div>
  );

  const handleSubmit = async () => {
    const { data, success } = await commonPostAPICall({ ...formData }, "/agent_profile/update_service_profile", true)
    if (success) {
      getServiceProfile()
    }
  }

  const getServiceProfile = async () => {
    const { data, success } = await commonPostAPICall({}, "/agent_profile/get_service_profile")
    if (success) {
      if (data !== null) {
        setFormData(data)
      }
    }
  }
  const getSpecializationCountry = async () => {
    const { data, success } = await commonPostAPICall({}, "/agent_profile/get_specialization_country")
    if (success) {
      setAllCountries(data)
    }
  }

  const handleSpecializationCountryAdd = async () => {
    const { data, success } = await commonPostAPICall({ country: country }, "/agent_profile/add_specialization_country", true)
    if (success) {
      getSpecializationCountry()
    }
    setAddCountryFlag(false)
    setCountry("")
  }

  const { isOpen: isDeleteOpen, onOpenChange: onDeleteOpenChange } = useDisclosure()
  const [deleteCountry, setDeleteCountry] = useState("")

  const handleSpecializationCountryDelete = async () => {
    const { data, success } = await commonPostAPICall({ country: deleteCountry }, "/agent_profile/delete_specialization_country", true)
    if (success) {
      getSpecializationCountry()
    }
    setDeleteCountry("")
    onDeleteOpenChange()
  }

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Service profile</h1>
        <p className="text-sm text-default-500">What your agency offers — shown to students on the portal</p>
      </div>
      <Nav
        appearance="tabs"
        activeKey={activeKey}
        onSelect={setActiveKey}
        className="text-sm w-full overflow-x-auto"
      >
        <Nav.Item eventKey="academic">Academic & Course Guidance</Nav.Item>
        <Nav.Item eventKey="Country_Specializations">Country Specializations</Nav.Item>
        <Nav.Item eventKey="visa">Visa Assistance</Nav.Item>
        <Nav.Item eventKey="application">Application & Documentation Support</Nav.Item>
        <Nav.Item eventKey="scholarship">Scholarship & Budget Planning</Nav.Item>
        <Nav.Item eventKey="career">Career & Internship Services</Nav.Item>
        <Nav.Item eventKey="support">Additional Support Services</Nav.Item>
      </Nav>

      {activeKey === "academic" && (
        <div className="w-full min-w-0 max-w-3xl space-y-3">
          {renderBooleanField("courseAdvisors", "Do you offer course advising services?", "courseSpecialization", renderTextInput("courseSpecialization", "Specialization in course types (e.g., undergraduate, postgraduate)"))}
          {renderBooleanField("universityRecommendations", "Do you provide university recommendations to students?", "partneredUniversities", renderTextInput("partneredUniversities", "List of partnered universities"))}
          {renderTextInput("fieldExpertise", "What fields of study do you specialize in?")}
        </div>
      )}

      {activeKey === "Country_Specializations" && (
        <div className="w-full min-w-0 max-w-3xl space-y-3">

          <Button size="sm" color="primary" isDisabled={addCountryFlag} onPress={() => setAddCountryFlag(true)} variant="bordered">Add Country For Specialization</Button>
          {addCountryFlag == true && <div>

            <label className="text-sm font-medium">Country</label>
            <ReactFlagsSelect
              selected={country}
              searchable={true}
              onSelect={(e) => setCountry(e)}
              className="w-full"
            />
            <div className="flex flex-row gap-2">

              {country !== "" &&
                <Button color="primary" onPress={handleSpecializationCountryAdd} variant="shadow">Add Country</Button>
              }
              <Button color="danger" onPress={() => setAddCountryFlag(false)} variant="shadow">Cancel</Button>
            </div>
          </div>
          }

          <div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              {allCountries?.map((country, index) => (
                <Chip
                  startContent={<ReactCountryFlag countryCode={country?.country} svg className="text-2xl p-1" />}
                  variant="faded"
                  color="default"
                  onClose={() => {
                    setDeleteCountry(country?.country)
                    onDeleteOpenChange()
                  }}>{countries[country?.country]?.name || country?.country}</Chip>
              ))}
            </div>
          </div>

        </div>
      )}

      {activeKey === "visa" && (
        <div className="w-full min-w-0 max-w-3xl space-y-3">
          {renderBooleanField("visaConsultancy", "Do you provide visa consultancy services?", "visaSpecialization", renderTextInput("visaSpecialization", "Specialization in visa types (e.g., student visa, work visa)"))}
          {renderBooleanField("visaSuccessRate", "Do you track visa success rates for your clients?", "visaSuccessRateDetails", renderTextInput("visaSuccessRateDetails", "Share your visa success rate"))}
          {renderBooleanField("workVisaHelp", "Do you assist with work visa applications?", "workVisaExperience", renderTextInput("workVisaExperience", "Share your work visa experience"))}
        </div>
      )}

      {activeKey === "application" && (
        <div className="w-full min-w-0 max-w-3xl space-y-3">
          {renderBooleanField("applicationReview", "Do you offer application review services?")}
          {renderBooleanField("applicationTracking", "Can you help students track the status of their applications?")}
          {renderBooleanField("documentPreparation", "Do you assist students with document preparation?", "documentExamples", renderTextArea("documentExamples", "Provide examples of SOPs or document preparation services"))}
        </div>
      )}

      {activeKey === "scholarship" && (
        <div className="w-full min-w-0 max-w-3xl space-y-3">
          {renderBooleanField("scholarshipAssistance", "Do you offer scholarship assistance?", "scholarshipDetails", renderTextInput("scholarshipDetails", "List of available scholarships and eligibility criteria"))}
          {renderBooleanField("budgetPlanning", "Do you provide financial planning services for students?", "budgetDetails", renderTextInput("budgetDetails", "Services like tuition fee estimation and budgeting advice"))}
        </div>
      )}

      {activeKey === "career" && (
        <div className="w-full min-w-0 max-w-3xl space-y-3">
          {renderBooleanField("careerConsulting", "Do you offer career consulting services?", renderTextInput("careerConsultingDetails", "Specify areas of career consulting"))}
          {renderBooleanField("jobPlacement", "Do you provide job placement services for students after graduation?")}
          {renderBooleanField("internshipPrograms", "Do you offer internship programs for students?")}
          {renderBooleanField("postGraduationJobs", "Do you assist with post-graduation job placement?")}
        </div>
      )}

      {activeKey === "support" && (
        <div className="w-full min-w-0 max-w-3xl space-y-3">
          {renderBooleanField("partTimeJobs", "Do you assist students in finding part-time jobs during their studies?", "partTimeJobsText", renderTextArea("partTimeJobsText", "Industries or roles where part-time opportunities are available"))}
          {renderBooleanField("sopWriting", "Do you offer SOP writing services?", "sopWritingText", renderTextArea("sopWritingText", "Sample SOPs or editing services you provide"))}
          {renderBooleanField("flightTicketAssistance", "Do you offer flight ticket booking assistance?")}
          {renderBooleanField("languagePrep", "Do you offer language preparation courses??","languagePrepDetails", renderTextArea("languagePrepDetails", "Provide details of language preparation courses"))}
          {renderBooleanField("testPrep", "Do you offer test preparation courses?")}
          {renderBooleanField("accommodationHelp", "Do you assist with accommodation arrangements ?","accommodationHelpText", renderTextArea("accommodationHelpText", "Details about accommodation assistance"))}
          {renderBooleanField("healthInsuranceOptions", "Do you provide health insurance options ?","healthInsuranceOptionsText", renderTextArea("healthInsuranceOptionsText", "Details about health insurance options"))}
        </div>
      )}

      {activeKey !== "Country_Specializations" &&
        <Button onPress={handleSubmit} variant="shadow" color="primary" className="w-full sm:w-auto">Update Details</Button>
      }

      <CommonConfirmation
        isOpen={isDeleteOpen}
        onOpenChange={onDeleteOpenChange}
        title={"Are you sure want to delete ?"}
        handleSubmit={() => {
          handleSpecializationCountryDelete()
        }}
        nagativeTitle={"No"}
        positiveTitle={"Yes"}
      />

    </div>
  );
};

export default AgentServiceDetails;