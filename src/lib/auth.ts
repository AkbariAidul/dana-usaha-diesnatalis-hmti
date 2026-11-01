const PIN = process.env.DASHBOARD_PIN || '079876'

export async function verifyPIN(inputPin: string): Promise<boolean> {
  return inputPin === PIN
}
