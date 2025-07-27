'use client'

import { useEffect, useRef, useState } from 'react'
import { Separator } from '@/components/ui/separator'
/**
 * Ring animation component using WebGL shaders
 * Creates a thin ring effect with RGB layering and distance field techniques
 */
export default function RingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const rendererRef = useRef<RingRenderer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Initialize WebGL renderer
    const renderer = new RingRenderer(canvas)
    rendererRef.current = renderer

    if (!renderer.isSupported()) {
      console.error('WebGL not supported')
      return
    }

    // Start animation loop
    const animate = () => {
      if (isPlaying) {
        renderer.render()
      } else {
        renderer.renderStatic()
      }
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
  }, [isPlaying])

  return (
    <>
      <h1 className="text-sm font-mono font-bold mb-4">vertigo</h1>
      <div className="w-80 h-80 relative xl:w-100 xl:h-100 border border-black">
        {!isPlaying &&
          <div className='absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm'>
            <div className='flex flex-col gap-3  items-center  h-fit whitespace-nowrap'>
              <p className="text-xs">光敏性癫痫警告
                / Photo-sensitive Epilepsy Warning
              </p>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="text-xs underline cursor-pointer hover:opacity-60"
              >
                {isPlaying ? '暂停 / Pause' : '播放 / Play'}
              </button>
            </div>
          </div>
        }
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
        <p className="text-xs">眩晕 / vertigo</p>
      </div>
    </>
  )
}

/**
 * WebGL renderer for ring animation effect
 */
class RingRenderer {
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
      // 声明从缓冲区接收2D顶点位置的输入属性
      attribute vec2 position;
      
      // 顶点着色器主函数 - 每个顶点都会调用一次
      void main() {
        // 将2D位置转换为4D裁剪空间坐标
        // position.xy = 输入坐标, z = 0.0 (无深度), w = 1.0 (齐次坐标)
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragmentShaderSource = `
      // 设置浮点数精度为中等，平衡性能和质量
      precision mediump float;
      
      // 从JavaScript传入的uniform变量
      uniform float iTime;        // 从开始到现在的时间（秒）
      uniform vec2 iResolution;   // 画布分辨率（宽度，高度）像素
      
      // 宏定义，用于简化变量名
      #define t iTime             // 时间的简写
      #define r iResolution.xy    // 分辨率的简写
      
      // 生成圆环效果的主渲染函数
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        // 初始化RGB通道的颜色累加器
        vec3 c = vec3(0.0);
        
        // 归一化像素坐标到-1到1范围
        vec2 p = (fragCoord.xy * 2.0 - r) / min(r.x, r.y);
        
        // 计算距离中心的距离
        float dist = length(p);
        
        // 定义圆环参数
        float baseRingWidth = 0.01;     // 基础圆环宽度
        float animationSpeed = 0.5;     // 动画速度
        float ringInterval = 0.8;       // 圆环生成间隔
        
        // 创建多个扩散的圆环 - 真正的无限循环
        for(int ringIndex = 0; ringIndex < 5; ringIndex++) {
          // 使用模运算实现真正的无限循环
          float cycleTime = mod(t, 5.0 * ringInterval);
          float ringTime = cycleTime - float(ringIndex) * ringInterval;
          
          // 处理负时间的情况，让圆环在周期内循环
          if(ringTime < 0.0) {
            ringTime += 5.0 * ringInterval;
          }
          
          // 只渲染在当前周期内的圆环
          if(ringTime > 0.0 && ringTime < 5.0 * ringInterval) {
            // 预计算圆环级别的参数，避免在RGB循环中重复计算
            float ringRadius = ringTime * animationSpeed;
            float alpha = exp(-ringTime * 0.8);
            float dispersionStrength = ringTime * 1.2;
            float ringWidth = baseRingWidth * (1.0 + ringRadius * 0.3);
            float glowWidth = ringWidth * 4.0;
            float glowIntensity = 0.5;
            
            // 循环遍历RGB颜色通道以创建分层效果
            for(int i = 0; i < 3; i++) {
              // 为每个颜色通道添加随时间增强的偏移
              float baseOffset = float(i - 1) * 0.006; // 中心化偏移
              float radiusOffset = baseOffset * (1.0 + dispersionStrength);
              float currentRadius = ringRadius + radiusOffset;
              
              // 使用距离场技术生成圆环
              float ring = 1.0 - smoothstep(0.0, ringWidth, abs(dist - currentRadius));
              
              // 颜色强度随色散增强而变化
              float colorIntensity = 0.7 + 0.3 * (1.0 + dispersionStrength * 0.8);
              float colorVariation = colorIntensity + 0.2 * sin(ringTime * 3.0 + float(i) * 2.0);
              
              // 应用透明度衰减和颜色变化
              ring *= alpha * colorVariation;
              
              // Add glow effect - create a softer, larger ring around the main ring
              float glowRadius = currentRadius;
              
              // Create glow using exponential falloff for smoother effect
              float glowDistance = abs(dist - glowRadius);
              float glow = glowIntensity * exp(-glowDistance / (glowWidth * 0.5));
              
              // Apply same transparency and color variation to glow
              glow *= alpha * 0.9 * colorVariation * 0.8;
              
              // Combine main ring and glow
              float totalEffect = ring + glow;
              
              // 累加到对应的颜色通道
              c[i] += totalEffect;
            }
          }
        }
        
        // 增强亮度并添加发光效果
        c *= 2.5;
        
        // 输出最终颜色，alpha设为1.0保持不透明
        fragColor = vec4(c, 1.0);
      }
      
      // 片段着色器入口点
      void main() {
        // 使用内置片段坐标调用主渲染函数
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
      -1, 1,  // Top left
      1, 1   // Top right
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
   * Render a static frame (paused state)
   */
  renderStatic(): void {
    if (!this.program) return

    // Use a fixed time for static rendering
    const staticTime = 0.0

    // Clear the canvas
    this.gl.clearColor(0, 0, 0, 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    // Use shader program
    this.gl.useProgram(this.program)

    // Set uniforms with static time
    if (this.timeLocation) {
      this.gl.uniform1f(this.timeLocation, staticTime)
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