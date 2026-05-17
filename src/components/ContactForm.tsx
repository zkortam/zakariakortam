'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

interface FormData {
  name: string
  email: string
  message: string
}
type FormErrors = Partial<Record<keyof FormData, string>>

const field =
  'w-full rounded-2xl border bg-white/[0.03] px-4 py-3 text-sm outline-none transition-colors duration-200 placeholder:text-foreground-subtle focus:border-accent/60'

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
    else if (data.message.trim().length < 10) e.message = 'A little more detail'
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
      <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-sm">
        <Check className="h-5 w-5 shrink-0" />
        <span className="text-foreground-muted">
          Your mail client should have opened. I will get back to you shortly.
        </span>
      </div>
    )
  }

  const border = (k: keyof FormData) =>
    errors[k] ? 'border-red-400/50' : 'border-white/10'

  return (
    <form onSubmit={submit} className="max-w-xl space-y-5">
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
            className={`${field} ${border('name')}`}
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
            className={`${field} ${border('email')}`}
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
          rows={6}
          value={data.message}
          onChange={change}
          placeholder="What are you working on?"
          className={`${field} resize-none ${border('message')}`}
        />
        {errors.message && (
          <p className="text-xs text-red-400">{errors.message}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={sending}
        className="btn-primary focus-ring disabled:opacity-50"
      >
        {sending ? 'Sending' : 'Send Message'}
      </button>
    </form>
  )
}
