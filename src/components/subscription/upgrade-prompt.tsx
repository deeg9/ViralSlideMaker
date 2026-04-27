'use client'

import { useRouter } from 'next/navigation'

export interface UpgradePromptProps {
  context: 'generation' | 'project_limit' | 'feature_gate'
}

const messages: Record<UpgradePromptProps['context'], { title: string; message: string }> = {
  generation: {
    title: 'Out of credits',
    message: "You've used all your AI generation credits this month. Upgrade for more.",
  },
  project_limit: {
    title: 'Project limit reached',
    message: 'Free accounts can create up to 3 projects. Upgrade for unlimited projects.',
  },
  feature_gate: {
    title: 'Premium feature',
    message: 'This feature is available on Plus and Pro plans.',
  },
}

export function UpgradePrompt({ context }: UpgradePromptProps) {
  const router = useRouter()
  const { title, message } = messages[context]

  return (
    <div className="bg-[#fadbdb] border border-[#dbc1bc] rounded-xl p-4">
      <p className="text-sm font-semibold text-[#3d0000]">{title}</p>
      <p className="text-sm text-[#7d6161] mt-1">{message}</p>
      <button
        onClick={() => router.push('/settings/subscription')}
        className="mt-3 bg-[#3d0000] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3d0000]/90 transition-colors"
      >
        View Plans
      </button>
    </div>
  )
}
