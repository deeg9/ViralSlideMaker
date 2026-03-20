import { cn } from '@/lib/utils'

interface IconProps {
  name: string
  filled?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
  xl: 'text-4xl',
}

export function Icon({ name, filled = false, size = 'md', className }: IconProps) {
  return (
    <span
      className={cn('material-symbols-outlined', sizeMap[size], className)}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  )
}
