export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-7 w-36 rounded-xl bg-muted/60" />
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-xl bg-muted/50" />
          <div className="h-9 w-28 rounded-xl bg-muted/50" />
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-muted/40" />)}
      </div>
      <div className="h-96 rounded-2xl bg-muted/30" />
    </div>
  )
}
