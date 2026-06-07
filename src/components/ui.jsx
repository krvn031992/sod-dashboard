// Small, on-brand UI primitives. Clean and confident — no glow.

export function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ' +
    'disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap'
  const sizes = {
    sm: 'px-3.5 py-2 text-sm',
    md: 'px-4 py-2.5 text-[0.95rem]',
    lg: 'px-5 py-3 text-base',
    block: 'w-full px-5 py-3.5 text-base',
  }
  const variants = {
    primary:
      'bg-gradient-to-br from-gold-400 to-gold-600 text-plum-950 hover:brightness-105 active:brightness-95',
    ghost:
      'border border-gold/35 text-gold hover:border-gold hover:bg-gold/10',
    subtle:
      'bg-white/5 text-ink-soft hover:bg-white/10 border border-white/10',
    danger:
      'border border-bad/40 text-bad hover:bg-bad/10',
  }
  return (
    <Tag className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
  )
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`panel p-5 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ eyebrow, title, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h3 className="text-lg text-ink">{title}</h3>
      </div>
      {action}
    </div>
  )
}

export function Field({ label, hint, children, htmlFor }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl border border-white/10 bg-plum-950/50 px-3.5 py-2.5 text-ink ' +
  'placeholder:text-ink-mute focus:border-gold/60 focus:outline-none transition'

export function Input({ className = '', ...props }) {
  return <input className={`${inputBase} ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${inputBase} appearance-none ${className}`} {...props}>
      {children}
    </select>
  )
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-white/8 text-ink-soft border-white/10',
    gold: 'bg-gold/12 text-gold border-gold/25',
    ok: 'bg-ok/12 text-ok border-ok/25',
    warn: 'bg-warn/12 text-warn border-warn/25',
    bad: 'bg-bad/12 text-bad border-bad/25',
    violet: 'bg-violet/15 text-[#b9aaff] border-violet/30',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

// Initials avatar with optional photo.
export function Avatar({ name = '', src, size = 40 }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  const style = { width: size, height: size }
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className="rounded-full object-cover ring-1 ring-gold/30"
      />
    )
  }
  return (
    <span
      style={{ ...style, fontSize: size * 0.36 }}
      className="grid place-items-center rounded-full bg-gradient-to-br from-plum-600 to-magenta font-display font-semibold text-cream ring-1 ring-gold/30"
    >
      {initials || '·'}
    </span>
  )
}

// Compact metric tile for the scoreboard / overview.
export function StatTile({ label, value, sub, tone }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-plum-950/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl font-semibold ${tone ?? 'text-ink'}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </div>
  )
}

// Thin progress bar (goals / re-enrollment).
export function Progress({ value, max = 100 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-400"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
