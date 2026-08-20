-- BikriKoro — default public payment methods and trending searches
-- These are display settings only. Checkout remains hosted by UddoktaPay.
insert into public.admin_settings(setting_key, setting_value)
values
  (
    'public_payment_methods',
    jsonb_build_object(
      'value',
      '[{"name":"bKash","color":"#E2136E","short":"bKash"},{"name":"Nagad","color":"#F4821F","short":"Nagad"},{"name":"Rocket","color":"#8B1FA9","short":"Rocket"},{"name":"Upay","color":"#00A651","short":"উপায়"},{"name":"City Bank","color":"#1B4F8A","short":"City"},{"name":"Islami Bank","color":"#006633","short":"IBBL"},{"name":"Agrani Bank","color":"#004B87","short":"Agrani"},{"name":"Pubali Bank","color":"#C41E3A","short":"Pubali"},{"name":"UCB","color":"#003087","short":"UCB"}]'
    )
  ),
  (
    'public_trending_searches',
    jsonb_build_object('value', 'গেম অ্যাকাউন্ট, প্রিমিয়াম সাবস্ক্রিপশন, গিফট কার্ড, সফটওয়্যার লাইসেন্স, ডিজাইন অ্যাসেট')
  )
on conflict (setting_key) do nothing;
