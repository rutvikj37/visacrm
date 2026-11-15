import useApiCallUtils from "@/hooks/useApiCallUtils";
import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Search, XCircle } from "lucide-react";
import moment from "moment";
import { useState } from "react";
import { DateRangePicker } from "rsuite";

const OfflineInquiries = () => {
  const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils();

  // Default range: Last 30 days
  const [dateRange, setDateRange] = useState<[Date, Date]>([
    moment().subtract(30, "days").toDate(),
    moment().toDate(),
  ]);

  // Fetch agent's acceptance status
  const { data: acceptanceData, refetch: refetchAcceptance } = useQuery({
    queryKey: ["acceptanceStatus"],
    queryFn: async () => {
      const response = await commonGetAPICalls("/offline-language-prep/does_accept_offline");
      return response;
    },
  });

  const isAcceptOffline = acceptanceData?.data?.is_accept_offline ?? false;

  // Fetch offline inquiries based on date range filter
  const { data: inquiriesData, isLoading, refetch: refetchInquiries } = useQuery({
    queryKey: ["offlineInquiries", dateRange],
    queryFn: async () => {
      if (!isAcceptOffline) return { data: [] };
      const response = await commonGetAPICalls(
        `/offline-language-prep/inquiries?startDate=${moment(dateRange[0]).format("YYYY-MM-DD")}&endDate=${moment(dateRange[1]).format("YYYY-MM-DD")}`
      );
      return response?.success ? response?.data : [];
    },
    enabled: !!isAcceptOffline, // Fetch only if agent accepts offline inquiries
  });

  const handleAcceptOffline = async () => {
    await commonPostAPICall({}, "/offline-language-prep/accept_offline");
    refetchAcceptance();
  };

  return (
    <div className="p-6 bg-white shadow-md rounded-lg w-full container mx-auto">
      {!isAcceptOffline ? (
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
            <CheckCircle className="w-6 h-6 text-green-500 mr-2" /> Offline Language Preparation Inquiries
          </h3>

          {/* Date Range Filter */}
          <div className="flex space-x-4 mb-4">
            <DateRangePicker 
              value={dateRange} 
              onChange={(range) => setDateRange(range || [moment().subtract(30, "days").toDate(), moment().toDate()])} 
              format="dd MMM yyyy"
              placeholder="Select date range"
            />
            <Button size="sm" variant="shadow" startContent={<Search size={12}/>} color="primary" onPress={() => refetchInquiries()}>Filter</Button>
          </div>

          {isLoading ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {inquiriesData?.length > 0 ? (
                inquiriesData?.map((inquiry) => (
                  <Card key={inquiry?.id} >
                    <CardBody className="p-4">
                    <h4 className="text-md font-semibold">{inquiry?.student?.username ?? "N/A"}</h4>
                    <p className="text-sm text-gray-700">
                      Email: {inquiry?.student?.email ?? "N/A"}
                    </p>
                    <p className="text-sm text-gray-700">
                      Phone: {inquiry?.student?.country_code ?? ""} {inquiry?.student?.phone_number ?? "N/A"}
                    </p>
                    <p className="text-sm text-gray-700">{new Date(inquiry?.createdAt).toLocaleString()}</p>
                    </CardBody>
                  </Card>
                ))
              ) : (
                <p className="text-gray-500 text-center col-span-4">No inquiries found</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OfflineInquiries;
