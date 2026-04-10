export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 rounded-xl bg-muted/60" />
        <div className="h-9 w-28 rounded-xl bg-muted/50" />
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted/30" />)}
      </div>
    </div>
  )
}
