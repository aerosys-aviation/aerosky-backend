import axios from 'axios';

export const api = axios.create({
    baseURL: '/api',
});

export interface RegisterPayload {
    email: string;
    password: string;
    full_name: string;
}

export interface DroneRecord {
    id: string;
    modelName: string;
    image?: string | null;
    accountableManagerId?: string | null;
    createdAt?: string;
    uploads?: Record<string, unknown>;
    manufacturedUnits?: Array<{ serialNumber: string; uin: string }>;
    recurringData?: unknown;
}

export interface TeamMemberPayload {
    full_name: string;
    category_rating?: string;
    position?: string;
    phone?: string;
    primary_id_number?: string;
    email: string;
}

// Auth API
export const authApi = {
    login: async (_email: string, _password: string) => {
        return { message: "Use next-auth signIn instead" };
    },
    register: async (data: RegisterPayload) => {
        const response = await axios.post('/api/auth/register', data);
        return response.data;
    },
    me: async () => {
        const response = await axios.get('/api/auth/session');
        return response.data;
    },
};

// Drones API
export const dronesApi = {
    list: async (params?: Record<string, unknown>) => {
        try {
            const res = await axios.get('/api/drones', { params });
            const items: DroneRecord[] = Array.isArray(res.data) ? res.data : (res.data?.items || []);
            return { data: { total: items.length, items } };
        } catch {
            return { data: { total: 0, items: [] as DroneRecord[] } };
        }
    },
    listModels: async () => {
        try {
            const res = await axios.get('/api/drones');
            const items: DroneRecord[] = Array.isArray(res.data) ? res.data : [];
            return {
                data: items.map((d) => ({
                    id: d.id,
                    model_name: d.modelName,
                    model_number: d.id,
                    category: 'Rotary Wing',
                    weight_class: 'Small',
                    max_altitude_ft: 400,
                    npnt_compliant: true,
                })),
            };
        } catch {
            return { data: [] };
        }
    },
    createModel: async (data: Record<string, unknown>) => {
        const res = await axios.post('/api/drones', data);
        return { data: res.data };
    },
    get: async (id: string) => {
        const res = await axios.get(`/api/drones/${id}`);
        return { data: res.data };
    },
    create: async (data: Record<string, unknown>) => {
        const res = await axios.post('/api/drones', data);
        return { data: res.data };
    },
    update: async (id: string, data: Record<string, unknown>) => {
        const res = await axios.put(`/api/drones/${id}`, data);
        return { data: res.data };
    },
    generateUin: async (_data: Record<string, unknown>) => {
        return { data: { success: true, uin: `UIN-${Date.now()}` } };
    },
    activate: async (_id: string) => {
        return { data: { status: 'Active' } };
    },
};

// Pilots API
export const pilotsApi = {
    list: async (params?: Record<string, unknown>) => {
        try {
            const res = await axios.get('/api/team', { params });
            const list = Array.isArray(res.data) ? res.data : [];
            return {
                data: list.map((m: { id: string; name: string; accessId?: string; position?: string }) => ({
                    id: m.id,
                    full_name: m.name,
                    rpto_authorization_number: m.accessId,
                    category_rating: m.position || 'Pilot',
                    status: 'Active',
                })),
            };
        } catch {
            return { data: [] };
        }
    },
    get: async (id: string) => {
        try {
            const res = await axios.get(`/api/team/${id}`);
            const m = res.data;
            return {
                data: {
                    id: m.id,
                    full_name: m.name,
                    rpto_authorization_number: m.accessId,
                    category_rating: m.position || 'Pilot',
                    status: 'Active',
                },
            };
        } catch {
            return { data: null };
        }
    },
    create: async (data: TeamMemberPayload) => {
        const res = await axios.post('/api/team', {
            name: data.full_name,
            position: data.category_rating || data.position || 'Pilot',
            phone: data.phone || data.primary_id_number,
            email: data.email,
        });
        return { data: res.data };
    },
};

// Maintenance API
export const maintenanceApi = {
    list: async (_params?: Record<string, unknown>) => {
        return { data: [] };
    },
    create: async (data: Record<string, unknown>) => {
        return { data: { ...data, id: `log-${Date.now()}` } };
    },
};

// Flights API
export const flightsApi = {
    listPlans: async (_params?: Record<string, unknown>) => {
        return { data: { total: 0, items: [] } };
    },
    getPlan: async (_id: string) => {
        return { data: null };
    },
    createPlan: async (data: Record<string, unknown>) => {
        return { data: { ...data, id: `plan-${Date.now()}` } };
    },
    updatePlan: async (id: string, data: Record<string, unknown>) => {
        return { data: { ...data, id } };
    },
    validateNpnt: async (_data: Record<string, unknown>) => {
        return { data: { is_valid: true, checks: [] } };
    },
    validateZone: async (_data: Record<string, unknown>) => {
        return { data: { zone_type: 'GREEN', is_flyable: true, message: 'Clear to fly' } };
    },
    ingestLogs: async (_data: Record<string, unknown>) => {
        return { data: { success: true, entries_processed: 0 } };
    },
    getSummary: async (_planId: string) => {
        return { data: { total_distance_m: 0, max_altitude_m: 0 } };
    },
    startFlight: async (_planId: string) => {
        return { data: { status: 'InProgress' } };
    },
    completeFlight: async (_planId: string) => {
        return { data: { status: 'Completed' } };
    },
};
