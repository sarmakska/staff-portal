export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-xl bg-muted/60" />
        <div className="h-9 w-48 rounded-xl bg-muted/50" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-muted/30 overflow-hidden">
            <div className="h-20 bg-muted/50" />
            <div className="p-4 space-y-3">
              <div className="h-5 w-28 rounded-lg bg-muted/50 mx-auto" />
              <div className="h-4 w-20 rounded-lg bg-muted/40 mx-auto" />
              <div className="h-px bg-muted/50" />
              <div className="h-4 w-36 rounded-lg bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
