"use client"

import { useState, useCallback } from "react"
import { Delete } from "lucide-react"

interface PinKeypadProps {
  onComplete: (pin: string) => void
  length?: number
}

export function PinKeypad({ onComplete, length = 4 }: PinKeypadProps) {
  const [pin, setPin] = useState("")

  const handlePress = useCallback(
    (digit: string) => {
      if (pin.length < length) {
        const newPin = pin + digit
        setPin(newPin)
        if (newPin.length === length) {
          onComplete(newPin)
          setTimeout(() => setPin(""), 1500)
        }
      }
    },
    [pin, length, onComplete]
  )

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
  }, [])

  const handleClear = useCallback(() => {
    setPin("")
  }, [])

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex gap-4">
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl font-bold transition-all ${
              i < pin.length
                ? "border-brand-taupe bg-brand-taupe/10 text-brand-taupe"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {i < pin.length ? "\u2022" : ""}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            onClick={() => handlePress(digit)}
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-border text-2xl font-semibold text-foreground transition-all hover:bg-muted active:scale-95 active:bg-muted"
          >
            {digit}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-border text-sm font-medium text-muted-foreground transition-all hover:bg-muted active:scale-95"
        >
          Clear
        </button>
        <button
          onClick={() => handlePress("0")}
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-border text-2xl font-semibold text-foreground transition-all hover:bg-muted active:scale-95"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-border text-muted-foreground transition-all hover:bg-muted active:scale-95"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
