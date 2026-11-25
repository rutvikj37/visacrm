import { useParams } from 'react-router-dom'
import { Button, Tab, Tabs } from '@nextui-org/react'
import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import useApiCallUtils from '@/hooks/useApiCallUtils'
import LoginCodeDialog, { LoginCodeInfo } from '@/modules/Saas/LoginCodeDialog'
import AgentProfile from './Profile/AgentProfile'

const AgentDetails = () => {
  const { id } = useParams()
  const { commonPostAPICall } = useApiCallUtils()
  const [loginInfo, setLoginInfo] = useState<LoginCodeInfo>(null)
  const [busy, setBusy] = useState(false)

  // owner forgot passcode / locked out: clear it, sign out everywhere, show a one-time login code (also emailed)
  const resetPasscode = async () => {
    if (!window.confirm("Reset this agency owner's passcode? The current passcode stops working and they are signed out of all devices.")) return
    setBusy(true)
    const { success, data } = await commonPostAPICall({}, `saas_admin/agencies/${id}/reset_passcode`, true)
    setBusy(false)
    if (success && data?.login_code) setLoginInfo({ phone: data.phone, code: data.login_code, reset: true, emailedTo: data.email_sent ? "the agency's email" : null, loginUrl: data.login_url })
  }

  const tabs = [
    {
      id: "profile",
      label: "Basic Profile",
      content: <AgentProfile agentUuid={id}/>
    },
  ]

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agent details</h1>
          <p className="text-sm text-default-500">Profile and account information for this agent.</p>
        </div>
        <Button variant="flat" color="warning" startContent={<LockKeyhole size={16} />} isLoading={busy} onPress={resetPasscode}>
          Reset passcode
        </Button>
      </div>
      <Tabs aria-label="Agent sections" items={tabs} variant="underlined" size="sm">
        {(item) => (
          <Tab key={item.id} title={item.label}>
            {item.content}
          </Tab>
        )}
      </Tabs>
      <LoginCodeDialog info={loginInfo} onClose={() => setLoginInfo(null)} />
    </div>
  )
}

export default AgentDetails
