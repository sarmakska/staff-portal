import { Footer } from "@/components/shared/footer"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>
      <Footer />
    </div>
  )
}
