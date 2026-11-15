import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import LeadsCalendarList from './LeadsCalendarList';

const LeadCalendarPopup = ({ lead_id, isOpen, setIsOpen }: { lead_id: any; isOpen: boolean; setIsOpen: (open: boolean) => void }) => {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule</DialogTitle>
        </DialogHeader>
        {lead_id != null ? <LeadsCalendarList lead_id={lead_id} /> : null}
      </DialogContent>
    </Dialog>
  );
};

export default LeadCalendarPopup;
