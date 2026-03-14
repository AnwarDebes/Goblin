export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] gap-6 animate-fade-in">
      {/* Goblin loader */}
      <div className="relative">
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full animate-pulse-green" />

        {/* Spinning coin */}
        <div className="perspective-container">
          <div className="coin-3d" style={{ width: 80, height: 80 }}>
            <svg
              width={80}
              height={80}
              viewBox="0 0 256 256"
              xmlns="http://www.w3.org/2000/svg"
              className="coin-face rounded-full"
            >
              <defs>
                <linearGradient id="loaderBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#2d5a27" }} />
                  <stop offset="100%" style={{ stopColor: "#1a3d15" }} />
                </linearGradient>
                <linearGradient id="loaderSkin" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#7cb342" }} />
                  <stop offset="100%" style={{ stopColor: "#558b2f" }} />
                </linearGradient>
                <linearGradient id="loaderEar" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#8bc34a" }} />
                  <stop offset="100%" style={{ stopColor: "#689f38" }} />
                </linearGradient>
                <linearGradient id="loaderRim" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#fbbf24" }} />
                  <stop offset="50%" style={{ stopColor: "#f59e0b" }} />
                  <stop offset="100%" style={{ stopColor: "#d97706" }} />
                </linearGradient>
              </defs>
              <circle cx="128" cy="128" r="124" fill="url(#loaderRim)" />
              <circle cx="128" cy="128" r="118" fill="url(#loaderBg)" />
              {/* Ears */}
              <ellipse cx="45" cy="100" rx="28" ry="42" fill="url(#loaderEar)" transform="rotate(-30 45 100)" />
              <ellipse cx="211" cy="100" rx="28" ry="42" fill="url(#loaderEar)" transform="rotate(30 211 100)" />
              {/* Head */}
              <ellipse cx="128" cy="138" rx="73" ry="68" fill="url(#loaderSkin)" />
              {/* Eyes */}
              <ellipse cx="100" cy="130" rx="20" ry="24" fill="#fff" />
              <ellipse cx="103" cy="132" rx="11" ry="13" fill="#2d2d2d" />
              <circle cx="108" cy="126" r="4.5" fill="#fff" />
              <ellipse cx="156" cy="130" rx="20" ry="24" fill="#fff" />
              <ellipse cx="159" cy="132" rx="11" ry="13" fill="#2d2d2d" />
              <circle cx="164" cy="126" r="4.5" fill="#fff" />
              {/* Nose */}
              <ellipse cx="128" cy="155" rx="11" ry="7" fill="#558b2f" />
              <circle cx="122" cy="154" r="2.5" fill="#2d2d2d" />
              <circle cx="134" cy="154" r="2.5" fill="#2d2d2d" />
              {/* Mouth - smile */}
              <path d="M97 175 Q128 205 159 175" stroke="#2d2d2d" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              {/* Horns */}
              <circle cx="100" cy="77" r="11" fill="url(#loaderSkin)" />
              <circle cx="156" cy="77" r="11" fill="url(#loaderSkin)" />
            </svg>
          </div>
        </div>
      </div>

      {/* Loading text */}
      <div className="text-center space-y-2">
        <p className="text-sm font-semibold text-goblin-400">Loading...</p>
        <div className="flex items-center gap-1 justify-center">
          <span className="h-1.5 w-1.5 rounded-full bg-goblin-500 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-goblin-500 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-goblin-500 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
