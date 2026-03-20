'use client'

import { useEffect, useState, useTransition } from 'react'
import { Icon } from '@/components/ui/icon'
import { getProfile, saveProfile } from './actions'

export default function ProfilePage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    getProfile().then((profile) => {
      if (profile) {
        setFirstName(profile.firstName)
        setLastName(profile.lastName)
        setEmail(profile.email)
        setPhone(profile.phone)
      }
    })
  }, [])

  function handleSave() {
    setMessage(null)
    const formData = new FormData()
    formData.set('first_name', firstName)
    formData.set('last_name', lastName)
    formData.set('phone', phone)

    startTransition(async () => {
      const result = await saveProfile(formData)
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile saved successfully.' })
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  const inputClasses =
    'w-full px-4 py-3 rounded-xl border border-[#dbc1bc]/30 bg-[#fff8f7] text-[#3d0000] focus:outline-none focus:ring-2 focus:ring-[#fadbdb]'

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Icon name="person" size="lg" className="text-[#3d0000]" />
        <div>
          <h1 className="text-2xl font-bold text-[#3d0000]">Profile</h1>
          <p className="text-sm text-[#7d6161]">Manage your personal information</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-8 border border-[#dbc1bc]/10">
        {/* Avatar section */}
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-[#dbc1bc]/10">
          <div className="w-16 h-16 rounded-full bg-[#fadbdb] flex items-center justify-center">
            <Icon name="person" size="xl" className="text-[#3d0000]" />
          </div>
          <div>
            <button
              type="button"
              className="text-sm font-medium text-[#3d0000] bg-[#fff0f0] px-4 py-2 rounded-xl hover:bg-[#fadbdb] transition-colors"
            >
              Upload Photo
            </button>
            <p className="text-xs text-[#7d6161] mt-1">JPG or PNG, max 2MB</p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-[#3d0000] mb-1.5">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClasses}
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d0000] mb-1.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClasses}
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d0000] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className={`${inputClasses} opacity-60 cursor-not-allowed`}
            />
            <p className="text-xs text-[#7d6161] mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d0000] mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClasses}
              placeholder="Enter phone number"
            />
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mt-4 p-3 rounded-xl text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Save */}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-[#3d0000] text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-all hover:bg-[#3d0000]/90 disabled:opacity-50 active:scale-95"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
