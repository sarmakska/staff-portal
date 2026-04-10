export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-7 w-44 rounded-xl bg-muted/60" />
        <div className="h-4 w-64 rounded-lg bg-muted/40" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/40" />)}
      </div>
      <div className="h-48 rounded-2xl bg-muted/30" />
      <div className="h-64 rounded-2xl bg-muted/30" />
    </div>
  )
}
