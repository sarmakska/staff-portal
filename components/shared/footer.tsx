export function Footer() {
  return (
    <footer className="flex items-center justify-center border-t border-border bg-card px-4 py-3 gap-3">
      <p className="text-xs text-muted-foreground text-center flex items-center gap-2 flex-wrap justify-center">
        <span>
          <a
            href="https://github.com/sarmakska/staff-portal"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-brand-taupe"
          >
            StaffPortal
          </a>
          {" "}· Open Source · MIT Licence
        </span>
        <span className="hidden sm:inline text-muted-foreground/40">·</span>
        <span className="hidden sm:inline">
          Built by{" "}
          <a
            href="https://sarmalinux.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-brand-taupe"
          >
            Sarma Linux
          </a>
        </span>
      </p>
    </footer>
  )
}
