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
    where: { email: 'admin@elaundry.pk' },
    update: { password: hashedPassword, role: 'ADMIN', status: 'ACTIVE' },
    create: {
      phone_number: '+920000000000',
      name: 'Admin',
      email: 'admin@elaundry.pk',
      password: hashedPassword,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('   ✅ Admin user seeded (admin@elaundry.pk / admin123)');

  // ============================================
  // SERVICE CATEGORIES
  // ============================================
  console.log('📁 Seeding service categories...');
  
  const categories = [
    { name: 'Washing', name_urdu: 'دھلائی', icon: 'washing-machine', description: 'Complete wash and clean service', sort_order: 1 },
    { name: 'Ironing', name_urdu: 'استری', icon: 'iron', description: 'Professional ironing and pressing', sort_order: 2 },
    { name: 'Wash & Iron', name_urdu: 'دھلائی اور استری', icon: 'wash-iron', description: 'Complete wash and iron service', sort_order: 3 },
    { name: 'Dry Cleaning', name_urdu: 'ڈرائی کلیننگ', icon: 'dry-clean', description: 'Professional dry cleaning for delicate fabrics', sort_order: 4 },
    { name: 'Stain Removal', name_urdu: 'داغ صفائی', icon: 'stain', description: 'Specialized stain removal treatment', sort_order: 5 },
    { name: 'Shoe Cleaning', name_urdu: 'جوتے کی صفائی', icon: 'shoe', description: 'Professional shoe cleaning and polishing', sort_order: 6 },
    { name: 'Carpet Cleaning', name_urdu: 'قالین کی صفائی', icon: 'carpet', description: 'Deep carpet and rug cleaning', sort_order: 7 },
    { name: 'Curtain Cleaning', name_urdu: 'پردے کی صفائی', icon: 'curtain', description: 'Curtain wash and cleaning', sort_order: 8 },
  ];

  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { name: category.name },
      update: category,
      create: category,
    });
  }
  console.log(`   ✅ ${categories.length} service categories seeded`);

  // ============================================
  // CLOTHING ITEMS - MEN
  // ============================================
  console.log('👔 Seeding men\'s clothing items...');
  
  const menItems = [
    { name: 'Shirt', name_urdu: 'شرٹ', sort_order: 1 },
    { name: 'T-Shirt', name_urdu: 'ٹی شرٹ', sort_order: 2 },
    { name: 'Pants/Trousers', name_urdu: 'پینٹ', sort_order: 3 },
    { name: 'Jeans', name_urdu: 'جینز', sort_order: 4 },
    { name: 'Shorts', name_urdu: 'شارٹس', sort_order: 5 },
    { name: 'Suit (2 Piece)', name_urdu: 'سوٹ (2 پیس)', sort_order: 6 },
    { name: 'Suit (3 Piece)', name_urdu: 'سوٹ (3 پیس)', sort_order: 7 },
    { name: 'Blazer/Coat', name_urdu: 'بلیزر/کوٹ', sort_order: 8 },
    { name: 'Jacket', name_urdu: 'جیکٹ', sort_order: 9 },
    { name: 'Sweater', name_urdu: 'سویٹر', sort_order: 10 },
    { name: 'Hoodie', name_urdu: 'ہوڈی', sort_order: 11 },
    { name: 'Shalwar Kameez', name_urdu: 'شلوار قمیض', sort_order: 12 },
    { name: 'Kurta', name_urdu: 'کرتا', sort_order: 13 },
    { name: 'Waistcoat', name_urdu: 'واسکٹ', sort_order: 14 },
    { name: 'Sherwani', name_urdu: 'شیروانی', sort_order: 15 },
    { name: 'Underwear', name_urdu: 'انڈرویئر', sort_order: 16 },
    { name: 'Socks (Pair)', name_urdu: 'موزے', sort_order: 17 },
    { name: 'Tie', name_urdu: 'ٹائی', sort_order: 18 },
    { name: 'Cap/Hat', name_urdu: 'ٹوپی', sort_order: 19 },
  ];

  for (const item of menItems) {
    await prisma.clothingItem.upsert({
      where: { name_type: { name: item.name, type: ClothingType.MEN } },
      update: { ...item, type: ClothingType.MEN },
      create: { ...item, type: ClothingType.MEN },
    });
  }
  console.log(`   ✅ ${menItems.length} men's items seeded`);

  // ============================================
  // CLOTHING ITEMS - WOMEN
  // ============================================
  console.log('👗 Seeding women\'s clothing items...');
  
  const womenItems = [
    { name: 'Shirt/Top', name_urdu: 'شرٹ/ٹاپ', sort_order: 1 },
    { name: 'T-Shirt', name_urdu: 'ٹی شرٹ', sort_order: 2 },
    { name: 'Blouse', name_urdu: 'بلاؤز', sort_order: 3 },
    { name: 'Pants/Trousers', name_urdu: 'پینٹ', sort_order: 4 },
    { name: 'Jeans', name_urdu: 'جینز', sort_order: 5 },
    { name: 'Skirt', name_urdu: 'سکرٹ', sort_order: 6 },
    { name: 'Dress', name_urdu: 'ڈریس', sort_order: 7 },
    { name: 'Maxi', name_urdu: 'میکسی', sort_order: 8 },
    { name: 'Shalwar Kameez', name_urdu: 'شلوار قمیض', sort_order: 9 },
    { name: 'Suit (2 Piece)', name_urdu: 'سوٹ (2 پیس)', sort_order: 10 },
    { name: 'Suit (3 Piece)', name_urdu: 'سوٹ (3 پیس)', sort_order: 11 },
    { name: 'Kurta', name_urdu: 'کرتا', sort_order: 12 },
    { name: 'Dupatta', name_urdu: 'دوپٹہ', sort_order: 13 },
    { name: 'Shawl', name_urdu: 'شال', sort_order: 14 },
    { name: 'Saree', name_urdu: 'ساڑی', sort_order: 15 },
    { name: 'Lehenga', name_urdu: 'لہنگا', sort_order: 16 },
    { name: 'Abaya', name_urdu: 'عبایا', sort_order: 17 },
    { name: 'Hijab/Scarf', name_urdu: 'حجاب/سکارف', sort_order: 18 },
    { name: 'Jacket', name_urdu: 'جیکٹ', sort_order: 19 },
    { name: 'Sweater/Cardigan', name_urdu: 'سویٹر', sort_order: 20 },
    { name: 'Coat', name_urdu: 'کوٹ', sort_order: 21 },
    { name: 'Bridal Dress', name_urdu: 'دلہن کا لباس', sort_order: 22 },
    { name: 'Party Wear', name_urdu: 'پارٹی ویئر', sort_order: 23 },
  ];

  for (const item of womenItems) {
    await prisma.clothingItem.upsert({
      where: { name_type: { name: item.name, type: ClothingType.WOMEN } },
      update: { ...item, type: ClothingType.WOMEN },
      create: { ...item, type: ClothingType.WOMEN },
    });
  }
  console.log(`   ✅ ${womenItems.length} women's items seeded`);

  // ============================================
  // CLOTHING ITEMS - KIDS
  // ============================================
  console.log('👶 Seeding kids\' clothing items...');
  
  const kidsItems = [
    { name: 'Shirt', name_urdu: 'شرٹ', sort_order: 1 },
    { name: 'T-Shirt', name_urdu: 'ٹی شرٹ', sort_order: 2 },
    { name: 'Pants/Trousers', name_urdu: 'پینٹ', sort_order: 3 },
    { name: 'Jeans', name_urdu: 'جینز', sort_order: 4 },
    { name: 'Shorts', name_urdu: 'شارٹس', sort_order: 5 },
    { name: 'Dress', name_urdu: 'ڈریس', sort_order: 6 },
    { name: 'Frock', name_urdu: 'فراک', sort_order: 7 },
    { name: 'Shalwar Kameez', name_urdu: 'شلوار قمیض', sort_order: 8 },
    { name: 'School Uniform', name_urdu: 'سکول یونیفارم', sort_order: 9 },
    { name: 'Jacket', name_urdu: 'جیکٹ', sort_order: 10 },
    { name: 'Sweater', name_urdu: 'سویٹر', sort_order: 11 },
    { name: 'Hoodie', name_urdu: 'ہوڈی', sort_order: 12 },
    { name: 'Baby Suit', name_urdu: 'بیبی سوٹ', sort_order: 13 },
    { name: 'Romper', name_urdu: 'رومپر', sort_order: 14 },
  ];

  for (const item of kidsItems) {
    await prisma.clothingItem.upsert({
      where: { name_type: { name: item.name, type: ClothingType.KIDS } },
      update: { ...item, type: ClothingType.KIDS },
      create: { ...item, type: ClothingType.KIDS },
    });
  }
  console.log(`   ✅ ${kidsItems.length} kids' items seeded`);

  // ============================================
  // CLOTHING ITEMS - HOME
  // ============================================
  console.log('🏠 Seeding home items...');
  
  const homeItems = [
    { name: 'Bedsheet (Single)', name_urdu: 'چادر (سنگل)', sort_order: 1 },
    { name: 'Bedsheet (Double)', name_urdu: 'چادر (ڈبل)', sort_order: 2 },
    { name: 'Bedsheet Set', name_urdu: 'چادر سیٹ', sort_order: 3 },
    { name: 'Pillow Cover', name_urdu: 'تکیے کا غلاف', sort_order: 4 },
    { name: 'Blanket (Single)', name_urdu: 'کمبل (سنگل)', sort_order: 5 },
    { name: 'Blanket (Double)', name_urdu: 'کمبل (ڈبل)', sort_order: 6 },
    { name: 'Quilt/Razai', name_urdu: 'رضائی', sort_order: 7 },
    { name: 'Comforter', name_urdu: 'کمفرٹر', sort_order: 8 },
    { name: 'Mattress Cover', name_urdu: 'گدے کا غلاف', sort_order: 9 },
    { name: 'Curtain (Per Panel)', name_urdu: 'پردہ', sort_order: 10 },
    { name: 'Sofa Cover (Single)', name_urdu: 'صوفہ کور', sort_order: 11 },
    { name: 'Sofa Cover Set', name_urdu: 'صوفہ کور سیٹ', sort_order: 12 },
    { name: 'Table Cloth', name_urdu: 'میز پوش', sort_order: 13 },
    { name: 'Towel (Small)', name_urdu: 'تولیہ (چھوٹا)', sort_order: 14 },
    { name: 'Towel (Large)', name_urdu: 'تولیہ (بڑا)', sort_order: 15 },
    { name: 'Bath Robe', name_urdu: 'باتھ روب', sort_order: 16 },
    { name: 'Carpet (Small)', name_urdu: 'قالین (چھوٹا)', sort_order: 17 },
    { name: 'Carpet (Medium)', name_urdu: 'قالین (درمیانہ)', sort_order: 18 },
    { name: 'Carpet (Large)', name_urdu: 'قالین (بڑا)', sort_order: 19 },
    { name: 'Prayer Mat', name_urdu: 'جائے نماز', sort_order: 20 },
    { name: 'Cushion Cover', name_urdu: 'کشن کور', sort_order: 21 },
  ];

  for (const item of homeItems) {
    await prisma.clothingItem.upsert({
      where: { name_type: { name: item.name, type: ClothingType.HOME } },
      update: { ...item, type: ClothingType.HOME },
      create: { ...item, type: ClothingType.HOME },
    });
  }
  console.log(`   ✅ ${homeItems.length} home items seeded`);

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
    { code: 'WELCOME50', discount_type: 'PERCENTAGE', discount_value: 50, max_discount: 200, min_order_amount: 300, valid_until: new Date('2025-12-31'), first_order_only: true },
    { code: 'FLAT100', discount_type: 'FIXED', discount_value: 100, min_order_amount: 500, valid_until: new Date('2025-06-30'), first_order_only: false },
    { code: 'LAUNCH20', discount_type: 'PERCENTAGE', discount_value: 20, max_discount: 150, min_order_amount: 200, valid_until: new Date('2025-03-31'), first_order_only: false },
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
  console.log('\n========================================');
  console.log('🎉 SEED COMPLETED SUCCESSFULLY!');
  console.log('========================================');
  console.log(`📁 Service Categories: ${categories.length}`);
  console.log(`👔 Men's Items: ${menItems.length}`);
  console.log(`👗 Women's Items: ${womenItems.length}`);
  console.log(`👶 Kids' Items: ${kidsItems.length}`);
  console.log(`🏠 Home Items: ${homeItems.length}`);
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
