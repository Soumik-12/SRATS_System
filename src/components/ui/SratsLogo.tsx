import React from 'react';

interface SratsLogoProps {
  className?: string;
  size?: number;
}

export function SratsLogo({ className = 'w-9 h-9', size = 36 }: SratsLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sratsTopGrad" x1="4" y1="2" x2="32" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818CF8" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id="sratsMidGrad" x1="4" y1="10" x2="32" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id="sratsBotGrad" x1="4" y1="18" x2="32" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4338CA" />
          <stop offset="1" stopColor="#1E1B4B" />
        </linearGradient>
      </defs>

      {/* Bottom Layer */}
      <path
        d="M4 23L18 30.5L32 23L18 15.5L4 23Z"
        fill="url(#sratsBotGrad)"
        opacity="0.9"
      />
      <path
        d="M4 23L18 30.5V33.5L4 26V23Z"
        fill="#312E81"
      />
      <path
        d="M18 30.5L32 23V26L18 33.5V30.5Z"
        fill="#1E1B4B"
      />

      {/* Middle Layer */}
      <path
        d="M4 15.5L18 23L32 15.5L18 8L4 15.5Z"
        fill="url(#sratsMidGrad)"
        opacity="0.95"
      />
      <path
        d="M4 15.5L18 23V26L4 18.5V15.5Z"
        fill="#4338CA"
      />
      <path
        d="M18 23L32 15.5V18.5L18 26V23Z"
        fill="#312E81"
      />

      {/* Top Layer */}
      <path
        d="M4 8L18 15.5L32 8L18 0.5L4 8Z"
        fill="url(#sratsTopGrad)"
      />
      <path
        d="M4 8L18 15.5V18.5L4 11V8Z"
        fill="#4F46E5"
      />
      <path
        d="M18 15.5L32 8V11L18 18.5V15.5Z"
        fill="#3730A3"
      />
    </svg>
  );
}
