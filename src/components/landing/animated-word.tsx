"use client"

import { motion, AnimatePresence } from "motion/react"
import { useState, useEffect, useMemo } from "react"

export function AnimatedWord() {
  const words = useMemo(
    () => ["automated", "effortless", "intelligent", "instant", "seamless"],
    []
  )
  const [titleNumber, setTitleNumber] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTitleNumber((prev) => (prev + 1) % words.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [words.length])

  return (
    <span className="relative inline-flex overflow-hidden">
      &nbsp;
      <AnimatePresence mode="wait">
        <motion.span
          key={titleNumber}
          className="italic absolute inset-0"
          initial={{ opacity: 0, y: -150 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 150 }}
          transition={{ type: "spring", stiffness: 50 }}
        >
          {words[titleNumber]}.
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
