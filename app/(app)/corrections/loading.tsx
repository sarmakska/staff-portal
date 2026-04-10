export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-40 rounded-xl bg-muted/60" />
          <div className="h-4 w-60 rounded-lg bg-muted/40" />
        </div>
        <div className="h-9 w-32 rounded-xl bg-muted/50" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted/30" />)}
      </div>
    </div>
  )
}
