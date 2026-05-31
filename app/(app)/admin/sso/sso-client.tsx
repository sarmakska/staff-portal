"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { KeyRound, Trash2, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { upsertSsoConnection, deleteSsoConnection } from "@/lib/actions/sso"
import type { SsoConnection, SsoProvider } from "@/lib/sso"

const PROVIDERS: { value: SsoProvider; label: string }[] = [
    { value: "azure", label: "Microsoft Entra ID (Azure)" },
    { value: "google", label: "Google Workspace" },
    { value: "github", label: "GitHub" },
    { value: "gitlab", label: "GitLab" },
    { value: "saml", label: "SAML 2.0" },
]

export default function SsoClient({ initialConnections }: { initialConnections: SsoConnection[] }) {
    const [connections, setConnections] = useState<SsoConnection[]>(initialConnections)
    const [domain, setDomain] = useState("")
    const [provider, setProvider] = useState<SsoProvider>("azure")
    const [displayName, setDisplayName] = useState("")
    const [isActive, setIsActive] = useState(true)
    const [isPending, startTransition] = useTransition()

    const refresh = (next: SsoConnection) => {
        setConnections(prev => {
            const others = prev.filter(c => c.domain !== next.domain)
            return [...others, next].sort((a, b) => a.domain.localeCompare(b.domain))
        })
    }

    const handleAdd = () => {
        startTransition(async () => {
            const res = await upsertSsoConnection({ domain, provider, displayName, isActive })
            if (res.error) { toast.error(res.error); return }
            refresh({ domain: domain.trim().toLowerCase(), provider, displayName: displayName || domain, isActive })
            setDomain(""); setDisplayName(""); setProvider("azure"); setIsActive(true)
            toast.success("SSO connection saved")
        })
    }

    const handleDelete = (d: string) => {
        startTransition(async () => {
            const res = await deleteSsoConnection(d)
            if (res.error) { toast.error(res.error); return }
            setConnections(prev => prev.filter(c => c.domain !== d))
            toast.success("SSO connection removed")
        })
    }

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Single Sign-On</h1>
                    <p className="text-sm text-muted-foreground">Route staff to your identity provider by email domain.</p>
                </div>
            </div>

            {/* Add form */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Add or update a connection</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="domain">Email domain</Label>
                        <Input id="domain" placeholder="acme.com" value={domain} onChange={e => setDomain(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="provider">Provider</Label>
                        <select
                            id="provider"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            value={provider}
                            onChange={e => setProvider(e.target.value as SsoProvider)}
                        >
                            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="displayName">Display name</Label>
                        <Input id="displayName" placeholder="Acme Corp" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-3 sm:col-span-2">
                        <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
                        <Label htmlFor="active" className="cursor-pointer">Active</Label>
                    </div>
                </div>
                <Button onClick={handleAdd} disabled={isPending || !domain.trim()} className="gap-2">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Save connection
                </Button>
            </div>

            {/* List */}
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                {connections.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground text-center">No SSO connections yet. Staff sign in with email and password.</p>
                ) : connections.map((c, i) => (
                    <div key={c.domain} className={`flex items-center gap-4 px-5 py-3 ${i !== connections.length - 1 ? "border-b border-border/30" : ""}`}>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{c.displayName}</p>
                            <p className="text-xs text-muted-foreground">{c.domain} via {c.provider}{!c.isActive && " (inactive)"}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.domain)} disabled={isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}
