
const API_URL = process.env.API_URL || '/api';

// --- Generic Helper ---

const strapiRequest = async (endpoint: string, options: RequestInit = {}) => {
    try {
        const token = localStorage.getItem('jwt_token');
        const headers: Record<string, string> = {
            ...((options.headers as Record<string, string>) || {}),
        };
        
        // Add default Content-Type only if not FormData
        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
             headers['Content-Type'] = 'application/json';
        }


        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error ${endpoint}:`, response.status, errorText);
            throw new Error(`API Error ${response.status}: ${response.statusText}`);
        }

        if (response.status === 204) {
            return null;
        }

        const text = await response.text();
        if (!text) return null; // Handle empty body

        try {
            return JSON.parse(text);
        } catch (e) {
            console.warn('Failed to parse JSON response:', text);
            return null;
        }
    } catch (error) {
        console.error(`Request failed: ${endpoint}`, error);
        throw error;
    }
};

// --- Users ---

export const fetchUsers = async () => {
    try {
        const data = await strapiRequest('/users?populate=*');
        return data;
    } catch (error) {
        console.error('Error fetching users:', error);
        return [];
    }
};

export const fetchRoles = async () => {
    try {
        const data = await strapiRequest('/users-permissions/roles');
        return data.roles || data;
    } catch (error) {
        console.error('Error fetching roles:', error);
        return [];
    }
};

export const checkBackendConnection = async () => {
    try {
        const response = await fetch(`${API_URL}/users?pagination[limit]=1`);
        return response.ok;
    } catch (error) {
        return false;
    }
};

export const updateUser = async (userId: string, data: any) => {
    return strapiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

export const createUser = async (data: any) => {
    return strapiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};

export const deleteUser = async (userId: string | number) => {
    return strapiRequest(`/users/${userId}`, {
        method: 'DELETE',
    });
};

// --- Logging ---

export const createLog = async (action: string, actor: string, details: string, entityId?: string) => {
    try {
        await strapiRequest('/audit-logs', {
            method: 'POST',
            body: JSON.stringify({
                data: {
                    action,
                    actor,
                    details,
                    entity_id: entityId || '',
                    publishedAt: new Date().toISOString() // Auto publish
                }
            })
        });
    } catch (e) {
        console.error("Failed to write log", e);
    }
};

// --- Categories (Generic CRUD) ---

// Helper to unwrap Strapi response (v4/v5 structure: { data: [{ id, attributes: ... }] } or { data: [...] })
// For v5, simplified API returns { data: [...] } usually, or just [...] for some plugins.
// We'll normalize to array of objects with 'id'.
const normalizeStrapiList = (response: any) => {
    if (Array.isArray(response)) return response;
    if (response?.data && Array.isArray(response.data)) {
        const items = response.data.map((item: any) => ({
            ...item,
            ...(item.attributes || {}),
            strapiId: item.id,
            id: item.documentId || item.id,
        }));

        // Deduplicate by id (which is either documentId or numeric id)
        const uniqueItems = Array.from(new Map(items.map((item: any) => [item.id, item])).values());
        return uniqueItems;
    }
    return [];
};

// Normalize single item
export const normalizeStrapiItem = (item: any) => {
    if (!item) return null;
    const attributes = item.attributes || item;
    const id = item.documentId || item.id;

    // Create a normalized copy
    const normalized = {
        ...attributes,
        id: id,
        strapiId: item.id
    };

    // Note: Recursive normalization for relations can be complex here, 
    // so we'll handle specific mapping in the views where we know the structure.
    return normalized;
};

export const fetchCategory = async (collectionName: string) => {
    let endpoint = `/${collectionName}`;

    if (collectionName === 'users' || collectionName.startsWith('users?')) {
        const json = await strapiRequest(endpoint);
        return normalizeStrapiList(json);
    }

    const defaultParams = 'populate=*&pagination[pageSize]=1000&publicationState=preview';

    // Check if collectionName already has query params
    if (collectionName.includes('?')) {
        // If it has query params but no pagination params, add a large pageSize
        if (!collectionName.includes('pagination[')) {
            endpoint += '&pagination[pageSize]=1000';
        }
        // If it has query params but no publicationState, add preview
        if (!collectionName.includes('publicationState')) {
            endpoint += '&publicationState=preview';
        }
    } else {
        // Default behavior for simple collection names
        endpoint += `?${defaultParams}`;
    }

    const json = await strapiRequest(endpoint);
    return normalizeStrapiList(json);
};

export const fetchCategoryPaginated = async (collectionName: string, page: number = 1, pageSize: number = 50, filters: string = '', customParams: string = 'populate=*') => {
    let endpoint = `/${collectionName}?${customParams}&pagination[page]=${page}&pagination[pageSize]=${pageSize}&publicationState=preview`;
    if (filters) {
        endpoint += `&${filters}`;
    }

    const json = await strapiRequest(endpoint);
    return {
        data: normalizeStrapiList(json),
        meta: json?.meta || { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } }
    };
};

// Fetch all pages of a collection in parallel — use for small-to-medium collections needing full data
// Uses large page size to minimize round trips
export const fetchCategoryAll = async (collectionName: string, customParams: string = 'populate=*') => {
    // First request: get total count
    const firstEndpoint = `/${collectionName}?${customParams}&pagination[page]=1&pagination[pageSize]=200&publicationState=preview`;
    const firstJson = await strapiRequest(firstEndpoint);
    const total = firstJson?.meta?.pagination?.total || 0;
    const pageSize = 200;
    const pageCount = Math.ceil(total / pageSize);

    // Collect first page result
    const firstData = normalizeStrapiList(firstJson);

    if (pageCount <= 1) return firstData;

    // Fetch remaining pages in parallel
    const remainingRequests = [];
    for (let page = 2; page <= pageCount; page++) {
        remainingRequests.push(
            strapiRequest(`/${collectionName}?${customParams}&pagination[page]=${page}&pagination[pageSize]=${pageSize}&publicationState=preview`)
        );
    }
    const remainingResults = await Promise.all(remainingRequests);
    const allData = [
        ...firstData,
        ...remainingResults.flatMap(json => normalizeStrapiList(json))
    ];
    return allData;
};

export const fetchItem = async (collectionName: string, id: string | number) => {
    const endpoint = `/${collectionName}/${id}?populate=*`;
    const json = await strapiRequest(endpoint);
    // Strapi v5 returns { data: { id, documentId, ...fields }, meta: {} }
    // We need to normalize the .data part, not the whole response
    const rawItem = json?.data || json;
    return normalizeStrapiItem(rawItem);
};

export const createCategory = async (collectionName: string, data: any) => {
    const payload = {
        data: {
            ...data,
            // locale: 'en', // Removed as i18n is disabled in backend
            publishedAt: new Date().toISOString()
        }
    };
    console.log(`[API] Creating ${collectionName}`, payload);
    const json = await strapiRequest(`/${collectionName}`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    const rawItem = json?.data || json;
    return normalizeStrapiItem(rawItem);
};

export const updateCategory = async (collectionName: string, id: string, data: any) => {
    const payload = { data };
    console.log(`[API] Updating ${collectionName}/${id}`, payload);
    const json = await strapiRequest(`/${collectionName}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    const rawItem = json?.data || json;
    return normalizeStrapiItem(rawItem);
};

export const publishDocument = async (collectionName: string, id: string) => {
    try {
        const json = await strapiRequest(`/${collectionName}/${id}/actions/publish`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
        return normalizeStrapiItem(json);
    } catch (error) {
        console.warn(`[API] Publish not needed or failed for ${collectionName}/${id}`, error);
        return null;
    }
};


export const deleteCategory = async (collectionName: string, id: string) => {
    console.log(`[API] Deleting ${collectionName}/${id}`);
    const json = await strapiRequest(`/${collectionName}/${id}`, {
        method: 'DELETE',
    });
    return normalizeStrapiItem(json);
};

export const uploadFile = async (base64Data: string, filename: string) => {
    try {
        // Convert base64 to Blob
        const res = await fetch(base64Data);
        const blob = await res.blob();
        
        const formData = new FormData();
        formData.append('files', blob, filename);
        
        const json = await strapiRequest('/upload', {
            method: 'POST',
            body: formData
        });
        
        return json; // Array of uploaded files info [{id, url, ...}]
    } catch (e) {
        console.error("Upload file failed", e);
        return null;
    }
};

// --- Duplicate Check ---
// Ki\u1ec3m tra h\u1ecdc vi\u00ean c\u00f3 \u0111\u00e3 \u0111\u0103ng k\u00fd l\u1edbp n\u00e0y ch\u01b0a d\u1ef1a v\u00e0o id_number + class documentId
export const checkDuplicateStudent = async (
    idNumber: string,
    classDocumentId: string,
    excludeStudentId?: string
): Promise<{ exists: boolean; count: number; students: { id: string; fullName: string; idNumber: string; className: string }[] }> => {
    try {
        let url = `/students/check-duplicate?id_number=${encodeURIComponent(idNumber)}&class_id=${encodeURIComponent(classDocumentId)}`;
        if (excludeStudentId) url += `&exclude_student_id=${encodeURIComponent(excludeStudentId)}`;
        const res = await strapiRequest(url);
        return res || { exists: false, count: 0, students: [] };
    } catch (e) {
        console.error('[checkDuplicateStudent]', e);
        return { exists: false, count: 0, students: [] };
    }
};

// Mapping for collection names
export const COLLECTIONS = {
    NATIONS: 'nations',
    SUPPLIERS: 'suppliers',
    CLASSROOMS: 'classrooms',
    CLASSES: 'school-classes', // Note: mapped from 'classes' in frontend
    SUBJECTS: 'subjects',
    TEACHERS: 'teachers',
    STUDENTS: 'students',
    CLASS_DECISIONS: 'class-decisions',
    TRAINING_ASSIGNMENTS: 'training-assignments',
    EXAM_APPROVALS: 'exam-approvals',
    EXAM_GRADES: 'exam-grades',
    STUDENT_DOCUMENTS: 'student-documents',
    AUDIT_LOGS: 'audit-logs',
    PRINT_TEMPLATES: 'print-templates'
};

// --- Database Backup ---

export const triggerBackup = async (): Promise<{ success: boolean; filename?: string; sizeKB?: number; message?: string; error?: string }> => {
    return strapiRequest('/backup', { method: 'POST' });
};

