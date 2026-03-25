export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-xl bg-muted/60" />
        <div className="flex gap-2">
          <div className="h-9 w-9 rounded-xl bg-muted/50" />
          <div className="h-9 w-28 rounded-xl bg-muted/50" />
          <div className="h-9 w-9 rounded-xl bg-muted/50" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-muted/40" />)}
        {[...Array(35)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted/25" />)}
      </div>
    </div>
  )
}
