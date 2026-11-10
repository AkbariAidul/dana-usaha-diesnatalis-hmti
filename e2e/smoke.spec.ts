import { expect, test } from '@playwright/test'

const pages = [
  { path: '/', title: /Dana Usaha HMTI/ },
  { path: '/beli-tiket', title: /Beli Tiket In4Days XI/ },
  { path: '/paket', title: /Paket Combo In4Days XI/ },
  { path: '/po-merchandise', title: /Pre-Order Merchandise In4Days XI/ },
  { path: '/daftar-tenant', title: /Daftar Tenant In4Days XI/ },
  { path: '/lacak', title: /Lacak Pesanan/ },
  { path: '/kebijakan-privasi', title: /Kebijakan Privasi/ },
  { path: '/syarat-ketentuan', title: /Syarat & Ketentuan/ },
]

for (const { path, title } of pages) {
  test(`${path} merender`, async ({ page }) => {
    const res = await page.goto(path)
    expect(res?.status()).toBeLessThan(400)
    await expect(page).toHaveTitle(title)
  })
}

test('beranda menautkan halaman legal', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Kebijakan Privasi' })).toHaveAttribute('href', '/kebijakan-privasi')
  await expect(page.getByRole('link', { name: 'Syarat & Ketentuan' })).toHaveAttribute('href', '/syarat-ketentuan')
})
