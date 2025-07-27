'use client'

import { useEffect, useRef } from 'react'

/**
 * Light animation component using WebGL shaders
 * Creates a dynamic light effect with rippling patterns
 */
export default function LightPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const rendererRef = useRef<LightRenderer | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Initialize WebGL renderer
    const renderer = new LightRenderer(canvas)
    rendererRef.current = renderer

    if (!renderer.isSupported()) {
      console.error('WebGL not supported')
      return
    }

    // Start animation loop
    const animate = () => {
      renderer.render()
      animationRef.current = requestAnimationFrame(animate)
    }
    animate()

    // Handle resize
    const handleResize = () => {
      renderer.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
    }
  }, [])

  return (
    <>
      <h1 className="text-sm font-mono font-bold mb-4">Light</h1>
      <div className="w-80 h-80 xl:w-100 xl:h-100 border border-black">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{
            display: 'block',
            boxSizing: 'border-box',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        />
      </div>
      <div className='flex flex-col items-center gap-2'>
        <p className="text-xs text-gray-600 mt-2">Dynamic light animation with rippling patterns</p>
        <div className="h-12"></div>
      </div>
    </>
  )
}

/**
 * WebGL renderer for light animation effect
 */
class LightRenderer {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private program: WebGLProgram | null = null
  private startTime: number
  private quadBuffer: WebGLBuffer | null = null

  // Uniform locations
  private timeLocation: WebGLUniformLocation | null = null
  private resolutionLocation: WebGLUniformLocation | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.startTime = Date.now()
    
    // Get WebGL context
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      throw new Error('WebGL not supported')
    }
    this.gl = gl as WebGLRenderingContext

    this.initialize()
  }

  /**
   * Check if WebGL is supported
   */
  isSupported(): boolean {
    return !!this.gl
  }

  /**
   * Initialize WebGL resources
   */
  private initialize(): void {
    this.resize()
    this.createShaders()
    this.createQuad()
  }

  /**
   * Create and compile shaders
   */
  private createShaders(): void {
    const vertexShaderSource = `
      // Declare input attribute for 2D vertex positions from buffer
      attribute vec2 position;
      
      // Main vertex shader function - called for each vertex
      void main() {
        // Transform 2D position to 4D clip space coordinates
        // position.xy = input coordinates, z = 0.0 (no depth), w = 1.0 (homogeneous coordinate)
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragmentShaderSource = `
      // Set floating point precision to medium for performance balance
      precision mediump float;
      
      // Uniform variables passed from JavaScript
      uniform float iTime;        // Current time in seconds since start
      uniform vec2 iResolution;   // Canvas resolution in pixels (width, height)
      
      // Macro definitions for shorter variable names (Shadertoy compatibility)
      #define t iTime             // Shorthand for time
      #define r iResolution.xy    // Shorthand for resolution
      
      // Main rendering function that generates the light effect
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        // Initialize color accumulator for RGB channels
        vec3 c;
        // Distance from center and time offset variable
        float l, z = t;
        
        // Loop through RGB color channels to create layered effect
        for(int i = 0; i < 3; i++) {
          // UV coordinates and normalized pixel position
          vec2 uv, p = fragCoord.xy / r;  // Convert pixel coords to 0-1 range
          uv = p;                         // Copy normalized coordinates
          p -= 0.5;                       // Center coordinates around origin (-0.5 to 0.5)
          p.x *= r.x / r.y;              // Correct for aspect ratio to prevent stretching
          z += 0.07;                      // Add time offset for each color channel
          l = length(p);                  // Calculate distance from center point
          
          // Create dynamic rippling distortion effect
          // sin(z)+1: oscillates between 0-2, controls overall intensity
          // l*9.0: creates 9 concentric rings
          // abs(sin(...)): creates positive wave pattern
          // p/l: normalizes direction vector from center
          uv += p / l * (sin(z) + 1.0) * abs(sin(l * 9.0 - z - z));
          
          // Generate bright light spots using distance field technique
          // mod(uv, 1.0): creates repeating pattern every 1 unit
          // - 0.5: centers each cell around origin
          // length(...): distance to nearest cell center
          // 0.01/distance: creates bright spots (inverse distance)
          c[i] = 0.01 / length(mod(uv, 1.0) - 0.5);
        }
        
        // Output final color: RGB from color accumulator divided by distance
        // Alpha channel uses time for additional animation effect
        fragColor = vec4(c / l, t);
      }
      
      // Fragment shader entry point
      void main() {
        // Call main rendering function with built-in fragment coordinate
        mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `

    // Create and compile vertex shader
    const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER)
    if (!vertexShader) return

    // Create and compile fragment shader
    const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER)
    if (!fragmentShader) return

    // Create and link shader program
    this.program = this.gl.createProgram()
    if (!this.program) return

    this.gl.attachShader(this.program, vertexShader)
    this.gl.attachShader(this.program, fragmentShader)
    this.gl.linkProgram(this.program)

    // Check if program linked successfully
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Shader program failed to link:', this.gl.getProgramInfoLog(this.program))
      return
    }

    // Get uniform locations
    this.timeLocation = this.gl.getUniformLocation(this.program, 'iTime')
    this.resolutionLocation = this.gl.getUniformLocation(this.program, 'iResolution')

    // Clean up shaders (they're now part of the program)
    this.gl.deleteShader(vertexShader)
    this.gl.deleteShader(fragmentShader)
  }

  /**
   * Compile a shader from source code
   */
  private compileShader(source: string, type: number): WebGLShader | null {
    const shader = this.gl.createShader(type)
    if (!shader) return null

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    // Check compilation status
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader))
      this.gl.deleteShader(shader)
      return null
    }

    return shader
  }

  /**
   * Create a fullscreen quad for rendering
   */
  private createQuad(): void {
    // Fullscreen quad vertices (two triangles)
    const vertices = new Float32Array([
      -1, -1,  // Bottom left
       1, -1,  // Bottom right
      -1,  1,  // Top left
       1,  1   // Top right
    ])

    this.quadBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW)
  }

  /**
   * Handle canvas resize
   */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const displayWidth = rect.width * dpr
    const displayHeight = rect.height * dpr

    // Check if canvas size needs to be updated
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth
      this.canvas.height = displayHeight
      this.gl.viewport(0, 0, displayWidth, displayHeight)
    }
  }

  /**
   * Render a single frame
   */
  render(): void {
    if (!this.program) return

    // Calculate elapsed time
    const currentTime = (Date.now() - this.startTime) / 1000

    // Clear the canvas
    this.gl.clearColor(0, 0, 0, 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    // Use shader program
    this.gl.useProgram(this.program)

    // Set uniforms
    if (this.timeLocation) {
      this.gl.uniform1f(this.timeLocation, currentTime)
    }
    if (this.resolutionLocation) {
      this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height)
    }

    // Bind quad buffer and set up vertex attributes
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer)
    const positionLocation = this.gl.getAttribLocation(this.program, 'position')
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    // Draw the quad
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    if (this.program) {
      this.gl.deleteProgram(this.program)
      this.program = null
    }
    if (this.quadBuffer) {
      this.gl.deleteBuffer(this.quadBuffer)
      this.quadBuffer = null
    }
  }
}