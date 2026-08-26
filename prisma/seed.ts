/**
 * Isoko Market seed — realistic demo data for local development and QA
 * (Section 14: "seed scripts available for local/staging demo data").
 *
 * Money is stored in RWF minor units (× 100). Demo accounts log in with the
 * phone-OTP flow; in dev the OTP is printed to the server console.
 */
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const rwf = (francs: number) => francs * 100;
const img = (seed: string) => `https://picsum.photos/seed/${seed}/800/800`;

const CATEGORIES = [
  { slug: 'phones', nameEn: 'Phones & Tablets', nameRw: 'Telefoni & Tablet', nameFr: 'Téléphones & tablettes', icon: 'Smartphone' },
  { slug: 'electronics', nameEn: 'Electronics', nameRw: 'Ibikoresho by’amashanyarazi', nameFr: 'Électronique', icon: 'Cpu' },
  { slug: 'fashion', nameEn: 'Fashion', nameRw: 'Imyambaro', nameFr: 'Mode', icon: 'Shirt' },
  { slug: 'home', nameEn: 'Home & Furniture', nameRw: 'Iby’urugo & Ibikoresho', nameFr: 'Maison & meubles', icon: 'Sofa' },
  { slug: 'vehicles', nameEn: 'Vehicles', nameRw: 'Ibinyabiziga', nameFr: 'Véhicules', icon: 'Car' },
  { slug: 'agriculture', nameEn: 'Agriculture', nameRw: 'Ubuhinzi', nameFr: 'Agriculture', icon: 'Sprout' },
  { slug: 'services', nameEn: 'Services', nameRw: 'Serivisi', nameFr: 'Services', icon: 'Wrench' },
  { slug: 'food', nameEn: 'Food', nameRw: 'Ibiribwa', nameFr: 'Alimentation', icon: 'Apple' },
];

async function main() {
  console.log('🌱  Seeding Isoko Market…');

  // Clean slate (dev only).
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.conversationParticipant.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.application.deleteMany(),
    prisma.cV.deleteMany(),
    prisma.listingImage.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.job.deleteMany(),
    prisma.review.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.report.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.verificationRequest.deleteMany(),
    prisma.partner.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.listingDraft.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.userPermissionOverride.deleteMany(),
    prisma.localeString.deleteMany(),
    prisma.otpCode.deleteMany(),
    prisma.category.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const categories = await Promise.all(
    CATEGORIES.map((c) => prisma.category.create({ data: c }))
  );
  const cat = (slug: string) => categories.find((c) => c.slug === slug)!.id;

  // ── Users ──────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      phone: '+250788000000',
      fullName: 'Isoko Admin',
      role: 'ADMIN',
      adminRole: 'SUPER_ADMIN',
      isVerified: true,
      verificationStatus: 'VERIFIED',
      location: 'Kigali',
      locale: 'en',
      referralCode: 'ISOKOADMIN',
      lastActiveAt: new Date(),
    },
  });

  // A moderator staff account (limited permissions) for the Roles panel demo.
  await prisma.user.create({
    data: {
      phone: '+250788777777',
      fullName: 'Moderator Staff',
      role: 'ADMIN',
      adminRole: 'MODERATOR',
      isVerified: true,
      verificationStatus: 'VERIFIED',
      location: 'Kigali',
      locale: 'en',
      lastActiveAt: new Date(),
    },
  });

  const aline = await prisma.user.create({
    data: {
      phone: '+250788111111',
      fullName: 'Aline Uwase',
      role: 'SELLER',
      isVerified: true,
      verificationStatus: 'VERIFIED',
      location: 'Kigali, Nyarugenge',
      bio: 'Selling quality electronics and phones. Fast delivery in Kigali.',
      locale: 'rw',
      referralCode: 'ALINE01',
      lastActiveAt: new Date(),
      walletBalance: rwf(5000),
    },
  });

  const eric = await prisma.user.create({
    data: {
      phone: '+250788222222',
      fullName: 'Eric Habimana',
      role: 'SELLER',
      isVerified: false,
      verificationStatus: 'PENDING',
      location: 'Musanze',
      bio: 'Home & furniture deals from the North.',
      locale: 'rw',
      referralCode: 'ERIC02',
      lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  const claudine = await prisma.user.create({
    data: {
      phone: '+250788333333',
      fullName: 'Claudine Mukamana',
      role: 'EMPLOYER',
      isVerified: true,
      verificationStatus: 'VERIFIED',
      location: 'Kigali, Kicukiro',
      bio: 'Recruiting for a growing retail cooperative.',
      locale: 'fr',
      referralCode: 'CLAUD03',
      lastActiveAt: new Date(),
    },
  });

  const jean = await prisma.user.create({
    data: {
      phone: '+250788444444',
      fullName: 'Jean-Paul Niyonzima',
      role: 'BUYER',
      isVerified: false,
      verificationStatus: 'UNVERIFIED',
      location: 'Huye',
      locale: 'en',
      referralCode: 'JEAN04',
      referredById: aline.id, // Jean joined via Aline's invite (Phase 5 referral)
      lastActiveAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  // Eric has a pending verification request (populates the admin queue).
  await prisma.verificationRequest.create({
    data: { userId: eric.id, idDocumentUrl: '/uploads/private/demo-id.jpg', status: 'PENDING' },
  });

  // ── Listings ───────────────────────────────────────────
  const listingsData: (Prisma.ListingCreateInput & { _images: string[] })[] = [
    {
      title: 'Samsung Galaxy A14 — like new',
      description: 'Barely used, 128GB, dual SIM. Comes with charger and case. No scratches.',
      price: rwf(145000),
      condition: 'LIKE_NEW',
      location: 'Kigali, Nyarugenge',
      isFeatured: true,
      tags: ['128GB', 'dual SIM', 'with charger'],
      seller: { connect: { id: aline.id } },
      category: { connect: { id: cat('phones') } },
      _images: [img('galaxy1'), img('galaxy2')],
    },
    {
      title: 'HP laptop 8GB RAM, SSD',
      description: 'Core i5, 256GB SSD, great for students and small business. Battery holds well.',
      price: rwf(320000),
      condition: 'GOOD',
      location: 'Kigali, Nyarugenge',
      isFeatured: true,
      seller: { connect: { id: aline.id } },
      category: { connect: { id: cat('electronics') } },
      _images: [img('laptop1')],
    },
    {
      title: 'Wooden dining table + 4 chairs',
      description: 'Solid mahogany, seats four. Minor wear on one chair. Pick up in Musanze.',
      price: rwf(85000),
      condition: 'GOOD',
      location: 'Musanze',
      seller: { connect: { id: eric.id } },
      category: { connect: { id: cat('home') } },
      _images: [img('table1'), img('table2')],
    },
    {
      title: 'Fresh Irish potatoes — 50kg bag',
      description: 'Farm-fresh from Musanze. Wholesale price. Delivery available in the North.',
      price: rwf(22000),
      condition: 'NEW',
      location: 'Musanze',
      seller: { connect: { id: eric.id } },
      category: { connect: { id: cat('agriculture') } },
      _images: [img('potato1')],
    },
    {
      title: 'Ladies handbag — genuine leather',
      description: 'Brand new, brown leather, spacious. Perfect gift.',
      price: rwf(28000),
      condition: 'NEW',
      location: 'Kigali, Kicukiro',
      seller: { connect: { id: aline.id } },
      category: { connect: { id: cat('fashion') } },
      _images: [img('bag1')],
    },
    {
      title: 'Phone repair service — screens & batteries',
      description: 'Same-day screen and battery replacement. 3-month warranty. Kigali city center.',
      price: rwf(15000),
      condition: 'NEW',
      location: 'Kigali, Nyarugenge',
      seller: { connect: { id: aline.id } },
      category: { connect: { id: cat('services') } },
      _images: [img('repair1')],
    },
  ];

  const listings = [];
  for (const { _images, ...data } of listingsData) {
    const listing = await prisma.listing.create({
      data: {
        ...data,
        images: { create: _images.map((url, position) => ({ url, position })) },
      },
    });
    listings.push(listing);
  }

  // ── Jobs ───────────────────────────────────────────────
  const shopJob = await prisma.job.create({
    data: {
      employerId: claudine.id,
      title: 'Shop assistant (part-time)',
      description:
        'We need a friendly, reliable shop assistant for our Kicukiro store. Duties: serving customers, stock, cash handling. Weekends required.',
      type: 'JOB',
      payMin: rwf(80000),
      payMax: rwf(120000),
      payPeriod: 'month',
      location: 'Kigali, Kicukiro',
    },
  });

  await prisma.job.create({
    data: {
      employerId: claudine.id,
      title: 'Delivery rider (gig)',
      description: 'Deliver packages across Kigali using your own motorcycle. Paid per delivery.',
      type: 'GIG',
      payMin: rwf(2000),
      payMax: rwf(3500),
      payPeriod: 'day',
      location: 'Kigali',
    },
  });

  await prisma.job.create({
    data: {
      employerId: aline.id,
      title: 'Social media helper',
      description: 'Help post products and reply to customers on WhatsApp and Instagram. Flexible hours.',
      type: 'GIG',
      payMin: rwf(50000),
      payPeriod: 'month',
      location: 'Remote / Kigali',
    },
  });

  // ── CV + application ───────────────────────────────────
  const jeanCv = await prisma.cV.create({
    data: {
      userId: jean.id,
      structuredData: {
        headline: 'Motivated retail assistant',
        summary: 'Hard-working and reliable, seeking part-time retail work in Kigali.',
        education: [
          { school: 'University of Rwanda', qualification: 'Diploma in Business', startYear: '2021', endYear: '2023' },
        ],
        experience: [
          { company: 'Local shop, Huye', position: 'Sales assistant', startYear: '2022', endYear: '2023', summary: 'Served customers and handled cash.' },
        ],
        skills: ['Customer service', 'Cash handling', 'Teamwork'],
        languages: ['Kinyarwanda', 'English', 'French'],
      } as Prisma.InputJsonValue,
    },
  });

  await prisma.application.create({
    data: {
      jobId: shopJob.id,
      applicantId: jean.id,
      cvId: jeanCv.id,
      coverNote: 'I am available on weekends and eager to learn.',
      status: 'SHORTLISTED',
    },
  });

  // ── Conversation + messages ────────────────────────────
  const convo = await prisma.conversation.create({
    data: {
      listingId: listings[0]!.id,
      participants: { create: [{ userId: jean.id }, { userId: aline.id }] },
      lastMessageAt: new Date(),
    },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: convo.id, senderId: jean.id, body: 'Hello, is the Galaxy A14 still available?' },
      { conversationId: convo.id, senderId: aline.id, body: 'Yes it is! Would you like to see it today?' },
      { conversationId: convo.id, senderId: jean.id, body: 'Great, can you do 135,000?' },
    ],
  });

  // ── Reviews, transactions, notifications, a report ─────
  await prisma.review.create({
    data: { reviewerId: jean.id, revieweeId: aline.id, rating: 5, comment: 'Trustworthy seller, fast response!' },
  });
  await prisma.review.create({
    data: { reviewerId: claudine.id, revieweeId: aline.id, rating: 4, comment: 'Good communication.' },
  });

  await prisma.transaction.create({
    data: { userId: aline.id, type: 'FEATURED_LISTING', amount: rwf(2000), provider: 'MOCK', status: 'SUCCESS' },
  });
  await prisma.transaction.create({
    data: { userId: aline.id, type: 'TOPUP', amount: rwf(5000), provider: 'MTN_MOMO', status: 'SUCCESS' },
  });

  await prisma.notification.create({
    data: {
      userId: aline.id,
      type: 'MESSAGE',
      title: 'Jean-Paul Niyonzima',
      body: 'Hello, is the Galaxy A14 still available?',
      href: `/messages/${convo.id}`,
    },
  });

  await prisma.report.create({
    data: {
      reportedById: jean.id,
      targetType: 'LISTING',
      targetId: listings[3]!.id,
      reason: 'Spam or scam',
      details: 'Price looks too good to be true.',
      status: 'OPEN',
    },
  });

  // Partner / MSME organizations (Section 6.7) with white-label boards (Phase 5).
  await prisma.partner.create({
    data: {
      name: 'Abadahigwa Cooperative',
      slug: 'abadahigwa',
      type: 'COOPERATIVE',
      status: 'ACTIVE',
      contactName: 'Marie Ingabire',
      phone: '+250788555555',
      location: 'Musanze',
      notes: 'Agricultural cooperative — bulk produce sellers.',
      tagline: 'Growing opportunities for Northern farmers',
      brandColor: '#15803D',
    },
  });

  const youthConnekt = await prisma.partner.create({
    data: {
      name: 'Youth Connekt NGO',
      slug: 'youth-connekt',
      type: 'NGO',
      status: 'ACTIVE',
      contactName: 'David Rukundo',
      phone: '+250788666666',
      location: 'Kigali',
      notes: 'Runs youth employment programs; posts jobs.',
      tagline: 'Connecting Rwandan youth to their first job',
      brandColor: '#F97316',
    },
  });

  await prisma.partner.create({
    data: {
      name: 'Kigali Retailers Ltd',
      slug: 'kigali-retailers',
      type: 'MSME',
      status: 'PROSPECT',
      contactName: 'Grace Uwimana',
      location: 'Kigali, Kicukiro',
    },
  });

  // Surface Claudine's roles on the Youth Connekt white-label board.
  await prisma.job.updateMany({
    where: { employerId: claudine.id },
    data: { partnerId: youthConnekt.id },
  });

  console.log('✅  Seed complete.');
  console.log('   Demo accounts (log in via phone OTP — code printed in the dev console):');
  console.log('   • Admin     +250788000000');
  console.log('   • Seller    +250788111111  (Aline, verified)');
  console.log('   • Seller    +250788222222  (Eric, pending verification)');
  console.log('   • Employer  +250788333333  (Claudine, verified)');
  console.log('   • Buyer     +250788444444  (Jean-Paul, unverified)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
