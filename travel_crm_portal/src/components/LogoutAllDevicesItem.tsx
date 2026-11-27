import { MonitorX } from "lucide-react"
import { useDisclosure } from "@nextui-org/react"
import { useNavigate } from "react-router-dom"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import CommonConfirmation from "@/components/CommonConfirmation"
import useApiCallUtils from "@/hooks/useApiCallUtils"
import { handleLogout } from "@/utils/LogoutUtils"

/** Account menu item: sign this account out on every device (lost phone, shared computer). */
const LogoutAllDevicesItem = () => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure()
  const { commonPostAPICall } = useApiCallUtils()
  const navigate = useNavigate()
  return (
    <>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onOpen() }}>
        <MonitorX />
        Log out all devices
      </DropdownMenuItem>
      <CommonConfirmation
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        title={"Log out on every phone and computer where this account is signed in, including this one?"}
        handleSubmit={async () => {
          await commonPostAPICall({}, "user/student/logout_all", true)
          handleLogout(navigate)
        }}
        nagativeTitle={"No"}
        positiveTitle={"Yes, log out everywhere"}
      />
    </>
  )
}

export default LogoutAllDevicesItem
