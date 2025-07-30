'use client'

import { useEffect, useRef } from 'react'

/**
 * ASCII Physics page - displays p5.js and matter.js physics simulation with 9 circles
 */
export default function AsciiPhysicsPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5InstanceRef = useRef<import('p5') | null>(null)
  const engineRef = useRef<any>(null)
  const ballsRef = useRef<any[]>([])
  const mouseConstraintRef = useRef<any>(null)

  useEffect(() => {
    // Dynamically import p5.js and matter.js to avoid SSR issues
    const loadLibraries = async () => {
      const [p5Module, matterModule] = await Promise.all([
        import('p5'),
        import('matter-js')
      ])
      
      const p5 = p5Module.default
      const Matter = matterModule.default
      const { Engine, World, Bodies, Mouse, MouseConstraint, Constraint } = Matter

      if (!containerRef.current) return

      const sketch = (p: import('p5')) => {
        let engine: any
        let world: any
        let balls: any[] = []
        let canvasWidth = 400
        let canvasHeight = 400
        let draggedBall: any = null
        let dragOffset = { x: 0, y: 0 }

        p.setup = () => {
          // Create canvas to fill parent container
          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            canvasWidth = rect.width
            canvasHeight = rect.height
            p.createCanvas(canvasWidth, canvasHeight)
          } else {
            p.createCanvas(400, 400) // fallback
          }

          // Create matter.js engine
          engine = Engine.create()
          world = engine.world
          engine.world.gravity.y = 0 // No gravity for pool table effect

          // No walls - balls can move freely

          // Create 9 balls in a 3x3 grid formation
          const ballRadius = 15
          const spacing = 60
          const startX = canvasWidth / 2 - spacing
          const startY = canvasHeight / 2 - spacing

          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
              const x = startX + col * spacing
              const y = startY + row * spacing
              const ball = Bodies.circle(x, y, ballRadius, {
                restitution: 0.8, // Bouncy but not too much
                friction: 0.005, // Very low friction for smooth movement
                frictionAir: 0.005, // Minimal air resistance for better inertia
                density: 0.01, // Higher density for better momentum
                inertia: Infinity // Prevent rotation for cleaner movement
              })
              balls.push(ball)
            }
          }
          World.add(world, balls)

          // Store references
          engineRef.current = engine
          ballsRef.current = balls
        }

        p.mousePressed = () => {
          // Find which ball is under the mouse
          for (let ball of balls) {
            const distance = p.dist(p.mouseX, p.mouseY, ball.position.x, ball.position.y)
            if (distance < ball.circleRadius) {
              draggedBall = ball
              dragOffset.x = p.mouseX - ball.position.x
              dragOffset.y = p.mouseY - ball.position.y
              // Stop the ball's movement when we start dragging
               matterModule.default.Body.setVelocity(ball, { x: 0, y: 0 })
              break
            }
          }
        }

        p.mouseDragged = () => {
          if (draggedBall) {
            // Move the ball to follow the mouse
            const newX = p.mouseX - dragOffset.x
            const newY = p.mouseY - dragOffset.y
            matterModule.default.Body.setPosition(draggedBall, { x: newX, y: newY })
          }
        }

        p.mouseReleased = () => {
          if (draggedBall) {
            // Give the ball some velocity based on mouse movement
            const velocityX = (p.mouseX - p.pmouseX) * 0.3
            const velocityY = (p.mouseY - p.pmouseY) * 0.3
            matterModule.default.Body.setVelocity(draggedBall, { x: velocityX, y: velocityY })
            draggedBall = null
          }
        }

        p.draw = () => {
          p.background(255) // White background
          
          // Update physics engine
          Engine.update(engine)

          // Draw balls - all black
          balls.forEach((ball, index) => {
            const pos = ball.position
            const angle = ball.angle
            
            p.push()
            p.translate(pos.x, pos.y)
            p.rotate(angle)
            
            // All balls are black
            p.fill(0)
            p.noStroke()
            p.circle(0, 0, ball.circleRadius * 2)
            
            p.pop()
          })

        }

        p.windowResized = () => {
          const container = containerRef.current
          if (container) {
            const rect = container.getBoundingClientRect()
            p.resizeCanvas(rect.width, rect.height)
            canvasWidth = rect.width
            canvasHeight = rect.height
          }
        }
      }

      // Create p5 instance
      p5InstanceRef.current = new p5(sketch, containerRef.current)
    }

    loadLibraries()

    // Cleanup function
    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove()
        p5InstanceRef.current = null
      }
      if (engineRef.current) {
        engineRef.current = null
      }
      ballsRef.current = []
      mouseConstraintRef.current = null
    }
  }, []) // Only run once on mount

  return (
    <>
      <h1 className="text-sm font-mono font-bold mb-4">ASCII Physics</h1>
      <div className="w-80 h-80 xl:w-100 xl:h-100 border border-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
      <div className='flex flex-col items-center gap-2'>
        <p className="text-xs text-gray-600 mt-2 text-center max-w-80">
          Drag any ball to create collisions. Simple black and white physics simulation.
        </p>
        <div className="h-12"></div>
      </div>
    </>
  )
}