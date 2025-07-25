'use client'

import { useEffect, useRef, useState } from 'react'
import { Slider } from '@/components/ui/slider'

/**
 * Thermal Motion animation page - displays p5.js particle animation with temperature control
 */
export default function ThermalMotionPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5InstanceRef = useRef<import('p5') | null>(null)
  const [temperature, setTemperature] = useState([50]) // Temperature control state
  const temperatureRef = useRef(temperature) // Ref to access current temperature in p5 sketch

  // Update temperature ref when state changes
  useEffect(() => {
    temperatureRef.current = temperature
  }, [temperature])

  useEffect(() => {
    // Dynamically import p5.js to avoid SSR issues
    const loadP5 = async () => {
      const p5 = (await import('p5')).default

      if (!containerRef.current) return

      const sketch = (p: import('p5')) => {
        let particles: Particle[] = []
        let time = 0

        class Particle {
          x: number
          y: number
          alpha: number
          timeOffset: number
          noiseOffsetX: number
          noiseOffsetY: number

          constructor() {
            this.x = p.random(p.width)
            this.y = p.random(p.height)
            this.alpha = p.random(50, 150)
            // Add random time offset for each particle
            this.timeOffset = p.random(1000)
            // Add random noise offsets for unique movement patterns
            this.noiseOffsetX = p.random(1000)
            this.noiseOffsetY = p.random(1000)
          }

          update() {
            // Use p5.js noise function with unique offsets for each particle
            // Temperature affects noise scale and movement intensity
            const tempFactor = temperatureRef.current[0] / 50 // Normalize temperature (0.2 to 2.0)
            const noiseScale = 0.005 + (tempFactor * 0.015) // More chaotic at higher temps
            const timeScale = 0.005 + (tempFactor * 0.015) // Faster time progression

            const angle = p.noise(
              (this.x + this.noiseOffsetX) * noiseScale,
              (this.y + this.noiseOffsetY) * noiseScale,
              (time + this.timeOffset) * timeScale
            ) * p.TWO_PI * (1 + tempFactor) // More direction changes at higher temps

            const speed = 0.3 + (tempFactor * 0.7) // Speed increases with temperature

            this.x += p.cos(angle) * speed
            this.y += p.sin(angle) * speed

            // Wrap around edges
            if (this.x < 0) this.x = p.width
            if (this.x > p.width) this.x = 0
            if (this.y < 0) this.y = p.height
            if (this.y > p.height) this.y = 0
          }

          draw() {
            p.fill(0, this.alpha)
            p.noStroke()
            p.circle(this.x, this.y, 2)
          }
        }

        p.setup = () => {
          // Create canvas to fill parent container
          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            p.createCanvas(rect.width, rect.height)
          } else {
            p.createCanvas(400, 400) // fallback
          }
          p.background(255)

          // Initialize particles based on canvas size
          const numParticles = Math.floor((p.width * p.height) / 3200) // adaptive particle count
          particles = [] // Clear existing particles
          for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle())
          }
        }

        p.draw = () => {
          // Fade background slightly for trail effect
          p.fill(255, 10)
          p.noStroke()
          p.rect(0, 0, p.width, p.height)

          // Update and draw particles
          particles.forEach(particle => {
            particle.update()
            particle.draw()
          })

          time++
        }

        p.windowResized = () => {
          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            p.resizeCanvas(rect.width, rect.height)

            // Reinitialize particles for new canvas size
            const numParticles = Math.floor((p.width * p.height) / 3200)
            particles = []
            for (let i = 0; i < numParticles; i++) {
              particles.push(new Particle())
            }
          }
        }
      }

      // Create p5 instance
      p5InstanceRef.current = new p5(sketch, containerRef.current)
    }

    loadP5()

    // Cleanup function
    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove()
        p5InstanceRef.current = null
      }
    }
  }, []) // Only run once on mount

  return (
    <>
      <h1 className="text-sm font-mono font-bold mb-4">Thermal motion</h1>
      <div className="w-80 h-80 xl:w-100 xl:h-100 border border-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
      <div className='flex flex-col items-center gap-2'>
        <p>temperature: {temperature}</p>
        <Slider
          value={temperature}
          onValueChange={setTemperature}
          min={20}
          max={80}
          step={1}
          className="w-60"
        />
      </div>
    </>
  )
}