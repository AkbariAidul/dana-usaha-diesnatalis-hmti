let ctx: AudioContext | null = null

export function siapkanBeep() {
  if (typeof window === 'undefined') return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // browser tanpa audio
  }
}

export function beep() {
  if (typeof window === 'undefined') return
  try {
    siapkanBeep()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const sparkle = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime

    osc.type = 'sine'
    osc.frequency.setValueAtTime(1600, now)
    sparkle.type = 'sine'
    sparkle.frequency.setValueAtTime(3200, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075)

    osc.connect(gain)
    sparkle.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    sparkle.start(now)
    osc.stop(now + 0.08)
    sparkle.stop(now + 0.08)
    osc.onended = () => {
      osc.disconnect()
      sparkle.disconnect()
      gain.disconnect()
    }
  } catch {
    // browser tanpa audio / autoplay diblokir
  }
}
