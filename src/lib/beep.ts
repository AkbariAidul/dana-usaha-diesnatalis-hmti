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
    const gain = ctx.createGain()
    const now = ctx.currentTime

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.2)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  } catch {
    // browser tanpa audio / autoplay diblokir
  }
}
