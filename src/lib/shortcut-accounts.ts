export const shortcutAuthorizationInclude = { account: true, bankBindings: { include: { account: true } } } as const;
type AccountScope = { userId: string; isArchived: boolean; currency: string };
type DeviceScope = { userId: string; isUniversal: boolean; account: AccountScope; bankBindings: Array<{ userId: string; bankId: string; accountId: string; account: AccountScope }> };
export function activeShortcutBindings(device: DeviceScope) {
  return device.bankBindings.filter(b => b.userId === device.userId && b.account.userId === device.userId && !b.account.isArchived && b.account.currency === "EUR");
}
export function shortcutAccountAvailable(device: DeviceScope) {
  return device.isUniversal ? activeShortcutBindings(device).length > 0 : device.account.userId === device.userId && !device.account.isArchived && device.account.currency === "EUR";
}
