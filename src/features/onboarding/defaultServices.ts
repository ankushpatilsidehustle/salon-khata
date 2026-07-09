import type { SalonType } from "@/repositories/salon-repository";

export type ServiceGenderSide = "male" | "female";

/**
 * Category names must match one of the defaults created by
 * `ServiceCategoryRepository.ensureDefaults` (case-insensitive).
 */
export type DefaultCategoryName =
  | "Hair"
  | "Facial"
  | "Waxing"
  | "Threading"
  | "Manicure & Pedicure"
  | "Massage"
  | "Makeup"
  | "Others";

export type DefaultServiceSeed = {
  name: string;
  gender: ServiceGenderSide;
  category: DefaultCategoryName;
};

/**
 * Industry-standard menu of services typically offered at a men's salon.
 * Every row is seeded on finish — the price input on the onboarding screen
 * is optional; blanks are saved as ₹0 and edited later.
 */
const MEN_SERVICES: DefaultServiceSeed[] = [
  { name: "Haircut", gender: "male", category: "Hair" },
  { name: "Kids Haircut", gender: "male", category: "Hair" },
  { name: "Beard Trim", gender: "male", category: "Hair" },
  { name: "Beard Styling", gender: "male", category: "Hair" },
  { name: "Clean Shave", gender: "male", category: "Hair" },
  { name: "Hair Wash", gender: "male", category: "Hair" },
  { name: "Hair Colour", gender: "male", category: "Hair" },
  { name: "Hair Spa", gender: "male", category: "Hair" },
  { name: "Hair Straightening", gender: "male", category: "Hair" },
  { name: "Head Massage", gender: "male", category: "Massage" },
  { name: "Face Cleanup", gender: "male", category: "Facial" },
  { name: "Facial", gender: "male", category: "Facial" },
  { name: "D-Tan", gender: "male", category: "Facial" },
  { name: "Threading (Eyebrows)", gender: "male", category: "Threading" },
  { name: "Manicure", gender: "male", category: "Manicure & Pedicure" },
  { name: "Pedicure", gender: "male", category: "Manicure & Pedicure" }
];

/** Industry-standard menu of services typically offered at a ladies parlour. */
const WOMEN_SERVICES: DefaultServiceSeed[] = [
  { name: "Haircut", gender: "female", category: "Hair" },
  { name: "Kids Haircut", gender: "female", category: "Hair" },
  { name: "Hair Wash", gender: "female", category: "Hair" },
  { name: "Blow Dry", gender: "female", category: "Hair" },
  { name: "Hair Colour", gender: "female", category: "Hair" },
  { name: "Hair Highlights", gender: "female", category: "Hair" },
  { name: "Hair Spa", gender: "female", category: "Hair" },
  { name: "Hair Straightening", gender: "female", category: "Hair" },
  { name: "Keratin Treatment", gender: "female", category: "Hair" },
  { name: "Head Massage", gender: "female", category: "Massage" },
  { name: "Cleanup", gender: "female", category: "Facial" },
  { name: "Facial", gender: "female", category: "Facial" },
  { name: "Premium Facial", gender: "female", category: "Facial" },
  { name: "Bleach", gender: "female", category: "Facial" },
  { name: "D-Tan", gender: "female", category: "Facial" },
  { name: "Threading (Eyebrows)", gender: "female", category: "Threading" },
  { name: "Threading (Upper Lip)", gender: "female", category: "Threading" },
  { name: "Threading (Forehead)", gender: "female", category: "Threading" },
  { name: "Waxing (Arms)", gender: "female", category: "Waxing" },
  { name: "Waxing (Legs)", gender: "female", category: "Waxing" },
  { name: "Waxing (Underarms)", gender: "female", category: "Waxing" },
  { name: "Waxing (Full Body)", gender: "female", category: "Waxing" },
  { name: "Manicure", gender: "female", category: "Manicure & Pedicure" },
  { name: "Pedicure", gender: "female", category: "Manicure & Pedicure" },
  { name: "Nail Art", gender: "female", category: "Manicure & Pedicure" },
  { name: "Nail Extension", gender: "female", category: "Manicure & Pedicure" },
  { name: "Party Makeup", gender: "female", category: "Makeup" },
  { name: "Bridal Makeup", gender: "female", category: "Makeup" },
  { name: "Mehendi", gender: "female", category: "Others" },
  { name: "Saree Draping", gender: "female", category: "Others" }
];

export type ServiceLists = {
  men: DefaultServiceSeed[];
  women: DefaultServiceSeed[];
};

export function getServicesForSalonType(salonType: SalonType): ServiceLists {
  if (salonType === "male") return { men: MEN_SERVICES, women: [] };
  if (salonType === "female") return { men: [], women: WOMEN_SERVICES };
  return { men: MEN_SERVICES, women: WOMEN_SERVICES };
}
