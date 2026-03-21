"use client"

import React from "react"
import { motion } from "motion/react"

export interface Testimonial {
  text: string
  image: string
  name: string
  role: string
}

export function TestimonialsColumn({
  className,
  testimonials,
  duration = 10,
}: {
  className?: string
  testimonials: Testimonial[]
  duration?: number
}) {
  return (
    <div className={className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[...new Array(2)].map((_, index) => (
          <React.Fragment key={index}>
            {testimonials.map(({ text, image, name, role }, i) => (
              <div
                className="p-8 rounded-2xl border border-[#dbc1bc]/10 bg-[#fff0f0] shadow-sm max-w-sm w-full"
                key={i}
              >
                <p className="text-[#55423f] italic leading-relaxed text-sm">
                  &ldquo;{text}&rdquo;
                </p>
                <div className="flex items-center gap-3 mt-5">
                  <img
                    width={40}
                    height={40}
                    src={image}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover bg-[#fadbdb]"
                  />
                  <div className="flex flex-col">
                    <div className="font-semibold text-sm text-[#3d0000] tracking-tight leading-5">
                      {name}
                    </div>
                    <div className="text-xs text-[#7d6161] leading-5 tracking-tight">
                      {role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  )
}
