'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/icon'

interface NotificationSetting {
  key: string
  label: string
  description: string
  enabled: boolean
}

const defaultSettings: NotificationSetting[] = [
  {
    key: 'marketing',
    label: 'Marketing Updates',
    description: 'Receive emails about new features and promotions',
    enabled: false,
  },
  {
    key: 'brand_tips',
    label: 'Brand Tips',
    description: 'Get tips on improving your brand presence',
    enabled: false,
  },
  {
    key: 'slides_ready',
    label: 'Slides Ready',
    description: 'Be notified when your carousel slides are generated',
    enabled: true,
  },
  {
    key: 'customer_service',
    label: 'Customer Service',
    description: 'Receive responses from our support team',
    enabled: true,
  },
]

const STORAGE_KEY = 'slideai-notification-settings'

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>(defaultSettings)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>
        setSettings((prev) =>
          prev.map((s) => ({
            ...s,
            enabled: parsed[s.key] !== undefined ? parsed[s.key] : s.enabled,
          }))
        )
      }
    } catch {
      // Ignore parse errors
    }
  }, [])

  function toggleSetting(key: string) {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    )
    setMessage(null)
  }

  function handleSave() {
    const values: Record<string, boolean> = {}
    for (const s of settings) {
      values[s.key] = s.enabled
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    setMessage('Notification preferences saved.')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Icon name="notifications" size="lg" className="text-[#3d0000]" />
        <div>
          <h1 className="text-2xl font-bold text-[#3d0000]">Notifications</h1>
          <p className="text-sm text-[#7d6161]">Choose what notifications you receive</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-8 border border-[#dbc1bc]/10">
        <div className="space-y-1">
          {settings.map((setting, idx) => (
            <div
              key={setting.key}
              className={`flex items-center justify-between py-4 ${
                idx < settings.length - 1 ? 'border-b border-[#dbc1bc]/10' : ''
              }`}
            >
              <div>
                <p className="text-sm font-medium text-[#3d0000]">{setting.label}</p>
                <p className="text-xs text-[#7d6161] mt-0.5">{setting.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={setting.enabled}
                onClick={() => toggleSetting(setting.key)}
                className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                  setting.enabled ? 'bg-[#3d0000]' : 'bg-[#dbc1bc]/30'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
                    setting.enabled ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Message */}
        {message && (
          <div className="mt-4 p-3 rounded-xl text-sm bg-green-50 text-green-700 border border-green-200">
            {message}
          </div>
        )}

        {/* Save */}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            className="bg-[#3d0000] text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all hover:bg-[#3d0000]/90 active:scale-95"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}
