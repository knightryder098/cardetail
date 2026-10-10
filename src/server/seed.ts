import type { Catalogue, Service, State, Tier, TierCode } from "@/lib/types";
import { randomUUID } from "node:crypto";
const tierCodes: TierCode[] = ["normal", "premium", "premium_plus"];
const tierNames = ["Normal", "Premium", "Premium+"];
const serviceInfo = [
  [
    "exterior-detail",
    "Exterior Detail",
    "cleaning",
    "wash",
    "A fresh start for every surface.",
    "A careful exterior clean, from the roof to the wheels. A considered reset for your everyday drive.",
    1200,
    60,
  ],
  [
    "ceramic-coating",
    "Ceramic Coating",
    "protection",
    "ceramic",
    "A little more protection. A lot more presence.",
    "Surface preparation and a protective finishing treatment. Application scope and material specifications are shown for each tier.",
    6500,
    180,
  ],
  [
    "interior-detail",
    "Interior Detail",
    "cleaning",
    "interior",
    "Feel good about the space you drive in.",
    "Thoughtful care for seats, carpets and interior surfaces, with materials selected for each surface.",
    2500,
    120,
  ],
  [
    "paint-correction",
    "Paint Correction",
    "correction",
    "paint",
    "Bring the depth back to your paint.",
    "A measured polishing process following surface inspection. Results depend on paint condition and the selected treatment.",
    4500,
    180,
  ],
  [
    "paint-protection",
    "Paint Protection Film",
    "protection",
    "ppf",
    "Care that goes beneath the surface.",
    "An appointment to inspect and apply selected protective film to approved panels. Coverage is agreed before work begins.",
    12000,
    240,
  ],
  [
    "wheel-care",
    "Wheel & Trim Care",
    "cleaning",
    "wheel",
    "The finishing touches make the difference.",
    "Detailed cleaning of wheels and exterior trim with a controlled finishing process.",
    900,
    45,
  ],
] as const;
export function createCatalogue(demo = true): Catalogue {
  const services: Service[] = serviceInfo.map(
    (
      [slug, name, category, image, description, details, rupees, minutes],
      index
    ) => ({
      id: `svc-${slug}`,
      slug,
      name,
      category,
      image,
      description,
      details,
      featured: index < 3,
      enabled: demo,
      tiers: tierCodes.map(
        (code, t): Tier => ({
          code,
          name: tierNames[t],
          enabled: true,
          description: [
            "Essential care, thoughtfully done.",
            "More preparation. A finer finish.",
            "Our most considered treatment.",
          ][t],
          minutes: minutes + t * 30,
          features: [
            ["Surface inspection", "Careful cleaning", "Finishing check"],
            [
              "Surface inspection",
              "Deep preparation",
              "Selected protective finish",
              "Finishing check",
            ],
            [
              "Detailed surface inspection",
              "Multi-stage preparation",
              "Selected protective finish",
              "Focused finishing care",
              "Aftercare guidance",
            ],
          ][t],
          productIds: [
            "prod-cleaner",
            ...(t > 0 ? ["prod-prep"] : []),
            ...(t > 1 ? ["prod-finish"] : []),
          ],
          prices: Object.fromEntries(
            ["standard", "premium", "luxury"].map((cls, c) => [
              cls,
              {
                one_time: demo
                  ? Math.round(rupees * (1 + t * 0.5) * (1 + c * 0.3)) * 100
                  : null,
                monthly: demo
                  ? Math.round(rupees * (1 + t * 0.5) * (1 + c * 0.3) * 3.6) *
                  100
                  : null,
                annual: demo
                  ? Math.round(rupees * (1 + t * 0.5) * (1 + c * 0.3) * 9.6) *
                  100
                  : null,
              },
            ])
          ) as Tier["prices"],
        })
      ),
    })
  );
  return {
    services,
    products: [
      {
        id: "prod-cleaner",
        name: "pH-neutral shampoo",
        brand: "Demo material",
        purpose: "Exterior cleaning",
        caution:
          "Illustrative material; owner must approve the actual product.",
      },
      {
        id: "prod-prep",
        name: "Surface preparation",
        brand: "Demo material",
        purpose: "Treatment preparation",
        caution: "Compatibility requires inspection.",
      },
      {
        id: "prod-finish",
        name: "Protective finish",
        brand: "Demo material",
        purpose: "Selected surface protection",
        caution: "No warranty or performance claim is made.",
      },
    ],
    vehicles: [
      {
        id: "veh-swift",
        make: "Maruti Suzuki",
        model: "Swift",
        body: "hatchback",
        pricingClass: "standard",
        reviewed: demo,
      },
      {
        id: "veh-baleno",
        make: "Maruti Suzuki",
        model: "Baleno",
        body: "hatchback",
        pricingClass: "standard",
        reviewed: demo,
      },
      {
        id: "veh-creta",
        make: "Hyundai",
        model: "Creta",
        body: "suv",
        pricingClass: "premium",
        reviewed: demo,
      },
      {
        id: "veh-i20",
        make: "Hyundai",
        model: "i20",
        body: "hatchback",
        pricingClass: "standard",
        reviewed: demo,
      },
      {
        id: "veh-city",
        make: "Honda",
        model: "City",
        body: "sedan",
        pricingClass: "premium",
        reviewed: demo,
      },
      {
        id: "veh-nexon",
        make: "Tata",
        model: "Nexon",
        body: "suv",
        pricingClass: "standard",
        reviewed: demo,
      },
      {
        id: "veh-xuv",
        make: "Mahindra",
        model: "XUV700",
        body: "suv",
        pricingClass: "premium",
        reviewed: demo,
      },
      {
        id: "veh-x3",
        make: "BMW",
        model: "X3",
        body: "suv",
        pricingClass: "luxury",
        reviewed: demo,
      },
      {
        id: "veh-cclass",
        make: "Mercedes-Benz",
        model: "C-Class",
        body: "sedan",
        pricingClass: "luxury",
        reviewed: demo,
      },
    ],
    plans: [
      {
        code: "one_time",
        name: "One time",
        description: "Great care, whenever you need it.",
        visits: 1,
        validityDays: null,
        enabled: true,
        restoreOnCancel: true,
      },
      {
        code: "monthly",
        name: "Monthly care",
        description: "A fresh finish throughout the month.",
        visits: 4,
        validityDays: 30,
        enabled: demo,
        restoreOnCancel: true,
      },
      {
        code: "annual",
        name: "Year-round care",
        description: "Make looking after your car a habit.",
        visits: 12,
        validityDays: 365,
        enabled: demo,
        restoreOnCancel: true,
      },
    ],
    site: {
      name: "Balaji Studio",
      tagline: "Precision car care",
      heroTitle: "MAKE EVERY\nDRIVE SHINE.",
      heroSubtitle:
        "Thoughtful detailing. Considered protection.\nExceptional care for the car you love.",
      email: "balajistudio@doorstepdetailer.in",
      phone: "+91 91230 66336",
      address:
        "Balaji Studio, Kumra Kashipur, Plot 92.1, Gourbanga Rd, Habra-I, 743271, WB, IN",
      mapUrl: "https://www.google.com/maps?q=22.815620,88.698029",
      theme: "crystalline-midnight",
      accent: "cyan",
      intro: true,
      motion: "normal",
      gallery: true,
      faq: [
        {
          question: "How do I choose the right treatment?",
          answer:
            "Choose your car and compare the treatment tiers. Each option shows its process, materials and expected duration. If your model is not listed, contact the studio for an inspection and quote.",
        },
        {
          question: "Can I pay at the studio?",
          answer:
            "Yes. Pay-at-studio appointments show the amount due before you confirm. Prepaid packs activate only after staff records your payment.",
        },
        {
          question: "Do care packages renew automatically?",
          answer:
            "No. Monthly and annual care are prepaid visit packs with a stated expiry. Each future visit needs its own appointment.",
        },
        {
          question: "Can I reschedule my appointment?",
          answer:
            "You can manage your appointments after verifying your email. Changes depend on available capacity and the policy shown with your booking.",
        },
      ],
    },
    schedule: {
      timezone: "Asia/Kolkata",
      opens: 9,
      closes: 19,
      closedWeekdays: [0],
      closures: [],
      bays: 3,
      bufferMinutes: 15,
      leadMinutes: 60,
      horizonDays: 60,
      cancelCutoffHours: 12,
    },
    taxMode: "inclusive",
    taxBps: 0,
    bookingEnabled: demo,
  };
}
export function createState(demo = true): State {
  const catalogue = createCatalogue(demo);
  const revisionId = randomUUID();
  return {
    schemaVersion: 1,
    draftVersion: 0,
    draft: structuredClone(catalogue),
    revisions: demo
      ? [
        {
          id: revisionId,
          number: 1,
          at: new Date().toISOString(),
          author: "Demo studio",
          catalogue,
        },
      ]
      : [],
    activeRevisionId: demo ? revisionId : null,
    draftBaseRevisionId: demo ? revisionId : null,
    quotes: [],
    bookings: [],
    packages: [],
    ledger: [],
    audit: [],
    sessions: [],
    challenges: [],
    outbox: [],
    staff: [
      {
        id: "staff-owner",
        name: "Studio owner",
        email: "owner@example.com",
        role: "owner",
        active: true,
        userId: process.env.OWNER_AUTH_USER_ID ?? null,
      },
      ...(demo
        ? [
          {
            id: "staff-arjun",
            name: "Arjun Mehta",
            email: "arjun@example.com",
            role: "staff" as const,
            active: true,
            userId: null,
          },
          {
            id: "staff-neha",
            name: "Neha Kapoor",
            email: "neha@example.com",
            role: "staff" as const,
            active: true,
            userId: null,
          },
        ]
        : []),
    ],
  };
}
