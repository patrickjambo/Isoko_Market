/**
 * Single source of truth for seeded reference data, shared by the dev seed
 * (prisma/seed.ts) and the production-safe seed (prisma/seed-prod.ts) so the two
 * can never drift.
 */
type SeedCategory = {
  slug: string;
  nameEn: string;
  nameRw: string;
  nameFr: string;
  icon: string;
  kind: 'PRODUCT' | 'SERVICE';
};

export const CATEGORIES: SeedCategory[] = [
  // ── Products (things for sale) ──
  { slug: 'phones', nameEn: 'Phones & Tablets', nameRw: 'Telefoni & Tablet', nameFr: 'Téléphones & tablettes', icon: 'Smartphone', kind: 'PRODUCT' },
  { slug: 'electronics', nameEn: 'Electronics', nameRw: 'Ibikoresho by’amashanyarazi', nameFr: 'Électronique', icon: 'Cpu', kind: 'PRODUCT' },
  { slug: 'fashion', nameEn: 'Fashion', nameRw: 'Imyambaro', nameFr: 'Mode', icon: 'Shirt', kind: 'PRODUCT' },
  { slug: 'home', nameEn: 'Home & Furniture', nameRw: 'Iby’urugo & Ibikoresho', nameFr: 'Maison & meubles', icon: 'Sofa', kind: 'PRODUCT' },
  { slug: 'vehicles', nameEn: 'Vehicles', nameRw: 'Ibinyabiziga', nameFr: 'Véhicules', icon: 'Car', kind: 'PRODUCT' },
  { slug: 'agriculture', nameEn: 'Agriculture', nameRw: 'Ubuhinzi', nameFr: 'Agriculture', icon: 'Sprout', kind: 'PRODUCT' },
  { slug: 'food', nameEn: 'Food', nameRw: 'Ibiribwa', nameFr: 'Alimentation', icon: 'Apple', kind: 'PRODUCT' },

  // ── Services (skills / labour offered) ──
  { slug: 'services', nameEn: 'General services', nameRw: 'Serivisi rusange', nameFr: 'Services généraux', icon: 'Wrench', kind: 'SERVICE' },
  { slug: 'cleaning', nameEn: 'Cleaning', nameRw: 'Isuku', nameFr: 'Nettoyage', icon: 'Sparkles', kind: 'SERVICE' },
  { slug: 'repairs', nameEn: 'Repairs & Technicians', nameRw: 'Gukora & Abateknisiye', nameFr: 'Réparations & techniciens', icon: 'Wrench', kind: 'SERVICE' },
  { slug: 'construction', nameEn: 'Construction & Masonry', nameRw: 'Ubwubatsi', nameFr: 'Construction & maçonnerie', icon: 'HardHat', kind: 'SERVICE' },
  { slug: 'beauty', nameEn: 'Beauty & Hair', nameRw: 'Ubwiza & Umusatsi', nameFr: 'Beauté & coiffure', icon: 'Scissors', kind: 'SERVICE' },
  { slug: 'tailoring', nameEn: 'Tailoring', nameRw: 'Ubudozi', nameFr: 'Couture', icon: 'Shirt', kind: 'SERVICE' },
  { slug: 'tutoring', nameEn: 'Tutoring & Lessons', nameRw: 'Kwigisha', nameFr: 'Cours & soutien', icon: 'GraduationCap', kind: 'SERVICE' },
  { slug: 'transport', nameEn: 'Transport & Moving', nameRw: 'Gutwara & Kwimura', nameFr: 'Transport & déménagement', icon: 'Truck', kind: 'SERVICE' },
  { slug: 'events', nameEn: 'Events & Catering', nameRw: 'Ibirori & Ibiribwa', nameFr: 'Événements & traiteur', icon: 'PartyPopper', kind: 'SERVICE' },
  { slug: 'photography', nameEn: 'Photography & Video', nameRw: 'Amafoto & Videwo', nameFr: 'Photo & vidéo', icon: 'Camera', kind: 'SERVICE' },
];
