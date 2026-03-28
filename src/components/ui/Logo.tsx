interface LogoProps {
  className?: string
}

export function Logo({ className = 'h-6 w-6' }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E2A78" />
          <stop offset="100%" stopColor="#39D98A" />
        </linearGradient>
        <radialGradient id="logo-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#1E2A78" />
        </radialGradient>
      </defs>

      {/* 6 branches */}
      <g stroke="url(#logo-gradient)" strokeWidth="12" strokeLinecap="round" fill="none">
        <path d="M280 230 Q350 160 400 100 Q420 80 450 60" />
        <path d="M295 256 Q380 256 460 256 Q480 256 500 250" />
        <path d="M280 282 Q350 360 400 420 Q420 450 440 480" />
        <path d="M232 282 Q160 360 110 420 Q90 450 70 480" />
        <path d="M217 256 Q130 256 50 256 Q30 256 10 250" />
        <path d="M232 230 Q160 160 110 100 Q90 80 60 60" />
      </g>

      {/* Endpoint nodes */}
      <g fill="#39D98A">
        <circle cx="450" cy="60" r="18" />
        <circle cx="500" cy="250" r="15" />
        <circle cx="440" cy="480" r="18" />
        <circle cx="70" cy="480" r="18" />
        <circle cx="10" cy="250" r="15" />
        <circle cx="60" cy="60" r="18" />
      </g>
      <g fill="#6366F1">
        <circle cx="400" cy="130" r="12" />
        <circle cx="470" cy="280" r="10" />
        <circle cx="390" cy="400" r="12" />
        <circle cx="120" cy="400" r="12" />
        <circle cx="40" cy="280" r="10" />
        <circle cx="110" cy="130" r="12" />
      </g>

      {/* Center node */}
      <circle cx="256" cy="256" r="50" fill="url(#logo-core)" />

      {/* Highlights */}
      <circle cx="240" cy="240" r="18" fill="rgba(255,255,255,0.2)" />
      <circle cx="235" cy="235" r="8" fill="rgba(255,255,255,0.3)" />
    </svg>
  )
}
