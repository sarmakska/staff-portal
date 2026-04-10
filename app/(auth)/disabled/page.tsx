import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Ban, Mail } from "lucide-react"

export default function DisabledPage() {
  return (
    <Card className="w-full max-w-md rounded-2xl border-border shadow-lg">
      <CardHeader className="items-center space-y-4 pb-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Ban className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">Account disabled</h1>
          <p className="text-sm text-muted-foreground">
            Your account has been disabled by an administrator. If you believe this is a mistake, please reach out to your IT department or HR team.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        <Button variant="outline" className="w-full rounded-xl h-11 gap-2">
          <Mail className="h-4 w-4" />Contact Support
        </Button>
        <div className="text-center">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Try a different account</Link>
        </div>
      </CardContent>
    </Card>
  )
}
