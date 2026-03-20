"use client"

import { motion } from "motion/react"
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

  // Find the longest word to use as an invisible spacer for container width
  const longestWord = useMemo(
    () => words.reduce((a, b) => (a.length >= b.length ? a : b)),
    [words]
  )

  return (
    <span className="relative inline-flex overflow-hidden italic">
      <span className="invisible">{longestWord}.</span>
      {words.map((word, index) => (
        <motion.span
          key={index}
          className="absolute inset-0"
          initial={{ opacity: 0, y: "-100%" }}
          transition={{ type: "spring", stiffness: 50 }}
          animate={
            titleNumber === index
              ? { y: 0, opacity: 1 }
              : { y: titleNumber > index ? "-150%" : "150%", opacity: 0 }
          }
        >
          {word}.
        </motion.span>
      ))}
    </span>
  )
}
