'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

const headlines = [
  'AI Engineer and Product Engineer in San Jose.',
  'Engineering elegant intelligence.',
  'From models to products, end to end.',
  'Products where AI feels invisible.',
  'Systems thinking, product taste, shipped impact.',
]

export function Hero() {
  const [currentHeadline, setCurrentHeadline] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeadline((prev) => (prev + 1) % headlines.length)
    }, 6000)

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 noise opacity-[0.015]" />
      <div className="absolute inset-0 gradient-subtle opacity-30" />

      {/* Animated Twinkling Stars */}
      <div className="absolute inset-0 opacity-70 pointer-events-none">
        {Array.from({ length: 150 }).map((_, i) => {
          const x = (i * 17.3 + 13) % 100;
          const y = (i * 23.7 + 7) % 100;
          const duration = 2 + (i % 4);
          const delay = (i % 8) * 0.3;
          const size = i % 4 === 0 ? 2 : 1;

          return (
            <div
              key={i}
              className="absolute animate-pulse"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: 'white',
                borderRadius: '50%',
                animation: `pulse ${duration}s ease-in-out ${delay}s infinite`,
                opacity: 0.6,
              }}
            />
          );
        })}
      </div>

      {/* Floating Gradient Orbs - Space Nebula Effect */}
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-gradient-to-r from-blue-500/40 to-purple-500/40 blur-3xl"
          animate={{
            x: [0, 120, 0],
            y: [0, -60, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ left: '5%', top: '15%' }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full bg-gradient-to-r from-cyan-500/30 to-blue-500/30 blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 70, 0],
            scale: [1, 1.4, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ right: '5%', top: '25%' }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-purple-500/25 to-pink-500/25 blur-3xl"
          animate={{
            x: [0, 80, 0],
            y: [0, -80, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ left: '40%', bottom: '10%' }}
        />
      </div>

      {/* Distant Stars - Smaller Static Stars for Depth */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => {
          const x = (i * 31.7 + 19) % 100;
          const y = (i * 47.3 + 23) % 100;

          return (
            <div
              key={`distant-${i}`}
              className="absolute rounded-full bg-white"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: '0.5px',
                height: '0.5px',
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="space-y-6"
        >
          {/* Main Name */}
          <motion.h1
            className="text-display font-semibold tracking-tight"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Zakaria Kortam
          </motion.h1>

          {/* Rotating Headlines */}
          <div className="h-12 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentHeadline}
                initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                className="text-lg md:text-xl text-foreground-muted max-w-2xl text-balance"
              >
                {headlines[currentHeadline]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8"
          >
            <Link
              href="/portfolio"
              className="group px-8 py-4 bg-foreground text-background rounded-full font-medium transition-all duration-normal hover:bg-foreground/90 hover:scale-[1.02] focus-ring"
            >
              <span className="flex items-center gap-2">
                View My Work
                <motion.svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  whileHover={{ x: 2 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </motion.svg>
              </span>
            </Link>

            <Link
              href="/contact"
              className="group px-8 py-4 glass-elevated rounded-full font-medium transition-all duration-normal hover:scale-[1.02] focus-ring"
            >
              Let's Connect
            </Link>
          </motion.div>


        </motion.div>
      </div>
    </section>
  )
}
