"use client"

import { QRCodeSVG } from "qrcode.react"

interface QrPlaceholderProps {
  value: string
  size?: number
}

export function QrPlaceholder({ value, size = 160 }: QrPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white p-3" style={{ width: size + 24, height: size + 24 }}>
      <QRCodeSVG value={value || " "} size={size} />
    </div>
  )
}
