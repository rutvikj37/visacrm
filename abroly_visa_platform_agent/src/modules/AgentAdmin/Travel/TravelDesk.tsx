import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { BarChart3, Map, Plus } from "lucide-react";
import useModules from "@/hooks/useModules";
import { PageHead } from "./travelShared";
import TravelDashboard from "./TravelDashboard";

/** Travel desk: the full travel dashboard - KPIs, today's to-dos and trends (RP-01). */
const TravelDesk = () => {
    const navigate = useNavigate();
    const { has } = useModules();
    return (
        <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-6xl">
            <PageHead
                title="Travel desk"
                sub="How the travel business is doing and what needs you today"
                actions={<>
                    <Button variant="flat" startContent={<BarChart3 size={16} />} onPress={() => navigate("/travel/reports")}>Reports</Button>
                    {has("itinerary") && <Button variant="flat" startContent={<Map size={16} />} onPress={() => navigate("/travel/itineraries?new=1")}>New itinerary</Button>}
                    <Button color="primary" startContent={<Plus size={16} />} onPress={() => navigate("/crm/leads?new=travel")}>New enquiry</Button>
                </>}
            />
            <TravelDashboard />
        </div>
    );
};

export default TravelDesk;
