const PIN = process.env.NEXT_PUBLIC_DASHBOARD_PIN || '079876'

export async function verifyPIN(inputPin: string): Promise<boolean> {
  return inputPin === PIN
}
