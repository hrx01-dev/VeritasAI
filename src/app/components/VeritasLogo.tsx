type VeritasLogoProps = {
  compact?: boolean;
  className?: string;
};

export default function VeritasLogo({ compact = false, className = "" }: VeritasLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <svg
        width="42"
        height="42"
        viewBox="0 0 42 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="VeritasAI logo mark"
        role="img"
      >
        <defs>
          <linearGradient id="v-shield" x1="6" y1="5" x2="35" y2="37" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0EA5E9" />
            <stop offset="1" stopColor="#14B8A6" />
          </linearGradient>
          <linearGradient id="v-accent" x1="16" y1="17" x2="29" y2="29" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F8FAFC" />
            <stop offset="1" stopColor="#BAE6FD" />
          </linearGradient>
        </defs>

        <path
          d="M21 3.5L34 8.8V19.2C34 27.8 28.9 34 21 37.8C13.1 34 8 27.8 8 19.2V8.8L21 3.5Z"
          fill="url(#v-shield)"
        />
        <path
          d="M20.4 13.2L15.7 20.5C15 21.6 15.8 23 17.1 23H19.7L18 28.7C17.7 29.8 19 30.7 19.9 30L27 21.8C27.9 20.7 27.1 19 25.6 19H23.4L24.6 14.3C24.9 13.1 23.5 12.2 22.6 13L20.4 13.2Z"
          fill="url(#v-accent)"
        />
        <circle cx="31.5" cy="30.5" r="2.2" fill="#99F6E4" />
        <path d="M29.5 28.7L26.8 26" stroke="#99F6E4" strokeWidth="1.7" strokeLinecap="round" />
      </svg>

      {!compact && (
        <div className="leading-tight">
          <p className="text-lg font-semibold tracking-wide bg-gradient-to-r from-cyan-300 via-sky-200 to-teal-200 bg-clip-text text-transparent">
            VeritasAI
          </p>
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
            Trust Intelligence
          </p>
        </div>
      )}
    </div>
  );
}
