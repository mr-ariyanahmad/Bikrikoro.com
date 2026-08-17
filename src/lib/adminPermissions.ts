const PERMISSION_BY_PATH: Array<[string, string]> = [
  ['/admin/orders', 'sales.orders'], ['/admin/deliveries', 'sales.deliveries'], ['/admin/customers', 'sales.customers'], ['/admin/coupons', 'sales.coupons'], ['/admin/reviews', 'sales.reviews'], ['/admin/disputes', 'sales.disputes'], ['/admin/finance', 'sales.finance'],
  ['/admin/products', 'catalog.products'], ['/admin/categories', 'catalog.categories'], ['/admin/industries', 'catalog.industries'],
  ['/admin/gallery', 'content.gallery'], ['/admin/downloads', 'content.downloads'], ['/admin/blog', 'content.blog'], ['/admin/pages', 'content.pages'], ['/admin/features', 'content.features'], ['/admin/sellers', 'content.sellers'], ['/admin/support', 'content.support'], ['/admin/notifications', 'content.notifications'],
  ['/admin/invoice-settings', 'settings.invoice'], ['/admin/site-settings', 'settings.site'], ['/admin/system-status', 'settings.system'], ['/admin/team', 'team.manage'],
]

export function permissionForAdminPath(pathname: string) { return PERMISSION_BY_PATH.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? 'dashboard.view' }
