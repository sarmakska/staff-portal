import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldX, ArrowLeft } from "lucide-react"

export default function UnauthorizedPage() {
  return (
    <Card className="w-full max-w-md rounded-2xl border-border shadow-lg">
      <CardHeader className="items-center space-y-4 pb-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <Button variant="outline" className="w-full rounded-xl h-11 gap-2" asChild>
          <Link href="/"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
