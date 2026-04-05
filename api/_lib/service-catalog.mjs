const DEFAULT_CONTACT_EMAIL = "info@eugenemierak.com";

export const SERVICE_CATALOG = {
  "elite-coaching": {
    slug: "elite-coaching",
    name: "Private Elite Coaching",
    publicPriceRange: "EUR 1.5k - 5k / mo",
    action: "stripe",
    checkoutMode: "payment",
    priceEnv: "STRIPE_PRICE_ELITE_COACHING",
    checkoutCta: "Begin Secure Checkout",
    fallbackCta: "Request Consultation",
  },
  "leadership-development": {
    slug: "leadership-development",
    name: "Leadership Development",
    publicPriceRange: "EUR 10k - 50k / program",
    action: "quote",
    fallbackCta: "Request Proposal",
  },
  "obsidian-retreats": {
    slug: "obsidian-retreats",
    name: "Obsidian Retreats",
    publicPriceRange: "EUR 2.5k - 10k / person",
    action: "stripe",
    checkoutMode: "payment",
    priceEnv: "STRIPE_PRICE_OBSIDIAN_RETREATS",
    checkoutCta: "Reserve With Stripe",
    fallbackCta: "Request Retreat Details",
  },
  workshops: {
    slug: "workshops",
    name: "High-Performance Workshops",
    publicPriceRange: "EUR 3k - 15k / day",
    action: "quote",
    fallbackCta: "Request Workshop Quote",
  },
  certification: {
    slug: "certification",
    name: "Certification Program",
    publicPriceRange: "EUR 3k - 8k / cert",
    action: "stripe",
    checkoutMode: "payment",
    priceEnv: "STRIPE_PRICE_CERTIFICATION",
    checkoutCta: "Enroll With Stripe",
    fallbackCta: "Request Enrollment Call",
  },
};

export function getContactEmail() {
  return process.env.SITE_CONTACT_EMAIL || DEFAULT_CONTACT_EMAIL;
}

export function getService(slug) {
  return SERVICE_CATALOG[slug] || null;
}

export function getServicePriceId(service) {
  if (!service?.priceEnv) {
    return "";
  }

  return process.env[service.priceEnv] || "";
}

export function isServiceCheckoutEnabled(service) {
  return service?.action === "stripe" && Boolean(getServicePriceId(service));
}

export function buildContactMailto(service) {
  const subject = `Frequency Vibes | ${service.name}`;
  const body = [
    "Hi Frequency Vibes team,",
    "",
    `I'm interested in ${service.name}.`,
    `Please send me the next step for the ${service.publicPriceRange} offer.`,
  ].join("\n");

  return `mailto:${getContactEmail()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function getPublicServiceCatalog() {
  return Object.values(SERVICE_CATALOG).map((service) => ({
    slug: service.slug,
    name: service.name,
    action: service.action,
    checkoutMode: service.checkoutMode || null,
    checkoutEnabled: isServiceCheckoutEnabled(service),
    publicPriceRange: service.publicPriceRange,
    checkoutCta: service.checkoutCta || null,
    fallbackCta: service.fallbackCta || "Request Consultation",
    contactUrl: buildContactMailto(service),
  }));
}
