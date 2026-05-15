'use client'

import * as React from 'react'

interface LetterCircleLoaderProps {
  size?: number
  text?: string
}

export const LetterCircleLoader: React.FC<LetterCircleLoaderProps> = ({
  size = 180,
  text = 'Generating',
}) => {
  const letters = text.split('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-[#fff8f7] via-[#fff0f0] to-[#fadbdb]">
      <div
        className="relative flex items-center justify-center font-inter select-none"
        style={{ width: size, height: size }}
      >
        {letters.map((letter, index) => (
          <span
            key={index}
            className="inline-block text-[#3d0000] opacity-40 animate-loaderLetter"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {letter}
          </span>
        ))}
        <div className="absolute inset-0 rounded-full animate-loaderCircle" />
      </div>
    </div>
  )
}

export default LetterCircleLoader
