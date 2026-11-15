import React, { useEffect, useState } from 'react'
import 'rsuite/dist/rsuite.min.css';
import { Nav } from 'rsuite';
import BranchAddress from './BasicProfile/BranchAddress';
import BasicAboutUs from './BasicProfile/BasicAboutUs';
import BasicOfficeAddress from './BasicProfile/BasicOfficeAddress';
import BasicContact from './BasicProfile/BasicContact';
import BasicProfileOpeningHours from './BasicProfile/BasicProfileOpeningHours';
import { User, MapPin, Building2, Clock, Phone } from 'lucide-react';

const TAB_KEYS = ['about_us', 'office_address', 'branch_office', 'opening_hours', 'contact_us'] as const
type TabKey = (typeof TAB_KEYS)[number]

const TAB_META: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'about_us', label: 'About you', icon: <User className="w-4 h-4" /> },
  { key: 'office_address', label: 'Address', icon: <MapPin className="w-4 h-4" /> },
  { key: 'branch_office', label: 'Branch office', icon: <Building2 className="w-4 h-4" /> },
  { key: 'opening_hours', label: 'Hours', icon: <Clock className="w-4 h-4" /> },
  { key: 'contact_us', label: 'Contact', icon: <Phone className="w-4 h-4" /> },
]

const BasicProfile = () => {
  const [activeKey, setActiveKey] = useState<TabKey>('about_us');
  // Keep visited tabs mounted so switching does not remount forms / Places / Quill
  const [mounted, setMounted] = useState<Partial<Record<TabKey, boolean>>>({ about_us: true });

  useEffect(() => {
    setMounted((prev) => (prev[activeKey] ? prev : { ...prev, [activeKey]: true }))
  }, [activeKey])

  return (
    <div className="flex flex-col gap-4 p-1 sm:p-2 max-w-full profile-tabs">
      <style>{`
        .profile-tabs .rs-nav-tabs {
          border-bottom: 1px solid hsl(var(--heroui-default-200) / 1) !important;
        }
        .profile-tabs .rs-nav-item {
          border-radius: 8px 8px 0 0 !important;
          margin-right: 2px !important;
          flex-shrink: 0 !important;
          color: hsl(var(--heroui-default-600)) !important;
        }
        .profile-tabs .rs-nav-item:hover {
          background-color: hsl(var(--heroui-default-100)) !important;
        }
        .profile-tabs .rs-nav-item.rs-nav-item-active {
          background-color: hsl(var(--heroui-primary) / 0.12) !important;
          color: hsl(var(--heroui-primary)) !important;
          font-weight: 600 !important;
          border-bottom: 2px solid hsl(var(--heroui-primary)) !important;
        }
        .profile-tabs .rs-nav-item.rs-nav-item-active .tab-icon {
          color: hsl(var(--heroui-primary)) !important;
        }
        .profile-tabs .tab-icon {
          color: hsl(var(--heroui-default-500));
          display: flex;
          align-items: center;
        }
      `}</style>

      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Basic profile</h1>
        <p className="text-sm text-default-500">Agency details students see on your portal</p>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <Nav
          appearance="tabs"
          activeKey={activeKey}
          onSelect={(key) => key && setActiveKey(key as TabKey)}
          className="text-sm w-full"
          pullRight={false}
          style={{ display: 'flex', flexWrap: 'nowrap', gap: '2px' }}
        >
          {TAB_META.map((tab) => (
            <Nav.Item
              key={tab.key}
              eventKey={tab.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                fontWeight: activeKey === tab.key ? 600 : 500,
              }}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </Nav.Item>
          ))}
        </Nav>
      </div>

      <div className="rounded-xl border border-default-200 bg-content1 p-3 sm:p-5 min-w-0 overflow-x-auto">
        {mounted.about_us && (
          <div className={activeKey === 'about_us' ? undefined : 'hidden'} aria-hidden={activeKey !== 'about_us'}>
            <BasicAboutUs />
          </div>
        )}
        {mounted.office_address && (
          <div className={activeKey === 'office_address' ? undefined : 'hidden'} aria-hidden={activeKey !== 'office_address'}>
            <BasicOfficeAddress />
          </div>
        )}
        {mounted.branch_office && (
          <div className={activeKey === 'branch_office' ? undefined : 'hidden'} aria-hidden={activeKey !== 'branch_office'}>
            <BranchAddress />
          </div>
        )}
        {mounted.opening_hours && (
          <div className={activeKey === 'opening_hours' ? undefined : 'hidden'} aria-hidden={activeKey !== 'opening_hours'}>
            <BasicProfileOpeningHours />
          </div>
        )}
        {mounted.contact_us && (
          <div className={activeKey === 'contact_us' ? undefined : 'hidden'} aria-hidden={activeKey !== 'contact_us'}>
            <BasicContact />
          </div>
        )}
      </div>
    </div>
  );
}

export default BasicProfile
