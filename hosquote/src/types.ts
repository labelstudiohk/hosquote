export type PricingMode = "included" | "optional" | "reference" | "manual";

export interface CatalogCategory {
  id: string;
  code: string;
  name: string;
  scope: "package" | "extra";
}

export interface CatalogItem {
  id: string;
  code: string;
  categoryId: string;
  name: string;
  description: string;
  unit: string;
  defaultQty: number;
  price: number;
  pricingMode: PricingMode;
  autoRule?: "kitchenBathroom" | "packageFurniture" | "packageCeiling";
}

export interface PackageOption {
  id: string;
  label: string;
  maxSqft: number;
  price: number;
  includedFurnitureFeet: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  estate: string;
  block: string;
  floor: string;
  unit: string;
  area: string;
  packageId: string;
  furnitureLocations: string;
  kitchenDemolition: "" | "yes" | "no";
  bathroomDemolition: "" | "yes" | "no";
}

export interface ItemSelection {
  selected: boolean;
  qty: number;
  unitPrice: number;
}

export interface AiSuggestion {
  catalogId: string;
  title: string;
  reason: string;
  suggestedQty: number;
  confidence: "高" | "中" | "低";
}

export interface AiAnalysis {
  summary: string;
  measurements: string[];
  suggestions: AiSuggestion[];
  cautions: string[];
}
