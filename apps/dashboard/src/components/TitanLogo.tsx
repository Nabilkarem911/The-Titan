import React from 'react';

interface TitanLogoProps {
  size?: number;
  className?: string;
}

export default function TitanLogo({ size = 40, className = '' }: TitanLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="titan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F2FE" />
          <stop offset="100%" stopColor="#7000FF" />
        </linearGradient>
        <filter id="titan-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Hexagonal shell */}
      <path
        d="M24 2L43.5 13.25V35.75L24 47L4.5 35.75V13.25L24 2Z"
        stroke="url(#titan-grad)"
        strokeWidth="1.5"
        fill="none"
        filter="url(#titan-glow)"
      />
      <path
        d="M24 6L40 15.25V33.75L24 43L8 33.75V15.25L24 6Z"
        stroke="url(#titan-grad)"
        strokeWidth="0.5"
        fill="rgba(0, 242, 254, 0.03)"
      />
      {/* T letterform */}
      <rect x="13" y="14" width="22" height="3.5" rx="1" fill="url(#titan-grad)" />
      <rect x="22" y="14" width="4" height="22" rx="1" fill="url(#titan-grad)" />
      {/* Corner accents */}
      <circle cx="24" cy="2" r="1.5" fill="#00F2FE" opacity="0.6" />
      <circle cx="43.5" cy="13.25" r="1" fill="#7000FF" opacity="0.4" />
      <circle cx="43.5" cy="35.75" r="1" fill="#7000FF" opacity="0.4" />
      <circle cx="24" cy="47" r="1.5" fill="#00F2FE" opacity="0.6" />
      <circle cx="4.5" cy="35.75" r="1" fill="#7000FF" opacity="0.4" />
      <circle cx="4.5" cy="13.25" r="1" fill="#7000FF" opacity="0.4" />
    </svg>
  );
}
