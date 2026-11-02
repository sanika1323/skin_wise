export type RoutineCategory =
  | "Cleanser" | "Toner" | "Serum" | "Treatment" | "Moisturizer"
  | "Sunscreen" | "Eye care" | "Mask" | "Exfoliant" | "Other";

export type CatalogProduct = {
  code: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
  productUrl: string | null;
  ingredients: string;
  quantity: string;
  source: string;
};

export type ShelfProduct = CatalogProduct & {
  id: string;
  price: number | null;
  remaining: number;
  purchasedAt: string | null;
  addedAt: string;
  expiryDate?: string | null;
  notes?: string;
  routineUsage?: ("AM" | "PM")[];
  routineCategory?: RoutineCategory | null;
};

export type SkinMetric = {
  type: string;
  uiScore: number | null;
  rawScore: number | null;
  maskUrls: string[];
  extra?: Record<string, string | number | boolean>;
};

export type Assessment = {
  id: string;
  providerTaskId: string | null;
  status: "processing" | "completed" | "failed";
  stage?: string;
  actions: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
  results: SkinMetric[];
  note?: string;
};

export type Profile = {
  name: string;
  skinType: string;
  sensitivity: string;
  goals: string[];
  concerns: string[];
  preferences: { fragranceFree?: boolean; nonComedogenic?: boolean; minimalRoutine?: boolean };
  avoidIngredients: string[];
  budget: number | null;
  currency: string;
  updatedAt: string | null;
};

export type RoutineStep = {
  id: string;
  productId?: string | null;
  category: RoutineCategory;
  name: string;
  instructions: string;
  frequency: string;
  reason: string;
  optional: boolean;
  sortOrder: number;
};

export type Routine = {
  AM: { steps: RoutineStep[]; updatedAt: string | null };
  PM: { steps: RoutineStep[]; updatedAt: string | null };
  logs: Record<string, { AM: string[]; PM: string[] }>;
};

/** A real retailer listing recommended by SkinWise AI for a routine step (never auto-added to My Products). */
export type RecOffer = { retailer: string; price: number; link: string | null };
export type Recommendation = {
  id: string;
  name: string;
  fullTitle: string;
  brand: string;
  image: string | null;
  size: string | null;
  price: number;
  mrp: number | null;
  retailer: string;
  link: string | null;
  priceeLink: string | null;
  priceCheckedAt: string | null;
  storesCompared: number;
  offers: RecOffer[];
  score: number;
  breakdown: { suitability: number; affordability: number; trustedBrand: number };
  why: string[];
  category: RoutineCategory;
};
export type RecResult = { need: { category: RoutineCategory; role: string; reason: string; source: string; keywords: string[] }; products: Recommendation[]; totalFound?: number; afterBudget?: number; error?: string };
export type RecResponse = { results: Partial<Record<RoutineCategory, RecResult>>; budget: number | null; source: string; generatedAt: string };
