'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface FormData {
  name: string
  email: string
  message: string
}

interface FormErrors {
  name?: string
  email?: string
  message?: string
}

export function ContactForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    message: ''
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required'
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message should be at least 10 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)

    // Create mailto link with form data
    const subject = encodeURIComponent(`Portfolio Contact from ${formData.name}`)
    const body = encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`)
    const mailtoLink = `mailto:zakaria@zakariakortam.com?subject=${subject}&body=${body}`

    // Open mail client
    window.location.href = mailtoLink

    setIsSubmitting(false)
    setIsSubmitted(true)

    // Reset form after success
    setTimeout(() => {
      setFormData({ name: '', email: '', message: '' })
      setIsSubmitted(false)
    }, 3000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-elevated rounded-card-lg p-8 text-center space-y-4"
      >
        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-title">Message Sent Successfully!</h3>
        <p className="text-body text-foreground-muted">
          Thank you for reaching out. I'll get back to you within 24-48 hours.
        </p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name Field */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-4 py-3 bg-surface border rounded-card transition-colors duration-normal focus-ring ${
            errors.name ? 'border-red-500' : 'border-border-subtle hover:border-border'
          }`}
          placeholder="Your name"
        />
        {errors.name && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500"
          >
            {errors.name}
          </motion.p>
        )}
      </div>

      {/* Email Field */}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-4 py-3 bg-surface border rounded-card transition-colors duration-normal focus-ring ${
            errors.email ? 'border-red-500' : 'border-border-subtle hover:border-border'
          }`}
          placeholder="your.email@example.com"
        />
        {errors.email && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500"
          >
            {errors.email}
          </motion.p>
        )}
      </div>

      {/* Message Field */}
      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          rows={5}
          className={`w-full px-4 py-3 bg-surface border rounded-card transition-colors duration-normal focus-ring resize-none ${
            errors.message ? 'border-red-500' : 'border-border-subtle hover:border-border'
          }`}
          placeholder="Tell me about your project or idea..."
        />
        {errors.message && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-red-500"
          >
            {errors.message}
          </motion.p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-foreground text-background rounded-card font-medium transition-all duration-normal hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
            Sending...
          </span>
        ) : (
          'Send Message'
        )}
      </button>
    </form>
  )
}
