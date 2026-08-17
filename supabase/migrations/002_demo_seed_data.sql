-- =====================================================================
-- BikriKoro — optional demo seed data
-- =====================================================================
-- Not required for the app to function — skip this file entirely for a
-- clean production database. Run it only if you want the same sample
-- listings the mock ProductRepositoryImpl ships with, useful for testing
-- the Supabase-backed repositories against realistic-looking data before
-- real users start posting.
-- =====================================================================

insert into profiles (id, name, is_verified, rating, review_count) values
    ('seller_1', 'রাকিব হাসান', true, 4.8, 231),
    ('seller_2', 'নাসরিন আক্তার', false, 4.2, 34),
    ('seller_3', 'Nasah Group Ltd', true, 5.0, 89),
    ('seller_7', 'Hiplastics.my', true, 4.7, 145)
on conflict (id) do nothing;

insert into promo_banners (id, image_url, target_category_id, sort_order) values
    ('banner_1', 'https://picsum.photos/seed/bikrikoro-eid/800/360', 'cat_fashion', 1),
    ('banner_2', 'https://picsum.photos/seed/bikrikoro-mobile/800/360', 'cat_mobile', 2),
    ('banner_3', 'https://picsum.photos/seed/bikrikoro-escrow/800/360', null, 3)
on conflict (id) do nothing;

insert into products (title, description, price, original_price, images, category_id, condition, location, seller_id) values
    (
        'Samsung Galaxy A54 5G — ৮/১২৮ জিবি, বক্সসহ',
        '৩ মাস ব্যবহৃত, কোনো স্ক্র্যাচ নেই, সম্পূর্ণ বক্স ও চার্জার আছে।',
        32500, 38000,
        array['https://picsum.photos/seed/galaxy-a54-1/600/600', 'https://picsum.photos/seed/galaxy-a54-2/600/600'],
        'cat_mobile', 'USED', 'শাহ আলম, মালয়েশিয়া', 'seller_1'
    ),
    (
        '৩-সিটার সোফা সেট, প্রিমিয়াম ফেব্রিক',
        'একদম নতুনের মতো, ধোঁয়ামুক্ত বাসা থেকে বিক্রি হচ্ছে।',
        18000, null,
        array['https://picsum.photos/seed/sofa-set-1/600/600'],
        'cat_furniture', 'USED', 'ঢাকা, বাংলাদেশ', 'seller_2'
    ),
    (
        'Apple MacBook Air M2 — একদম নতুন, সিলড বক্স',
        'গিফট পেয়েছিলাম, প্যাকেট খোলা হয়নি। ইনভয়েসসহ।',
        142000, 155000,
        array['https://picsum.photos/seed/macbook-air-1/600/600'],
        'cat_electronics', 'NEW', 'কুয়ালালামপুর, মালয়েশিয়া', 'seller_3'
    ),
    (
        'ডাম্বেল সেট (২০ কেজি) + বেঞ্চ',
        'হোম জিমের জন্য পারফেক্ট, খুব কম ব্যবহৃত।',
        7500, null,
        array['https://picsum.photos/seed/dumbbell-set-1/600/600'],
        'cat_sports', 'USED', 'পেতালিং জায়া, মালয়েশিয়া', 'seller_7'
    );
