import type { Assessment, CatalogProduct, Profile, RecResponse, Routine, ShelfProduct } from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: isForm ? init?.headers : { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
  } catch {
    throw new ApiError("Can't reach the SkinWise server. Make sure the backend is running.", 0, "NETWORK");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error || `Request failed (${response.status})`, response.status, body.code);
  return body as T;
}

/* health */
export const getHealth = () => api<{ ok: boolean; youcamConfigured: boolean }>("/api/health");

/* catalog + shelf */
export const searchCatalog = async (q: string) =>
  (await api<{ products: CatalogProduct[] }>(`/api/products/search?q=${encodeURIComponent(q)}`)).products;
export const getShelf = async () => (await api<{ products: ShelfProduct[] }>("/api/shelf")).products;
export const addShelfProduct = async (input: Partial<ShelfProduct> & { code: string }) =>
  (await api<{ product: ShelfProduct }>("/api/shelf", { method: "POST", body: JSON.stringify(input) })).product;
export const updateShelfProduct = async (id: string, patch: Partial<ShelfProduct>) =>
  (await api<{ product: ShelfProduct }>(`/api/shelf/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) })).product;
export const removeShelfProduct = (id: string) =>
  api<{ ok: true }>(`/api/shelf/${encodeURIComponent(id)}`, { method: "DELETE" });

/* profile */
export const getProfile = async () => (await api<{ profile: Profile }>("/api/profile")).profile;
export const saveProfile = async (patch: Partial<Profile>) =>
  (await api<{ profile: Profile }>("/api/profile", { method: "PUT", body: JSON.stringify(patch) })).profile;

/* routine */
export const getRoutine = async () => (await api<{ routine: Routine }>("/api/routine")).routine;
export const saveRoutine = async (r: Partial<Pick<Routine, "AM" | "PM">>) =>
  (await api<{ routine: Routine }>("/api/routine", { method: "PUT", body: JSON.stringify(r) })).routine;
export const logRoutineStep = async (date: string, type: "AM" | "PM", stepId: string, done: boolean) =>
  (await api<{ routine: Routine }>("/api/routine/log", { method: "POST", body: JSON.stringify({ date, type, stepId, done }) })).routine;

/* skin analysis (YouCam via Express — the browser never talks to the provider directly) */
export async function startSkinAnalysis(image: File, actions: string[]) {
  const body = new FormData();
  body.append("image", image);
  body.append("actions", JSON.stringify(actions));
  body.append("consent", "true");
  return (await api<{ assessment: Assessment }>("/api/skin-analysis", { method: "POST", body })).assessment;
}
export const getAssessment = async (id: string) =>
  (await api<{ assessment: Assessment }>(`/api/skin-analysis/${encodeURIComponent(id)}`)).assessment;
export const getAssessmentHistory = async () =>
  (await api<{ assessments: Assessment[] }>("/api/skin-analysis/history")).assessments;
export const deleteAssessment = (id: string) =>
  api<{ ok: true }>(`/api/skin-analysis/${encodeURIComponent(id)}`, { method: "DELETE" });
export const updateAssessmentNote = async (id: string, note: string) =>
  (await api<{ assessment: Assessment }>(`/api/skin-analysis/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ note }) })).assessment;

/* AI product recommendations with live prices (Pricee) */
export const getRecommendations = (needs: { category: string; role: string; reason: string; source: string; keywords: string[] }[], budget: number | null) =>
  api<RecResponse>("/api/recommendations", { method: "POST", body: JSON.stringify({ needs, budget }) });
