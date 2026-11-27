import { useEffect, useState } from 'react'
import { Input } from 'rsuite';
import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { Plus, Trash } from 'lucide-react';
import useApiCallUtils from '@/hooks/useApiCallUtils';

const emptyBranch = () => ({
  _key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  streetAddress: '',
  city: '',
  stateProvince: '',
  country: '',
  postalCode: '',
})

const BranchAddress = () => {

  const { commonPostAPICall } = useApiCallUtils()

  const [isLoading, setIsLoading] = useState(true)
  const [branchOffices, setBranchOffices] = useState([emptyBranch()])

  useEffect(() => {
    getBranchAddress()
  }, [])

  const addBranchOffice = () => {
    setBranchOffices([...branchOffices, emptyBranch()]);
  };

  const removeBranchOffice = (indexRemove: number) => {
    setBranchOffices(branchOffices => branchOffices.filter((_, index) => index !== indexRemove))
  }

  const handleChangeAddress = (key: string, value: any, index: number) => {
    setBranchOffices((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  const getBranchAddress = async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setIsLoading(true)
    const { data, success } = await commonPostAPICall({}, "agent_profile/get_branch_office_address")
    if (success && success == true) {
      const rows = Array.isArray(data) && data.length ? data : [emptyBranch()]
      setBranchOffices(rows.map((row: any, i: number) => ({
        ...emptyBranch(),
        ...row,
        _key: row?._key || row?.id || row?.uuid || `branch-${i}`,
        streetAddress: row?.streetAddress ?? "",
        city: row?.city ?? "",
        stateProvince: row?.stateProvince ?? "",
        country: row?.country ?? "",
        postalCode: row?.postalCode ?? "",
      })))
    }
    setIsLoading(false)
  }

  const updateBranchAddressApiCall = async () => {
    const payload = branchOffices.map(({ _key, ...rest }) => rest)
    const { success } = await commonPostAPICall({ branchOffices: payload }, "agent_profile/update_branch_office_address", true)
    if (success && success == true) {
      getBranchAddress({ soft: true })
    }
  }

  return (
    <div>
      {isLoading == true ? <div className='flex items-center justify-center my-5'><Spinner /></div> :
        <div className="p-2 sm:p-4 w-full max-w-3xl space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Branch Offices</h3>
            <p className="text-sm text-default-500">Do you have any branch offices? If yes, please provide the details for each branch.</p>
          </div>

          <div className="space-y-3">
            {branchOffices.map((branch, index) => (
              <Card key={branch._key || index} className="w-full" shadow="sm">
                <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                  <div className="sm:col-span-2">
                    <label className="text-sm text-default-600">Street Address</label>
                    <Input
                      className="w-full"
                      style={{ width: '100%' }}
                      onChange={(e) => handleChangeAddress("streetAddress", e, index)}
                      value={branch.streetAddress}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-default-600">City</label>
                    <Input
                      className="w-full"
                      style={{ width: '100%' }}
                      onChange={(e) => handleChangeAddress("city", e, index)}
                      value={branch.city}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-default-600">State/Province</label>
                    <Input
                      className="w-full"
                      style={{ width: '100%' }}
                      onChange={(e) => handleChangeAddress("stateProvince", e, index)}
                      value={branch.stateProvince}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-default-600">Country</label>
                    <Input
                      className="w-full"
                      style={{ width: '100%' }}
                      onChange={(e) => handleChangeAddress("country", e, index)}
                      value={branch.country}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-default-600">Postal Code</label>
                    <Input
                      className="w-full"
                      style={{ width: '100%' }}
                      onChange={(e) => handleChangeAddress("postalCode", e, index)}
                      value={branch.postalCode}
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <Button
                      onPress={() => removeBranchOffice(index)}
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      aria-label={`Remove branch ${index + 1}`}
                      isDisabled={branchOffices.length <= 1}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-tiny text-default-500">Press Update after making changes.</p>
            <div className="flex gap-2">
              <Button variant="flat" startContent={<Plus className="w-4 h-4" />} onPress={addBranchOffice}>
                Add branch
              </Button>
              <Button onPress={updateBranchAddressApiCall} color="primary">Update</Button>
            </div>
          </div>
        </div>
      }
    </div>
  )
}

export default BranchAddress
