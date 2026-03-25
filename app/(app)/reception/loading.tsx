export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="h-7 w-36 rounded-xl bg-muted/60" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/40" />)}
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted/30" />)}
      </div>
    </div>
  )
}
