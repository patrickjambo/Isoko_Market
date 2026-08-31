/**
 * Single source of truth for seeded reference data, shared by the dev seed
 * (prisma/seed.ts) and the production-safe seed (prisma/seed-prod.ts) so the two
 * can never drift.
 */
export const CATEGORIES = [
  { slug: 'phones', nameEn: 'Phones & Tablets', nameRw: 'Telefoni & Tablet', nameFr: 'Téléphones & tablettes', icon: 'Smartphone' },
  { slug: 'electronics', nameEn: 'Electronics', nameRw: 'Ibikoresho by’amashanyarazi', nameFr: 'Électronique', icon: 'Cpu' },
  { slug: 'fashion', nameEn: 'Fashion', nameRw: 'Imyambaro', nameFr: 'Mode', icon: 'Shirt' },
  { slug: 'home', nameEn: 'Home & Furniture', nameRw: 'Iby’urugo & Ibikoresho', nameFr: 'Maison & meubles', icon: 'Sofa' },
  { slug: 'vehicles', nameEn: 'Vehicles', nameRw: 'Ibinyabiziga', nameFr: 'Véhicules', icon: 'Car' },
  { slug: 'agriculture', nameEn: 'Agriculture', nameRw: 'Ubuhinzi', nameFr: 'Agriculture', icon: 'Sprout' },
  { slug: 'services', nameEn: 'Services', nameRw: 'Serivisi', nameFr: 'Services', icon: 'Wrench' },
  { slug: 'food', nameEn: 'Food', nameRw: 'Ibiribwa', nameFr: 'Alimentation', icon: 'Apple' },
];
