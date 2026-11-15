import React, { useState, useEffect } from 'react';
import { Input, Button, Textarea, Switch } from '@nextui-org/react';
import axios from 'axios';
import useApiCallUtils from '@/hooks/useApiCallUtils';

const PackageAddUpdate = ({ packageUuid, onFormSubmit }) => {

  const { commonGetAPICalls, commonPostAPICall } = useApiCallUtils()

  const [packageName, setPackageName] = useState('');
  const [packageUUID, setPackageUUID] = useState('');
  const [description, setDescription] = useState('');
  const [leadLimit, setLeadLimit] = useState('');
  const [price, setPrice] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [teamLimit, setTeamLimit] = useState("")
  const [jobPostLimit, setJobPostLimit] = useState("")
  const [job_post_days, setJobPostDays] = useState("")
  const [achievement_banner, setAchievementBanner] = useState("")
  const [can_add_offline_lead, setCanAddOfflineLead] = useState(false)
  const [pin_days, setPinDays] = useState(0)

  const onSuccess = async () => {
    const packageData = {
      name: packageName,
      description,
      leadLimit,
      price,
      uuid: packageUUID,
      teamLimit,
      jobPostLimit,
      job_post_days,
      achievement_banner,
      can_add_offline_lead,
      pin_days
    };

    const { success } = await commonPostAPICall(packageData, isUpdating ? `packages/update` : `packages/add`, true);

    if (success && success === true) {
      onFormSubmit(); // Notify the parent component to refresh the list
    }
  };

  useEffect(() => {
    // If packageUuid is provided, we're in update mode
    if (packageUuid) {
      setIsUpdating(true);
      // Fetch the package details to populate the form
      const fetchPackage = async () => {
        try {
          const { data, success } = await commonGetAPICalls(`/packages/details/${packageUuid}`);
          if (success && success == true) {
            setPackageName(data?.name);
            setDescription(data?.description);
            setLeadLimit(data?.leadLimit);
            setPrice(data?.price);
            setPackageUUID(data?.id);
            setTeamLimit(data?.teamLimit)
            setJobPostLimit(data?.jobPostLimit)
            setJobPostDays(data?.job_post_days)
            setJobPostDays(data?.can_add_offline_lead)
            setJobPostDays(data?.pin_days)
          }
        } catch (error) {
          console.error("Error fetching package", error);
        }
      };

      fetchPackage();
    }
  }, [packageUuid]);

  return (
    <div className="p-6 overflow-y-scroll">
      <h2 className="text-2xl font-bold mb-2">{isUpdating ? 'Update Package' : 'Create New Package'}</h2>

      <section className='grid grid-cols-2 gap-2'>


        <Input
          placeholder="Package Name"
          label="Package Name"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          className="mb-4"
        />

        <Input
          placeholder="Lead Limit"
          label="Lead Limit"
          type="number"
          value={leadLimit}
          onChange={(e) => setLeadLimit(e.target.value)}
          className="mb-4"
        />

        <Input
          placeholder="Team Limit"
          label="Team Limit"
          type="number"
          value={teamLimit}
          onChange={(e) => setTeamLimit(e.target.value)}
          className="mb-4"
        />

        <Input
          placeholder="Job Post Limit"
          label="Job Post Limit"
          type="number"
          value={jobPostLimit}
          onChange={(e) => setJobPostLimit(e.target.value)}
          className="mb-4"
        />

        <Input
          placeholder="Job Post Days"
          label="Job Post Days"
          type="number"
          value={job_post_days}
          onChange={(e) => setJobPostDays(e.target.value)}
          className="mb-4"
        />

        <Input
          placeholder="Price"
          label="Price"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mb-4"
        />

        <Input
          placeholder="Number of Achievements for month"
          label="Achievement"
          type="number"
          value={achievement_banner}
          onChange={(e) => setAchievementBanner(e.target.value)}
          className="mb-4"
        />

        <Textarea
          placeholder="Description"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-4 col-span-2"
        />

        {/* <Input
          placeholder="Profile Pinning"
          label="Days for Profile Pinning (from now)"
          type="number"
          value={pin_days}
          onChange={(e) => setPinDays(e.target.value)}
          className="mb-4"
        /> */}
        <div className='flex gap-2 items-center mb-4'>
          <p>Can Add Offline Lead</p>
          <Switch
            color="success"
            isSelected={can_add_offline_lead}
            onValueChange={(value) => setCanAddOfflineLead(value)}
            size="lg"
          />
        </div>
      </section>

      <Button
        color='primary'
        onPress={onSuccess}>
        {isUpdating ? 'Update Package' : 'Create Package'}
      </Button>
    </div>
  );
};

export default PackageAddUpdate;
