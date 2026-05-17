'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

interface FormData {
  name: string
  email: string
  message: string
}
type FormErrors = Partial<Record<keyof FormData, string>>

const fieldClass =
  'w-full rounded-2xl border bg-white/[0.02] px-5 py-3.5 text-sm text-foreground placeholder:text-foreground-subtle outline-none transition-colors duration-base focus:border-accent/60'

export function ContactForm() {
  const [data, setData] = useState<FormData>({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState<FormErrors>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const validate = () => {
    const e: FormErrors = {}
    if (!data.name.trim()) e.name = 'Required'
    if (!data.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      e.email = 'Enter a valid email'
    if (!data.message.trim()) e.message = 'Required'
    else if (data.message.trim().length < 10)
      e.message = 'A little more detail, please'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setSending(true)
    const subject = encodeURIComponent(`Portfolio message from ${data.name}`)
    const body = encodeURIComponent(
      `Name: ${data.name}\nEmail: ${data.email}\n\n${data.message}`,
    )
    window.location.href = `mailto:zakaria@zakariakortam.com?subject=${subject}&body=${body}`
    setSending(false)
    setSent(true)
    setTimeout(() => {
      setData({ name: '', email: '', message: '' })
      setSent(false)
    }, 3500)
  }

  const change = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target
    setData((d) => ({ ...d, [name]: value }))
    if (errors[name as keyof FormErrors])
      setErrors((er) => ({ ...er, [name]: undefined }))
  }

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-4 py-12 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15">
          <Check className="h-6 w-6 text-accent" />
        </div>
        <h3 className="text-title">Message ready to send.</h3>
        <p className="max-w-sm text-sm text-foreground-muted">
          Your mail client should have opened. I'll get back to you shortly.
        </p>
      </motion.div>
    )
  }

  const border = (k: keyof FormData) =>
    errors[k] ? 'border-red-400/60' : 'border-white/8 hover:border-white/15'

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            value={data.name}
            onChange={change}
            placeholder="Your name"
            className={`${fieldClass} ${border('name')}`}
          />
          {errors.name && (
            <p className="text-xs text-red-400">{errors.name}</p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={data.email}
            onChange={change}
            placeholder="you@example.com"
            className={`${fieldClass} ${border('email')}`}
          />
          {errors.email && (
            <p className="text-xs text-red-400">{errors.email}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          value={data.message}
          onChange={change}
          placeholder="What are you working on?"
          className={`${fieldClass} resize-none ${border('message')}`}
        />
        {errors.message && (
          <p className="text-xs text-red-400">{errors.message}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={sending}
        className="focus-ring w-full rounded-full bg-foreground py-4 text-sm font-semibold text-background transition-transform duration-base hover:scale-[1.02] disabled:opacity-50"
      >
        {sending ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  )
}
