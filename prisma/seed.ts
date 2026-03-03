// prisma/seed.ts
// Run: npx prisma db seed

import { PrismaClient, ClothingType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...\n');

  // ============================================
  // ADMIN USER
  // ============================================
  console.log('👤 Seeding admin user...');

  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@cleanzo.app' },
    update: { password: hashedPassword, role: 'ADMIN', status: 'ACTIVE' },
    create: {
      phone_number: '+920000000000',
      name: 'Admin',
      email: 'admin@cleanzo.app',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('   ✅ Admin user seeded (admin@cleanzo.app / admin123)');

  // ============================================
  // CLOTHING CATEGORIES (4)
  // ============================================
  console.log('📁 Seeding clothing categories...');

  const clothingCategories = [
    { name: 'Men', name_urdu: 'مردانہ', icon: '👔', sort_order: 1 },
    { name: 'Women', name_urdu: 'زنانہ', icon: '👗', sort_order: 2 },
    { name: 'Kids', name_urdu: 'بچوں کے', icon: '👶', sort_order: 3 },
    { name: 'Household', name_urdu: 'گھریلو', icon: '🏠', sort_order: 4 },
  ];

  const categoryMap: Record<string, string> = {};
  for (const cat of clothingCategories) {
    const created = await prisma.clothingCategory.upsert({
      where: { name: cat.name },
      update: cat,
      create: cat,
    });
    categoryMap[cat.name] = created.id;
  }
  console.log(`   ✅ ${clothingCategories.length} clothing categories seeded`);

  // ============================================
  // SERVICE CATEGORIES (4)
  // ============================================
  console.log('📁 Seeding service categories...');

  // Rename legacy names to match app canonical names
  await prisma.serviceCategory.updateMany({ where: { name: 'Iron Only' }, data: { name: 'Ironing' } });
  await prisma.serviceCategory.updateMany({ where: { name: 'Dry Clean' }, data: { name: 'Dry Cleaning' } });

  const serviceCategories = [
    { name: 'Washing', name_urdu: 'دھلائی', icon: '🧺', description: 'Professional washing service', estimated_hours: 24, sort_order: 1 },
    { name: 'Ironing', name_urdu: 'استری', icon: '♨️', description: 'Professional ironing and pressing', estimated_hours: 12, sort_order: 2 },
    { name: 'Wash & Iron', name_urdu: 'دھلائی اور استری', icon: '👕', description: 'Complete wash and iron service', estimated_hours: 24, sort_order: 3 },
    { name: 'Dry Cleaning', name_urdu: 'ڈرائی کلیننگ', icon: '👔', description: 'Professional dry cleaning for delicate fabrics', estimated_hours: 72, sort_order: 4 },
  ];

  const serviceMap: Record<string, string> = {};
  for (const svc of serviceCategories) {
    const created = await prisma.serviceCategory.upsert({
      where: { name: svc.name },
      update: svc,
      create: svc,
    });
    serviceMap[svc.name] = created.id;
  }
  console.log(`   ✅ ${serviceCategories.length} service categories seeded`);

  // ============================================
  // CLOTHING ITEMS (37 total)
  // ============================================
  console.log('👔 Seeding clothing items...');

  // Item data with prices: [name, name_urdu, is_popular, wash_only_price, wash_iron_price, iron_only_price, dry_clean_price]
  // NULL prices mean service not available for that item

  const menItems: [string, string, boolean, number | null, number | null, number | null, number | null][] = [
    ['Shirt', 'قمیض', true, 50, 80, 30, 150],
    ['Shalwar Kameez', 'شلوار قمیض', true, 60, 100, 40, 200],
    ['Pants / Trousers', 'پینٹ', true, 60, 100, 40, 180],
    ['T-Shirt', 'ٹی شرٹ', true, 40, 70, 25, null],
    ['Suit (2pc)', 'سوٹ 2 پیس', true, 120, 200, 80, 400],
    ['Suit (3pc)', 'سوٹ 3 پیس', false, 170, 280, 100, 550],
    ['Sherwani', 'شیروانی', false, 210, 350, 150, 800],
    ['Kurta', 'کرتا', false, 50, 80, 30, 150],
    ['Waistcoat', 'واسکٹ', false, 70, 120, 50, 250],
    ['Jacket / Blazer', 'جیکٹ', false, 120, 200, 80, 400],
    ['Sweater', 'سویٹر', false, 90, 150, null, 300],
    ['Underwear', 'انڈرویئر', false, 20, 30, null, null],
  ];

  const womenItems: [string, string, boolean, number | null, number | null, number | null, number | null][] = [
    ['Shalwar Kameez (W)', 'شلوار قمیض', true, 70, 120, 50, 250],
    ['Dupatta', 'دوپٹہ', true, 30, 50, 20, 100],
    ['Suit 3pc (W)', 'سوٹ 3 پیس', true, 110, 180, 70, 350],
    ['Abaya / Burqa', 'عبایا / برقعہ', true, 90, 150, 60, 300],
    ['Lehnga', 'لہنگا', false, null, null, null, 1500],
    ['Bridal Dress', 'شادی کا جوڑا', false, null, null, null, 3000],
    ['Scarf / Shawl', 'شال / سکارف', false, 50, 80, 30, 150],
    ['Saree', 'ساڑی', false, 90, 150, 60, 350],
    ['Blouse / Top', 'بلاؤز', false, 50, 80, 30, 150],
    ['Trouser / Pajama', 'ٹراؤزر', false, 50, 80, 30, 150],
  ];

  const kidsItems: [string, string, boolean, number | null, number | null, number | null, number | null][] = [
    ['School Uniform', 'سکول یونیفارم', true, 50, 80, 30, null],
    ['Kids Shalwar Kameez', 'بچوں کا شلوار قمیض', true, 35, 60, 25, 120],
    ['Kids Shirt / Top', 'بچوں کی قمیض', false, 30, 50, 20, 100],
    ['Kids Pants', 'بچوں کی پینٹ', false, 30, 50, 20, 100],
    ['Kids Party Wear', 'بچوں کی پارٹی ڈریس', false, null, null, null, 250],
  ];

  const householdItems: [string, string, boolean, number | null, number | null, number | null, number | null][] = [
    ['Bedsheet (Single)', 'چادر سنگل', true, 70, 120, 50, null],
    ['Bedsheet (Double)', 'چادر ڈبل', true, 110, 180, 80, null],
    ['Pillow Cover', 'تکیے کا غلاف', true, 25, 40, 20, null],
    ['Razai (Single)', 'رضائی سنگل', true, 210, 350, null, 600],
    ['Razai (Double)', 'رضائی ڈبل', false, 300, 500, null, 800],
    ['Blanket', 'کمبل', false, 180, 300, null, 500],
    ['Curtain (Panel)', 'پردہ', true, 90, 150, 60, 250],
    ['Sofa Cover', 'صوفہ کور', false, 120, 200, null, 350],
    ['Towel', 'تولیہ', false, 35, 60, null, null],
    ['Table Cloth', 'میز پوش', false, 60, 100, 40, null],
  ];

  // Helper to create items and collect default prices
  interface DefaultPriceEntry {
    clothing_item_id: string;
    service_category_id: string;
    price: number;
  }

  const defaultPrices: DefaultPriceEntry[] = [];

  const createItems = async (
    items: [string, string, boolean, number | null, number | null, number | null, number | null][],
    categoryName: string,
    clothingType: ClothingType,
  ) => {
    const categoryId = categoryMap[categoryName];
    let sortOrder = 0;

    for (const [name, nameUrdu, isPopular, washOnly, washIron, ironOnly, dryClean] of items) {
      sortOrder++;
      const item = await prisma.clothingItem.upsert({
        where: { name_type: { name, type: clothingType } },
        update: {
          name_urdu: nameUrdu,
          is_popular: isPopular,
          clothing_category_id: categoryId,
          sort_order: sortOrder,
        },
        create: {
          name,
          name_urdu: nameUrdu,
          type: clothingType,
          clothing_category_id: categoryId,
          is_popular: isPopular,
          sort_order: sortOrder,
        },
      });

      // Collect default prices (only non-null)
      if (washOnly !== null) {
        defaultPrices.push({
          clothing_item_id: item.id,
          service_category_id: serviceMap['Washing'],
          price: washOnly,
        });
      }
      if (washIron !== null) {
        defaultPrices.push({
          clothing_item_id: item.id,
          service_category_id: serviceMap['Wash & Iron'],
          price: washIron,
        });
      }
      if (ironOnly !== null) {
        defaultPrices.push({
          clothing_item_id: item.id,
          service_category_id: serviceMap['Ironing'],
          price: ironOnly,
        });
      }
      if (dryClean !== null) {
        defaultPrices.push({
          clothing_item_id: item.id,
          service_category_id: serviceMap['Dry Cleaning'],
          price: dryClean,
        });
      }
    }
  };

  await createItems(menItems, 'Men', ClothingType.MEN);
  console.log(`   ✅ ${menItems.length} men's items seeded`);

  await createItems(womenItems, 'Women', ClothingType.WOMEN);
  console.log(`   ✅ ${womenItems.length} women's items seeded`);

  await createItems(kidsItems, 'Kids', ClothingType.KIDS);
  console.log(`   ✅ ${kidsItems.length} kids' items seeded`);

  await createItems(householdItems, 'Household', ClothingType.HOME);
  console.log(`   ✅ ${householdItems.length} household items seeded`);

  // ============================================
  // DEFAULT PRICES (~91 entries)
  // ============================================
  console.log('💰 Seeding default prices...');

  for (const dp of defaultPrices) {
    await prisma.defaultPrice.upsert({
      where: {
        clothing_item_id_service_category_id: {
          clothing_item_id: dp.clothing_item_id,
          service_category_id: dp.service_category_id,
        },
      },
      update: { price: dp.price },
      create: dp,
    });
  }
  console.log(`   ✅ ${defaultPrices.length} default prices seeded`);

  // ============================================
  // APP SETTINGS
  // ============================================
  console.log('⚙️  Seeding app settings...');

  const settings = [
    { key: 'delivery_fee', value: { amount: 100, min_free_order: 1000 } },
    { key: 'express_fee_percentage', value: { percentage: 50 } },
    { key: 'time_slots', value: { slots: ['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00', '19:00-21:00'] } },
    { key: 'cancellation_policy', value: { free_before: ['PENDING', 'ACCEPTED', 'PICKUP_SCHEDULED', 'PICKED_UP'], blocked_after: ['PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'] } },
    { key: 'order_number_prefix', value: { prefix: 'ORD' } },
    { key: 'search_radius_km', value: { default: 5, max: 20 } },
  ];

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }
  console.log(`   ✅ ${settings.length} app settings seeded`);

  // ============================================
  // PROMO CODES
  // ============================================
  console.log('🎟️  Seeding promo codes...');

  const promoCodes = [
    {
      code: 'WELCOME50',
      discount_type: 'PERCENTAGE',
      discount_value: 50,
      max_discount: 200,
      min_order_amount: 300,
      valid_until: new Date('2026-12-31'),
      first_order_only: true,
      title: 'Welcome Offer',
      subtitle: 'Get 50% off on your first order! Max discount PKR 200',
      banner_color: 'orange',
    },
    {
      code: 'FIRST100',
      discount_type: 'FIXED',
      discount_value: 100,
      min_order_amount: 500,
      valid_until: new Date('2026-12-31'),
      first_order_only: true,
      title: 'First Order Bonus',
      subtitle: 'Flat PKR 100 off on your first laundry order',
      banner_color: 'blue',
    },
    {
      code: 'FLAT20',
      discount_type: 'PERCENTAGE',
      discount_value: 20,
      max_discount: 150,
      min_order_amount: 200,
      valid_until: new Date('2026-12-31'),
      first_order_only: false,
      title: 'Flat 20% Off',
      subtitle: 'Use anytime! 20% discount up to PKR 150',
      banner_color: 'green',
    },
  ];

  for (const promo of promoCodes) {
    await prisma.promoCode.upsert({
      where: { code: promo.code },
      update: promo,
      create: promo,
    });
  }
  console.log(`   ✅ ${promoCodes.length} promo codes seeded`);

  // ============================================
  // SUMMARY
  // ============================================
  const totalItems = menItems.length + womenItems.length + kidsItems.length + householdItems.length;
  const popularCount = [...menItems, ...womenItems, ...kidsItems, ...householdItems].filter(i => i[2]).length;

  console.log('\n========================================');
  console.log('🎉 SEED COMPLETED SUCCESSFULLY!');
  console.log('========================================');
  console.log(`📁 Clothing Categories: ${clothingCategories.length}`);
  console.log(`📁 Service Categories: ${serviceCategories.length}`);
  console.log(`👔 Total Clothing Items: ${totalItems}`);
  console.log(`   - Men: ${menItems.length}`);
  console.log(`   - Women: ${womenItems.length}`);
  console.log(`   - Kids: ${kidsItems.length}`);
  console.log(`   - Household: ${householdItems.length}`);
  console.log(`⭐ Popular Items: ${popularCount}`);
  console.log(`💰 Default Prices: ${defaultPrices.length}`);
  console.log(`⚙️  App Settings: ${settings.length}`);
  console.log(`🎟️  Promo Codes: ${promoCodes.length}`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
