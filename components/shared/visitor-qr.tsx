"use client"

import { QRCodeSVG } from "qrcode.react"

/**
 * Renders a scannable QR code for a visitor reference. Reception can
 * scan it on arrival to look the visitor up. The payload is the
 * reference code itself so the kiosk can search by code.
 */
export function VisitorQr({ code, size = 160 }: { code: string; size?: number }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="rounded-lg border border-border bg-white p-2">
        <QRCodeSVG value={code} size={size} level="M" includeMargin={false} />
      </div>
      <p className="text-xs text-muted-foreground">
        Show this code at reception for fast check-in.
      </p>
    </div>
  )
}
