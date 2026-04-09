export function Footer() {
  return (
    <footer className="flex items-center justify-center border-t border-border bg-card px-4 py-3 gap-3">
      <p className="text-xs text-muted-foreground text-center">
        Designed and Developed by{" "}
        <a
          href="https://sarmalinux.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-brand-taupe"
        >
          Sarma Linux
        </a>
      </p>
    </footer>
  )
}
