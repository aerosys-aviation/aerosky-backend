'use client'

import {
    Activity,
    AlertTriangle,
    Calendar,
    ChevronRight,
    Eye,
    Link as LinkIcon,
    Loader2,
    Plane,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    X,
    Cpu,
    Compass,
    Signal,
    Box
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Drone {
    id: string
    modelName: string
    webPortalLink?: string
    isDgcaCertified?: boolean
    createdAt: string
    accountableManager?: { name: string }
    manufacturedUnits?: any[]
}

export default function DronesPage() {
    const { data: session, status } = useSession()
    const [drones, setDrones] = useState<Drone[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [formData, setFormData] = useState({ modelName: '', webPortalLink: '', isDgcaCertified: false })
    const [submitting, setSubmitting] = useState(false)

    const fetchDrones = async () => {
        try {
            const res = await fetch('/api/mobile/drones')
            if (res.ok) {
                const data = await res.json()
                setDrones(data)
            }
        } catch (error) {
            console.error('Failed to fetch drones:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (session) fetchDrones()
    }, [session])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const res = await fetch('/api/mobile/drones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            if (res.ok) {
                setShowModal(false)
                setFormData({ modelName: '', webPortalLink: '', isDgcaCertified: false })
                fetchDrones()
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Decommission this aircraft from active fleet registry? This action is irreversible.')) return
        try {
            await fetch(`/api/mobile/drones/${id}`, { method: 'DELETE' })
            fetchDrones()
        } catch (error) {
            console.error('Failed to delete drone:', error)
        }
    }

    const handleToggleCertification = async (id: string, currentStatus?: boolean) => {
        try {
            const res = await fetch(`/api/mobile/drones/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isDgcaCertified: !currentStatus })
            })
            if (res.ok) {
                setDrones(prev => prev.map(d => d.id === id ? { ...d, isDgcaCertified: !currentStatus } : d))
            }
        } catch (error) {
            console.error('Failed to toggle certification status:', error)
        }
    }

    const filteredDrones = drones.filter(d =>
        d.modelName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-slide-up">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-orange-600 rounded-full animate-spin" />
            <p className="mt-8 text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Fleet Data</p>
        </div>
    )
    if (status === 'unauthenticated') return null

    return (
        <>
            <div className="space-y-12 animate-slide-up pb-10">
                {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl lg:text-5xl font-black text-slate-900 tracking-tightest">Aerial <span className="text-slate-400 font-medium">Assets</span></h1>
                </div>
                <button
                    onClick={() => {
                        setFormData({ modelName: '', webPortalLink: '', isDgcaCertified: false });
                        setShowModal(true);
                    }}
                    className="w-full md:w-auto btn-premium-primary !py-3.5 lg:!py-4 shadow-2xl shadow-orange-500/10 group"
                >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                    Register Unit
                </button>
            </div>

            {/* Fleet Telemetry Stats */}
            <div className="grid grid-cols-1 md:grid-cols-1 max-w-xs gap-4">
                {[
                    { label: 'Active Fleet Size', value: drones.length, icon: Plane, color: 'orange' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-lg border border-orange-200 flex items-center justify-center bg-orange-50 text-orange-600">
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tactical Filter */}
            <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search fleet by model..."
                    className="input-modern !pl-11 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Aircraft Deployment Grid */}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredDrones.map((drone) => (
                    <div key={drone.id} className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col p-6">
                        <div className="flex items-start justify-between mb-6">
                            <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-slate-800">
                                <Plane className="w-6 h-6" />
                            </div>
                            <div className="flex gap-2">
                                <Link
                                    href={`/dashboard/drones/${drone.id}`}
                                    className="w-9 h-9 bg-white border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-orange-300 rounded-lg flex items-center justify-center transition-colors text-sm"
                                    title="Diagnostics"
                                >
                                    <Activity className="w-4 h-4" />
                                </Link>
                                <button
                                    onClick={() => handleDelete(drone.id)}
                                    className="w-9 h-9 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-lg flex items-center justify-center transition-colors"
                                    title="Decommission"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 flex-1">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-orange-600 transition-colors">
                                    {drone.modelName}
                                </h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleToggleCertification(drone.id, drone.isDgcaCertified)
                                        }}
                                        title="Click to toggle DGCA certification status"
                                        className="transition-transform active:scale-95 text-left"
                                    >
                                        {drone.isDgcaCertified ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                                <ShieldCheck className="w-3.5 h-3.5" /> DGCA Certified
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Pending Certification
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                                <span className="flex items-center gap-1.5 font-medium">
                                    <Box className="w-3.5 h-3.5 text-orange-500" /> Manufactured Units
                                </span>
                                <span className="font-semibold text-slate-900">{drone.manufacturedUnits?.length || 0} Units</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredDrones.length === 0 && (
                <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-xl flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center mb-4">
                        <Plane className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No Aircraft Found</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto mt-1">Register a new aircraft to expand your organization's fleet.</p>
                </div>
            )}
        </div>

        {showModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
                    <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                                <Plane className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Register New Aircraft</h3>
                                <p className="text-xs text-slate-500">Add an aircraft specification to the fleet</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowModal(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Aircraft Model Name *
                                </label>
                                <div className="relative">
                                    <Plane className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="e.g. AeroX Phantom X1"
                                        value={formData.modelName}
                                        onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                                        className="input-modern !pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Telemetry Portal Link
                                </label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input
                                        type="url"
                                        placeholder="https://telemetry.manufacturer.com"
                                        value={formData.webPortalLink}
                                        onChange={(e) => setFormData({ ...formData, webPortalLink: e.target.value })}
                                        className="input-modern !pl-10"
                                    />
                                </div>
                            </div>

                            <div
                                className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-lg cursor-pointer hover:bg-slate-100/70 transition-colors"
                                onClick={() => setFormData({ ...formData, isDgcaCertified: !formData.isDgcaCertified })}
                            >
                                <input
                                    type="checkbox"
                                    checked={formData.isDgcaCertified}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 pointer-events-none"
                                />
                                <div>
                                    <span className="text-sm font-semibold text-slate-800">DGCA Type Certified</span>
                                    <p className="text-xs text-slate-500">Mark if this model possesses regulatory type certification</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn-premium-primary"
                            >
                                {submitting ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                                    </span>
                                ) : (
                                    'Register Aircraft'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
        </>
    )
}

