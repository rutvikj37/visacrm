import { useParams } from 'react-router-dom'
import { Tab, Tabs } from '@nextui-org/react'
import AgentProfile from './Profile/AgentProfile'

const AgentDetails = () => {
  const { id } = useParams()

  const tabs = [
    {
      id: "profile",
      label: "Basic Profile",
      content: <AgentProfile agentUuid={id}/>
    },
  ]

  return (
    <div className="flex w-full flex-col gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Agent details</h1>
        <p className="text-sm text-default-500">Profile and account information for this agent.</p>
      </div>
      <Tabs aria-label="Agent sections" items={tabs} variant="underlined" size="sm">
        {(item) => (
          <Tab key={item.id} title={item.label}>
            {item.content}
          </Tab>
        )}
      </Tabs>
    </div>
  )
}

export default AgentDetails
