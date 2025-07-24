'use client'

import { useEffect, useRef } from 'react'

/**
 * Circle Loop animation page - displays p5.js 3D rotating circles animation
 */
export default function CircleLoopPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5InstanceRef = useRef<import('p5') | null>(null)

  useEffect(() => {
    // Dynamically import p5.js to avoid SSR issues
    const loadP5 = async () => {
      const p5 = (await import('p5')).default

      if (!containerRef.current) return

      const sketch = (p: import('p5')) => {
        let targetRotationY = 0
        let currentRotationY = 0
        let targetRotationX = 0
        let currentRotationX = 0
        const animationSpeed = 0.05
        let radius = 150 // Will be updated in setup based on canvas size

        // Function to draw a smooth circle using many line segments
        const drawCircle = (radius: number) => {
          const segments = 100 // High number of segments for smooth circle
          p.beginShape()
          for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * p.TWO_PI
            const x = p.cos(angle) * radius
            const y = p.sin(angle) * radius
            p.vertex(x, y, 0) // Ensure all vertices are exactly on z=0 plane
          }
          p.endShape(p.CLOSE)
        }

        p.setup = () => {
          // Create canvas to fill parent container
          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            p.createCanvas(rect.width, rect.height, p.WEBGL)
          } else {
            p.createCanvas(400, 400, p.WEBGL) // fallback
          }
          
          // Set radius to 35% of the smaller dimension to ensure it fits within container
          radius = Math.min(p.width, p.height) * 0.35
          
          // Use orthographic projection to eliminate perspective distortion
          p.ortho(-p.width/2, p.width/2, -p.height/2, p.height/2, -1000, 1000)
        }

        p.draw = () => {
          p.background(255)
          
          // Set stroke properties
          p.stroke(0)
          p.strokeWeight(1)
          p.noFill()
          
          // Smooth interpolation towards target rotations
          currentRotationY = p.lerp(currentRotationY, targetRotationY, animationSpeed)
          currentRotationX = p.lerp(currentRotationX, targetRotationX, animationSpeed)
          
          // Rotate around both Y-axis and X-axis
          p.rotateY(currentRotationY)
          p.rotateX(currentRotationX)
          
          // Draw circle1 (parallel to screen when rotation = 0)
          p.push()
          p.translate(0, 0, 0) // Ensure exact center position
          drawCircle(radius)
          p.pop()
          
          // Draw circle2 (perpendicular to circle1, rotated 90 degrees around Y-axis)
          p.push()
          p.translate(0, 0, 0) // Ensure exact center position
          p.rotateY(p.PI / 2)
          drawCircle(radius)
          p.pop()
          
          // Increment target rotations by 90 degrees every 120 frames (2 seconds at 60fps)
          if (p.frameCount % 120 === 0) {
            targetRotationY += p.PI / 2
            targetRotationX += p.PI / 2
          }
        }

        p.windowResized = () => {
          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            p.resizeCanvas(rect.width, rect.height)
            // Update radius when canvas is resized
            radius = Math.min(p.width, p.height) * 0.35
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
      <h1 className="text-sm font-mono font-bold mb-4">Circle Loop</h1>
      <div className="w-80 h-80 xl:w-100 xl:h-100 border border-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
      <div className='flex flex-col items-center gap-2'>
        {/* Empty space to maintain consistent layout with other pages */}
        <div className="h-16"></div>
      </div>
    </>
  )
}