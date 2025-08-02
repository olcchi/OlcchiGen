'use client'

import { useEffect, useRef } from 'react'
import type * as Matter from 'matter-js'

// Extend Matter.Body type to include custom properties
interface ExtendedBody extends Matter.Body {
  radius?: number
  originalPosition?: { x: number; y: number }
}

/**
 * ASCII Physics page - displays p5.js and matter.js physics simulation with 9 circles
 */
export default function AsciiPhysicsPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const p5InstanceRef = useRef<import('p5') | null>(null)
  const engineRef = useRef<Matter.Engine | null>(null)
  const ballsRef = useRef<ExtendedBody[]>([])
  const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null)

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
        let engine: Matter.Engine
        let world: Matter.World
        let balls: ExtendedBody[] = []
        let canvasWidth = 400
        let canvasHeight = 400
        let mouseConstraint: Matter.MouseConstraint | null = null
        let mouse: Matter.Mouse | null = null

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

          // Create walls to contain the balls
          const wallThickness = 50
          const walls = [
            // Top wall
            Bodies.rectangle(canvasWidth / 2, -wallThickness / 2, canvasWidth, wallThickness, { isStatic: true }),
            // Bottom wall
            Bodies.rectangle(canvasWidth / 2, canvasHeight + wallThickness / 2, canvasWidth, wallThickness, { isStatic: true }),
            // Left wall
            Bodies.rectangle(-wallThickness / 2, canvasHeight / 2, wallThickness, canvasHeight, { isStatic: true }),
            // Right wall
            Bodies.rectangle(canvasWidth + wallThickness / 2, canvasHeight / 2, wallThickness, canvasHeight, { isStatic: true })
          ]
          World.add(world, walls)

          // Create 9 balls in a 3x3 grid formation
          const ballRadius = 5
          const spacing = 1
          const startX = canvasWidth / 2 - spacing
          const startY = canvasHeight / 2 - spacing

          for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
              const x = startX + col * spacing
              const y = startY + row * spacing
              const ball = Bodies.circle(x, y, ballRadius, {
                restitution: 0.8, // Good bouncing like in Vue version
                friction: 0, // No surface friction like Vue version
                frictionAir: 0.1, // Air resistance like Vue version
                density: 0.001, // Balanced density for controlled movement
                inertia: Infinity // Prevent rotation for cleaner movement
              }) as ExtendedBody
              // Store radius for rendering
              ball.radius = ballRadius
              balls.push(ball)
            }
          }
          World.add(world, balls)

          // Create mouse and mouse constraint for dragging
          mouse = Mouse.create(p.canvas.elt)
          mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
              stiffness: 0.2,
              render: {
                visible: false
              }
            }
          })
          World.add(world, mouseConstraint)
          
          // Store original positions for restoration
          balls.forEach((ball, index) => {
            const row = Math.floor(index / 5)
            const col = index % 5
            ball.originalPosition = {
              x: startX + col * spacing,
              y: startY + row * spacing
            }
          })

          // Store references
          engineRef.current = engine
          ballsRef.current = balls
          mouseConstraintRef.current = mouseConstraint
        }

        // Auto-restore functionality
        let restoreCount = 0
        let restoreTimer: NodeJS.Timeout | null = null
        let restoreTimeout: NodeJS.Timeout | null = null
        
        const restoreAll = () => {
          balls.forEach((ball) => {
            const dx = ball.originalPosition.x - ball.position.x
            const dy = ball.originalPosition.y - ball.position.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance > 5) {
               const factor = 0.08
               Matter.Body.setVelocity(ball, {
                 x: dx * factor,
                 y: dy * factor
               })
               Matter.Body.setAngularVelocity(ball, -ball.angle * factor)
             }
          })
        }
        
        const startRestore = () => {
          if (restoreCount > 0) {
            restoreCount = 60
            return
          }
          
          stopRestore()
          restoreCount = 60
          
          restoreTimeout = setTimeout(() => {
            restoreTimer = setInterval(() => {
              restoreCount -= 1
              restoreAll()
              if (restoreCount <= 0) {
                stopRestore()
              }
            }, 100)
          }, 2000)
        }
        
        const stopRestore = () => {
          if (restoreTimer) {
            clearInterval(restoreTimer)
            restoreTimer = null
          }
          if (restoreTimeout) {
            clearTimeout(restoreTimeout)
            restoreTimeout = null
          }
          restoreCount = 0
        }
        
        // Mouse events are now handled automatically by Matter.js MouseConstraint
        p.mouseReleased = () => {
          startRestore()
        }
        
        p.mousePressed = () => {
           stopRestore()
         }
         
         // Reset function
         const reset = () => {
           stopRestore()
           balls.forEach((ball) => {
             Matter.Body.setAngularVelocity(ball, 0)
             Matter.Body.setVelocity(ball, { x: 0, y: 0 })
             Matter.Body.setPosition(ball, ball.originalPosition)
           })
         }
         
         // Shake function
         const shake = () => {
           stopRestore()
           balls.forEach((ball) => {
             Matter.Body.setAngularVelocity(ball, (Math.random() - 0.5) * 2)
             Matter.Body.setVelocity(ball, {
               x: (Math.random() - 0.5) * 60,
               y: (Math.random() - 0.5) * 60
             })
           })
           startRestore()
         }
         
         // Keyboard events
         p.keyPressed = () => {
           if (p.key === 'r' || p.key === 'R') {
             reset()
           } else if (p.key === ' ') {
             shake()
           }
         }

        p.draw = () => {
          p.background(255) // White background
          
          // Update mouse position for Matter.js
          if (mouse) {
            mouse.position.x = p.mouseX
            mouse.position.y = p.mouseY
          }
          
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
            p.circle(0, 0, ball.radius * 2)
            
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
          Drag any ball to create collisions. Press 'R' to reset, 'Space' to shake. Balls auto-restore to original positions.
        </p>
        <div className="h-12"></div>
      </div>
    </>
  )
}