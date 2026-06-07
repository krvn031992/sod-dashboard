// SOD logo — white variant, always on a dark (plum) surface per brand guidelines.

export function LogoMark({ size = 36, className = '' }) {
  return (
    <img
      src="./logo-icon.png"
      width={size}
      height={size}
      alt="State of Dance"
      className={className}
      style={{ width: size, height: size }}
    />
  )
}

export function LogoLockup({ size = 34 }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className="font-display text-[0.95rem] font-semibold tracking-[0.04em] text-ink">
          STATE OF DANCE
        </div>
        <div className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-gold">
          Operating Dashboard
        </div>
      </div>
    </div>
  )
}
