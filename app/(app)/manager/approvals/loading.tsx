export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="h-7 w-28 rounded-xl bg-muted/60" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/30" />)}
      </div>
    </div>
  )
}
