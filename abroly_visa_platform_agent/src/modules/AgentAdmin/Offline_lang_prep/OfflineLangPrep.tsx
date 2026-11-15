import { useState, useEffect } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import useApiCallUtils from "@/hooks/useApiCallUtils";
import { Button, Checkbox } from "@heroui/react";

const OfflineLangPrep = () => {
  const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();
  const [canAdd, setCanAdd] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLanguages, setSelectedLanguages] = useState([]);

  useEffect(() => {
    fetchAcceptanceStatus();
  }, []);

  const fetchAcceptanceStatus = async () => {
    const { data, success } = await commonGetAPICalls("/offline-language-prep/does_accept_offline");
    if (success) {
      setCanAdd(data.is_accept_offline);
      if (data.is_accept_offline) {
        fetchLanguages()
        fetchSelectedLanguages()
      };
    }
  };

  const fetchSelectedLanguages = async () => {
    const { data: selectedLangData, success: selectedLangSuccess } = await commonGetAPICalls("/offline-language-prep/selected_languages");
    if (selectedLangSuccess && selectedLangSuccess == true) {
      setSelectedLanguages([...selectedLangData]);
    }
  }

  const fetchLanguages = async () => {
    const { data, success } = await commonGetAPICalls("/offline-language-prep/list");
    if (success) setLanguages(data);
    setLoading(false);
  };

  const handleAcceptOffline = async () => {
    await commonPostAPICall({}, "/offline-language-prep/accept_offline");
    fetchAcceptanceStatus();
  };

  const handleLanguageSelection = async (id, checked) => {
    const {success} = await commonPostAPICall({
      [checked ? "select_language_id" : "deselect_langauge_id"]: id,
    }, "/offline-language-prep/manage_agent_languages", true);

    if(success && success == true) {
      fetchSelectedLanguages()
    }
  };

  return (
    <div className="p-6 bg-white shadow-md rounded-lg w-full container mx-auto">
      {!canAdd ? (
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-lg font-semibold mt-3">Offline Inquiries Disabled</h3>
          <p className="text-sm text-gray-600 mt-1">
            You need to update your profile to accept offline language preparation.
          </p>
          <Button color="primary" className="mt-4" onPress={handleAcceptOffline}>
            Accept Offline Inquiries
          </Button>
        </div>
      ) : (
        <div>
          <h3 className="text-md sm:text-lg font-semibold mb-3 flex items-center">
            <CheckCircle className="w-6 h-6 text-green-500 mr-2" /> Offline Language Selection
          </h3>
          <h1>Please Select language for you provide Offline Language Preparation Class</h1>
          {loading ? (
            <p>Loading available languages...</p>
          ) : (
            <div className="flex flex-col gap-2">
              {languages?.map((lang) => (
                <Checkbox
                  key={lang?.id}
                  isSelected={selectedLanguages?.includes(lang?.id)}
                  onChange={(e) => handleLanguageSelection(lang?.id, e.target.checked)}
                >
                  {lang.title}
                </Checkbox>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineLangPrep;
