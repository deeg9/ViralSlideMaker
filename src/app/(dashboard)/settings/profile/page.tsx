'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Icon } from '@/components/ui/icon'
import { getProfile, saveProfile, uploadAvatar } from './actions'

type SocialLinks = {
  tiktok: string
  instagram: string
  x: string
  youtube: string
}

export default function ProfilePage() {
  const [username, setUsername] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    tiktok: '',
    instagram: '',
    x: '',
    youtube: '',
  })

  const [isPending, startTransition] = useTransition()
  const [isUploading, startUpload] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getProfile().then((profile) => {
      if (profile) {
        setUsername(profile.username)
        setDisplayName(profile.displayName)
        setBio(profile.bio)
        setEmail(profile.email)
        setPhone(profile.phone)
        setWebsiteUrl(profile.websiteUrl)
        setAvatarUrl(profile.avatarUrl)
        setSocialLinks({
          tiktok: profile.socialLinks.tiktok ?? '',
          instagram: profile.socialLinks.instagram ?? '',
          x: profile.socialLinks.x ?? '',
          youtube: profile.socialLinks.youtube ?? '',
        })
      }
    })
  }, [])

  function handleSave() {
    setMessage(null)
    const formData = new FormData()
    formData.set('display_name', displayName)
    formData.set('bio', bio)
    formData.set('phone', phone)
    formData.set('website_url', websiteUrl)
    formData.set('social_tiktok', socialLinks.tiktok)
    formData.set('social_instagram', socialLinks.instagram)
    formData.set('social_x', socialLinks.x)
    formData.set('social_youtube', socialLinks.youtube)

    startTransition(async () => {
      const result = await saveProfile(formData)
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile saved successfully.' })
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMessage(null)

    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']
    const MAX_BYTES = 2 * 1024 * 1024
    if (!ALLOWED.includes(file.type)) {
      setMessage({ type: 'error', text: 'Avatar must be a JPG, PNG, or WebP image.' })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > MAX_BYTES) {
      setMessage({
        type: 'error',
        text: `Avatar must be 2MB or smaller (this one is ${(file.size / 1024 / 1024).toFixed(1)}MB).`,
      })
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const formData = new FormData()
    formData.set('avatar', file)
    startUpload(async () => {
      try {
        const result = await uploadAvatar(formData)
        if (result.success) {
          setAvatarUrl(result.url)
          setMessage({ type: 'success', text: 'Avatar updated.' })
        } else {
          setMessage({ type: 'error', text: result.error })
        }
      } catch (err) {
        setMessage({
          type: 'error',
          text: err instanceof Error ? `Upload failed: ${err.message}` : 'Upload failed.',
        })
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
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
          <p className="text-sm text-[#7d6161]">Manage your public profile and links</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-8 border border-[#dbc1bc]/10">
        {/* Avatar section */}
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-[#dbc1bc]/10">
          <div className="w-16 h-16 rounded-full bg-[#fadbdb] flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="Profile"
                width={64}
                height={64}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <Icon name="person" size="xl" className="text-[#3d0000]" />
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-sm font-medium text-[#3d0000] bg-[#fff0f0] px-4 py-2 rounded-xl hover:bg-[#fadbdb] transition-colors disabled:opacity-50"
            >
              {isUploading ? 'Uploading…' : 'Upload Photo'}
            </button>
            <p className="text-xs text-[#7d6161] mt-1">JPG, PNG, or WebP, max 2MB</p>
          </div>
        </div>

        {/* Username (read-only) */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-[#3d0000] mb-1.5">Username</label>
          <div className="flex items-center gap-3">
            <div className={`${inputClasses} flex items-center justify-between opacity-80`}>
              <span>{username ? `@${username}` : 'Not set'}</span>
              <Link
                href="/onboarding/username?change=1&next=/settings/profile"
                className="text-xs font-semibold text-[#3d0000] underline"
              >
                Change
              </Link>
            </div>
          </div>
          <p className="text-xs text-[#7d6161] mt-1">
            Your profile URL: <span className="font-semibold text-[#3d0000]">viralslidemaker.com/{username ?? '…'}</span>
          </p>
        </div>

        {/* Display name */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[#3d0000] mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClasses}
              placeholder="How your name appears on your profile"
              maxLength={80}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d0000] mb-1.5">
              Bio <span className="text-xs text-[#7d6161]">({bio.length}/280)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              rows={3}
              className={inputClasses}
              placeholder="Tell people what you create"
            />
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

          <div>
            <label className="block text-sm font-medium text-[#3d0000] mb-1.5">Website</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className={inputClasses}
              placeholder="https://your-site.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d0000] mb-1.5">Social Links</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SocialInput
                label="TikTok"
                value={socialLinks.tiktok}
                onChange={(v) => setSocialLinks({ ...socialLinks, tiktok: v })}
                inputClasses={inputClasses}
              />
              <SocialInput
                label="Instagram"
                value={socialLinks.instagram}
                onChange={(v) => setSocialLinks({ ...socialLinks, instagram: v })}
                inputClasses={inputClasses}
              />
              <SocialInput
                label="X"
                value={socialLinks.x}
                onChange={(v) => setSocialLinks({ ...socialLinks, x: v })}
                inputClasses={inputClasses}
              />
              <SocialInput
                label="YouTube"
                value={socialLinks.youtube}
                onChange={(v) => setSocialLinks({ ...socialLinks, youtube: v })}
                inputClasses={inputClasses}
              />
            </div>
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
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SocialInput({
  label,
  value,
  onChange,
  inputClasses,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  inputClasses: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#7d6161] mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#7d6161]">@</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClasses} pl-7`}
          placeholder="handle"
          maxLength={64}
        />
      </div>
    </div>
  )
}
