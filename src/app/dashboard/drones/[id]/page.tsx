'use client'

import {
    AlertTriangle,
    ArrowLeft,
    Briefcase,
    ChevronDown,
    ChevronUp,
    Clock,
    FileText,
    Globe,
    Loader2,
    Lock,
    Plane,
    Settings,
    Shield,
    ShieldCheck,
    ShoppingBag,
    User,
    UserCheck,
    Users,
    Wrench,
    Zap
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface TeamMember {
    id: string
    name: string
    position: string
    accessId: string
}

interface Subcontractor {
    id: string
    companyName: string
    type: string
}

interface DroneUploads {
    trainingManual?: string
    infrastructureManufacturing?: string[]
    systemDesign?: string
    hardwareSecurity?: string[]
    webPortalLink?: string
    regulatoryDisplay?: string[]
}

interface Drone {
    id: string
    modelName: string
    isDgcaCertified?: boolean
    accountableManagerId?: string
    accountableManager?: { name: string; position: string }
    uploads: DroneUploads
    manufacturedUnits: { serialNumber: string; uin: string }[]
    recurringData?: any
}

const AccordionItem = ({
    title,
    description,
    icon: Icon,
    isComplete,
    children,
    status
}: {
    title: string
    description: string
    icon: any
    isComplete: boolean
    children: React.ReactNode
    status?: { label: string; color: 'green' | 'yellow' | 'red' }
}) => {
    const [isOpen, setIsOpen] = useState(false)

    const getStatusStyles = () => {
        if (status) {
            if (status.color === 'green') return 'border-green-500 bg-green-50 text-green-700'
            if (status.color === 'yellow') return 'border-yellow-500 bg-yellow-50 text-yellow-700'
            if (status.color === 'red') return 'border-red-500 bg-red-50 text-red-700'
        }
        return isComplete ? 'border-green-500 bg-green-50 text-green-700' : 'border-yellow-500 bg-yellow-50 text-yellow-700'
    }

    const badgeStyles = getStatusStyles()

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-3">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center gap-4 p-4 text-left transition-colors hover:bg-gray-50 border-l-4 ${badgeStyles.split(' ')[0]}`}
            >
                <div className={`p-2 rounded-lg ${isComplete ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{title}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${badgeStyles.split(' ').slice(1).join(' ')}`}>
                            {status?.label || (isComplete ? 'Done' : 'Pending')}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {isOpen && (
                <div className="p-4 border-t border-gray-100 bg-gray-50/30">
                    {children}
                </div>
            )}
        </div>
    )
}

export default function DroneDetailPage() {
    const { id } = useParams()
    const router = useRouter()
    const { data: session } = useSession()

    const [drone, setDrone] = useState<Drone | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'one-time' | 'recurring'>('one-time')

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
    const [saving, setSaving] = useState(false)

    // Form states for recurring
    const [webPortalLink, setWebPortalLink] = useState('')
    const [newUnit, setNewUnit] = useState({ serialNumber: '', uin: '' })

    const fetchData = async () => {
        try {
            const [droneRes, teamRes, subRes] = await Promise.all([
                fetch(`/api/mobile/drones/${id}`),
                fetch('/api/mobile/team'),
                fetch('/api/mobile/subcontractors')
            ])

            if (droneRes.ok) {
                const data = await droneRes.json()
                setDrone(data)
                setWebPortalLink(data.uploads?.webPortalLink || '')
            }
            if (teamRes.ok) setTeamMembers(await teamRes.json())
            if (subRes.ok) setSubcontractors(await subRes.json())
        } catch (error) {
            console.error('Failed to fetch data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (session && id) fetchData()
    }, [session, id])

    const updateDrone = async (data: any) => {
        setSaving(true)
        try {
            const res = await fetch(`/api/mobile/drones/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (res.ok) {
                const updated = await res.json()
                setDrone(prev => ({ ...prev!, ...updated }))
                return true
            }
        } catch (error) {
            console.error('Failed to update drone:', error)
        } finally {
            setSaving(false)
        }
        return false
    }

    const addRecurring = async (key: string, record: any) => {
        if (!drone) return
        const current = drone.recurringData?.[key] || []
        await updateDrone({
            recurringData: {
                ...(drone.recurringData || {}),
                [key]: [...current, record]
            }
        })
        fetchData() // Refresh to get proper data structure
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
        )
    }

    if (!drone) {
        return (
            <div className="text-center py-20">
                <Plane className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-bold text-gray-900">Drone not found</h3>
                <button
                    onClick={() => router.back()}
                    className="mt-4 text-blue-600 hover:underline"
                >
                    Go back
                </button>
            </div>
        )
    }

    const uploads = drone.uploads || {}
    const recurring = drone.recurringData || {}

    const checks = {
        orgManual: teamMembers.length > 0,
        trainingManual: !!uploads.trainingManual,
        leadership: !!drone.accountableManagerId,
        infrastructure: (uploads.infrastructureManufacturing?.length || 0) > 0,
        regulatory: (uploads.regulatoryDisplay?.length || 0) > 0,
        systemDesign: !!uploads.systemDesign,
        subcontractors: subcontractors.length > 0,
        hardware: (uploads.hardwareSecurity?.length || 0) > 0,
        webPortal: !!uploads.webPortalLink,
        manufacturedUnits: (drone.manufacturedUnits?.length || 0) > 0,
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-200">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{drone.modelName}</h2>
                        <button
                            type="button"
                            onClick={() => updateDrone({ isDgcaCertified: !drone.isDgcaCertified })}
                            className="mt-1 inline-flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-80"
                            title="Click to toggle DGCA certification status"
                        >
                            {drone.isDgcaCertified ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> DGCA TYPE CERTIFIED
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" /> PENDING CERTIFICATION
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 bg-white px-6 rounded-t-2xl">
                <button
                    onClick={() => setActiveTab('one-time')}
                    className={`px-8 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'one-time'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    One Time Checklist
                </button>
                <button
                    onClick={() => setActiveTab('recurring')}
                    className={`px-8 py-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'recurring'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Recurring Maintenance
                </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
                {activeTab === 'one-time' ? (
                    <div className="grid gap-2">
                        {/* 1. Organizational Manual */}
                        <AccordionItem
                            title="1. Organizational Manual"
                            description="Team members with roles and access IDs"
                            icon={Users}
                            isComplete={checks.orgManual}
                        >
                            <div className="space-y-2">
                                {teamMembers.map(m => (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{m.name}</p>
                                                <p className="text-xs text-gray-500">{m.position}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                            {m.accessId}
                                        </span>
                                    </div>
                                ))}
                                <Link
                                    href="/dashboard/team"
                                    className="block text-center py-2 text-sm text-blue-600 hover:underline"
                                >
                                    Manage Team members →
                                </Link>
                            </div>
                        </AccordionItem>

                        {/* 2. Training Procedure Manual */}
                        <AccordionItem
                            title="2. Training Procedure Manual"
                            description="Technical and flight training documentation"
                            icon={FileText}
                            isComplete={checks.trainingManual}
                        >
                            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-white">
                                <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm text-gray-500">
                                    {uploads.trainingManual ? 'Manual Uploaded ✓' : 'Upload Training Manual (PDF)'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Maximum size 10MB</p>
                            </div>
                        </AccordionItem>

                        {/* 3. Nomination of Leadership */}
                        <AccordionItem
                            title="3. Nomination of Leadership"
                            description="Assign Accountable Manager"
                            icon={UserCheck}
                            isComplete={checks.leadership}
                        >
                            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Select Accountable Manager:</p>
                            <div className="grid grid-cols-2 gap-3">
                                {teamMembers.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => updateDrone({ accountableManagerId: m.id })}
                                        className={`p-4 rounded-xl border text-left transition-all ${drone.accountableManagerId === m.id
                                            ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                                            : 'border-gray-200 hover:border-blue-300'
                                            }`}
                                    >
                                        <p className="font-semibold text-gray-900 text-sm">{m.name}</p>
                                        <p className="text-xs text-gray-500">{m.position}</p>
                                    </button>
                                ))}
                            </div>
                        </AccordionItem>

                        {/* 4. Infrastructure Setup */}
                        <AccordionItem
                            title="4. Infrastructure Setup"
                            description="Facility and testing area verification"
                            icon={Shield}
                            isComplete={checks.infrastructure}
                        >
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Manufacturing Facility</p>
                                    <div className="h-24 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
                                        <p className="text-xs text-gray-400">Add Infrastructure Images</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Testing Facility</p>
                                    <div className="h-24 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
                                        <p className="text-xs text-gray-400">Add Infrastructure Images</p>
                                    </div>
                                </div>
                            </div>
                        </AccordionItem>

                        {/* 5. Regulatory Display */}
                        <AccordionItem
                            title="5. Regulatory Display"
                            description="TC display and fireproof plates"
                            icon={Settings}
                            isComplete={checks.regulatory}
                        >
                            <div className="h-32 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
                                <p className="text-sm text-gray-400">Upload TC Display & Fireproof Plate Photos</p>
                            </div>
                        </AccordionItem>

                        {/* 6. System Design */}
                        <AccordionItem
                            title="6. System Design"
                            description="Control and supervision procedures"
                            icon={Settings}
                            isComplete={checks.systemDesign}
                        >
                            <div className="h-24 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
                                <p className="text-sm text-gray-400">Upload System Design Documentation</p>
                            </div>
                        </AccordionItem>

                        {/* 7. Sub-contractors Agreement */}
                        <AccordionItem
                            title="7. Sub-contractors Agreement"
                            description="Design and manufacturing partners"
                            icon={Briefcase}
                            isComplete={checks.subcontractors}
                        >
                            <div className="space-y-2">
                                {subcontractors.map(s => (
                                    <div key={s.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                                            <ShoppingBag className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{s.companyName}</p>
                                            <p className="text-xs text-gray-500">{s.type}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </AccordionItem>

                        {/* 8. Hardware Security */}
                        <AccordionItem
                            title="8. Hardware Security"
                            description="Tamperproof requirements"
                            icon={Lock}
                            isComplete={checks.hardware}
                        >
                            <div className="h-24 bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-200">
                                <p className="text-sm text-gray-400">Upload Tamperproof Demo Images</p>
                            </div>
                        </AccordionItem>

                        {/* 9. Web Portal */}
                        <AccordionItem
                            title="9. Web Portal"
                            description="Public access portal for UAS info"
                            icon={Globe}
                            isComplete={checks.webPortal}
                        >
                            <div className="flex gap-2">
                                <input
                                    type="url"
                                    placeholder="https://your-portal.com/drone-info"
                                    value={webPortalLink}
                                    onChange={(e) => setWebPortalLink(e.target.value)}
                                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                                <button
                                    onClick={() => updateDrone({ webPortalLink })}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold"
                                >
                                    Save
                                </button>
                            </div>
                        </AccordionItem>

                        {/* 10. Manufactured Units */}
                        <AccordionItem
                            title="10. Manufactured Units"
                            description="Drone serial numbers and UIN"
                            icon={Zap}
                            isComplete={checks.manufacturedUnits}
                        >
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    {drone.manufacturedUnits.map((u, i) => (
                                        <div key={i} className="p-3 bg-white rounded-xl border border-gray-100 flex justify-between items-center">
                                            <span className="font-bold text-gray-900 text-xs">{u.serialNumber}</span>
                                            <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-2 rounded">UIN: {u.uin}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-gray-100/50 p-4 rounded-2xl space-y-3">
                                    <div className="flex gap-2">
                                        <input
                                            placeholder="Serial Number"
                                            value={newUnit.serialNumber}
                                            onChange={(e) => setNewUnit({ ...newUnit, serialNumber: e.target.value })}
                                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                                        />
                                        <input
                                            placeholder="UIN"
                                            value={newUnit.uin}
                                            onChange={(e) => setNewUnit({ ...newUnit, uin: e.target.value })}
                                            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (newUnit.serialNumber && newUnit.uin) {
                                                updateDrone({
                                                    manufacturedUnits: [...drone.manufacturedUnits, newUnit]
                                                })
                                                setNewUnit({ serialNumber: '', uin: '' })
                                            }
                                        }}
                                        className="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-bold text-xs"
                                    >
                                        + Add Unit
                                    </button>
                                </div>
                            </div>
                        </AccordionItem>
                    </div>
                ) : (
                    <div className="grid gap-2">
                        {/* 1. Future Updates Placeholder */}
                        <AccordionItem
                            title="1. Future Compliance"
                            description="Coming soon in next update"
                            icon={Clock}
                            isComplete={false}
                        >
                            <p className="text-sm text-gray-500 italic">This section will be available in a future update.</p>
                        </AccordionItem>

                        {/* 2. Personnel Management */}
                        <AccordionItem
                            title="2. Personnel Management"
                            description="Record of personnel changes"
                            icon={Users}
                            isComplete={(recurring.personnel?.length || 0) > 0}
                            status={recurring.personnel?.length ? (recurring.personnelReported ? { label: 'DGCA Notified', color: 'green' } : { label: 'Report to DGCA', color: 'yellow' }) : { label: 'No Change', color: 'green' }}
                        >
                            <RecurringTable
                                columns={['Date', 'Position', 'Previous', 'New']}
                                data={recurring.personnel || []}
                                keys={['date', 'position', 'previous', 'new']}
                            />
                        </AccordionItem>

                        {/* 3. Staff Competence */}
                        <AccordionItem
                            title="3. Staff Competence"
                            description="Random checks of staff understanding"
                            icon={UserCheck}
                            isComplete={(recurring.staffCompetence?.length || 0) > 0}
                        >
                            <RecurringTable
                                columns={['Date', 'Staff', 'Examiner', 'Result']}
                                data={recurring.staffCompetence || []}
                                keys={['date', 'staff', 'examiner', 'result']}
                            />
                        </AccordionItem>

                        {/* 4. Training Record */}
                        <AccordionItem
                            title="4. Training Record"
                            description="Training record of last two years"
                            icon={FileText}
                            isComplete={(recurring.trainingRecords?.length || 0) > 0}
                        >
                            <RecurringTable
                                columns={['Date', 'Trainer', 'Session', 'Duration']}
                                data={recurring.trainingRecords || []}
                                keys={['date', 'trainer', 'session', 'duration']}
                            />
                        </AccordionItem>

                        {/* 5. Equipment Maintenance */}
                        <AccordionItem
                            title="5. Equipment Maintenance"
                            description="Calibration and service records"
                            icon={Wrench}
                            isComplete={(recurring.equipmentMaintenance?.length || 0) > 0}
                        >
                            <RecurringTable
                                columns={['Date', 'Equipment', 'Serial', 'Type']}
                                data={recurring.equipmentMaintenance || []}
                                keys={['date', 'equipment', 'serial', 'type']}
                            />
                        </AccordionItem>

                        {/* 6. Battery Safety */}
                        <AccordionItem
                            title="6. Battery Safety"
                            description="Battery and charger condition"
                            icon={Zap}
                            isComplete={(recurring.batterySafety?.length || 0) > 0}
                        >
                            <RecurringTable
                                columns={['Date', 'Item', 'ID', 'Condition']}
                                data={recurring.batterySafety || []}
                                keys={['date', 'testedItem', 'itemId', 'condition']}
                            />
                        </AccordionItem>
                    </div>
                )}
            </div>

            {saving && (
                <div className="fixed bottom-6 right-6 bg-white shadow-2xl rounded-full px-6 py-3 flex items-center gap-3 border border-gray-200 animate-in fade-in slide-in-from-bottom-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-sm font-medium">Saving changes...</span>
                </div>
            )}
        </div>
    )
}

function RecurringTable({ columns, data, keys }: { columns: string[], data: any[], keys: string[] }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
            <table className="w-full text-left text-xs">
                <thead>
                    <tr className="bg-gray-50 text-gray-400 uppercase font-bold tracking-wider">
                        {columns.map((col, i) => <th key={i} className="px-4 py-3">{col}</th>)}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                            {keys.map((k, i) => (
                                <td key={i} className="px-4 py-3 text-gray-600 font-medium">
                                    {row[k]}
                                </td>
                            ))}
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400 italic">
                                No records found. Use the mobile app to add data to this section.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

const Activity = (props: any) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
)
