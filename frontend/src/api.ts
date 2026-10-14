import type {
  Reimbursement,
  ReimbursementWithDepartment,
  SummaryStats,
  Department,
  DepartmentStats,
  ReceiptImage,
  UploadedFile,
} from "./types";

import { apiFetch } from "./auth";
const API_BASE_URL = "/api";

// Helper function for making API requests
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await apiFetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  return response.json();
}

// Helper function for file upload (multipart/form-data)
async function apiFileUpload<T>(endpoint: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  return response.json();
}

// Department API
export const departmentApi = {
  // Get all departments
  getAll: (): Promise<Department[]> => {
    return apiRequest<Department[]>("/departments/");
  },

  // Get a single department by ID
  getById: (id: string): Promise<Department> => {
    return apiRequest<Department>(`/departments/${id}`);
  },

  // Create a new department
  create: (
    data: Omit<Department, "id" | "created_at">,
  ): Promise<Department> => {
    return apiRequest<Department>("/departments/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Update an existing department
  update: (
    id: string,
    data: Omit<Department, "id" | "created_at">,
  ): Promise<Department> => {
    return apiRequest<Department>(`/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Delete a department
  delete: (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/departments/${id}`, {
      method: "DELETE",
    });
  },

  // Get department statistics
  getStats: (id: string): Promise<DepartmentStats> => {
    return apiRequest<DepartmentStats>(`/departments/${id}/stats`);
  },
};

// Reimbursement API
export const reimbursementApi = {
  void: (id: string, reason: string): Promise<{ message: string }> =>
    apiRequest(`/reimbursements/${id}/void`, { method: "POST", body: JSON.stringify({ reason }) }),
  markReimbursed: (ids: string[]): Promise<{ updated: number }> =>
    apiRequest("/reimbursements/mark-reimbursed", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),
  // Get all reimbursements with optional search and department filter
  getAll: (
    search?: string,
    departmentId?: string,
  ): Promise<ReimbursementWithDepartment[]> => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (departmentId) params.append("department_id", departmentId);

    const query = params.toString();
    const url = `/reimbursements/${query ? `?${query}` : ""}`;
    return apiRequest<ReimbursementWithDepartment[]>(url);
  },

  // Get a single reimbursement by ID
  getById: (id: string): Promise<ReimbursementWithDepartment> => {
    return apiRequest<ReimbursementWithDepartment>(`/reimbursements/${id}`);
  },

  // Create a new reimbursement
  create: (data: Omit<Reimbursement, "id">): Promise<Reimbursement> => {
    return apiRequest<Reimbursement>("/reimbursements/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Update an existing reimbursement
  update: (
    id: string,
    data: Omit<Reimbursement, "id">,
  ): Promise<Reimbursement> => {
    return apiRequest<Reimbursement>(`/reimbursements/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Delete a reimbursement
  delete: (id: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/reimbursements/${id}`, {
      method: "DELETE",
    });
  },
};

// Image API
export const imageApi = {
  // Upload receipt image for a reimbursement
  upload: (reimbursementId: string, file: File): Promise<ReceiptImage> => {
    return apiFileUpload<ReceiptImage>(
      `/reimbursements/${reimbursementId}/images`,
      file,
    );
  },

  // Get all images for a reimbursement
  getByReimbursement: (reimbursementId: string): Promise<ReceiptImage[]> => {
    return apiRequest<ReceiptImage[]>(
      `/reimbursements/${reimbursementId}/images`,
    );
  },

  // Delete an image
  delete: (imageId: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>(`/images/${imageId}`, {
      method: "DELETE",
    });
  },
};

// Standalone upload API
export const uploadApi = {
  upload: (file: File): Promise<UploadedFile> => {
    return apiFileUpload<UploadedFile>("/uploads", file);
  },
};

// Summary API
export const summaryApi = {
  getSummary: (departmentId?: string): Promise<SummaryStats> => {
    const url = departmentId
      ? `/summary?department_id=${departmentId}`
      : "/summary";
    return apiRequest<SummaryStats>(url);
  },
};

// Health check
export const healthApi = {
  check: (): Promise<{ message: string; version: string }> => {
    return apiRequest<{ message: string; version: string }>("/");
  },
};
