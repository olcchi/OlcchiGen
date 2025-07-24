"use client";

import { useEffect, useRef } from "react";

interface Character {
  char: string;
  originalX: number;
  originalY: number;
  x: number;
  y: number;
  isFloating: boolean;
  isVisible: boolean;
  isFadingIn: boolean;
  fadeInStartTime: number;
  alpha: number;
  index: number;
  body: Matter.Body | null;
  windDirection?: number;
  windStrength?: number;
  floatStartTime?: number;
}

/**
 * Memory Fade animation page - displays text that falls and fades when clicked
 * Uses Matter.js for realistic physics
 */
export default function MemoryFadePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<import('p5') | null>(null);

  useEffect(() => {
    // Dynamically import p5.js and Matter.js to avoid SSR issues
    const loadLibraries = async () => {
      const p5 = (await import("p5")).default;
      const Matter = await import("matter-js");
      const { Engine, World, Bodies, Body } = Matter;

      if (!containerRef.current) return;

      const sketch = (p: import('p5')) => {
        // Text content
        const text =
          "因为不知死何时将至，我们仍将生命视为无穷无尽、取之不竭的源泉。然而，一生所遇之事也许就只发生那么几次。曾经左右过我们人生的童年回忆浮现在心头的时刻还能有多少次呢？也许还能有四五次。目睹满月升起的时刻又还能有多少次呢？或许最多还能有二十次。但人们总是深信这些机会将无穷无尽。";
        let characters: Character[] = [];
        let floatingChars: Character[] = [];
        
        let isFloating = false;
        let floatQueue: number[] = []; // 待飞走的字符索引队列
        let lastFloatTime = 0;
        let floatCount = 0; // 已经飞走的批次计数
        let allFloatedTime = 0; // 所有字符飞走的时间
        let isResetting = false; // 是否正在重置
        let resetQueue: number[] = []; // 重置时字符出现的队列
        let lastResetTime = 0;

        // Matter.js physics engine
        let engine: Matter.Engine;
        let world: Matter.World;

        // Layout parameters
        const lineHeight = 24;
        const charWidth = 16;
        const charHeight = 16;

        p.setup = () => {
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            p.createCanvas(rect.width, rect.height);
          } else {
            p.createCanvas(480, 360);
          }

          // Create physics engine with no gravity
          engine = Engine.create();
          world = engine.world;
          engine.world.gravity.y = 0; // 无重力，只有风力

          p.textFont("monospace");
          p.textSize(16);
          p.textAlign(p.LEFT, p.BASELINE); // 文字左对齐

          // Initialize characters with positions
          initializeCharacters();
        };

        const initializeCharacters = () => {
          characters = [];
          floatingChars = [];
          floatCount = 0;
          allFloatedTime = 0;
          isResetting = false;
          resetQueue = [];

          // Calculate text layout for left alignment with better line breaking
          const maxCharsPerLine = Math.floor((p.width - 40) / charWidth);
          const lines = [];
          let currentLine = "";

          // Better line breaking logic for Chinese text
          for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Add current character to line
            currentLine += char;

            // Check if we should break the line
            const shouldBreak =
              currentLine.length >= maxCharsPerLine || // Line is full
              (char === "。" && currentLine.length > 8) || // End of sentence, not too short
              (char === "，" && currentLine.length > maxCharsPerLine * 0.6) || // Comma break point
              ((char === "？" || char === "！") && currentLine.length > 8) || // Question/exclamation
              (currentLine.length > maxCharsPerLine * 0.8 &&
                (char === "的" ||
                  char === "了" ||
                  char === "着" ||
                  char === "过")); // Common word endings

            if (shouldBreak) {
              lines.push(currentLine);
              currentLine = "";
            }
          }
          if (currentLine) lines.push(currentLine);

          // Calculate starting position for vertical centering, left alignment
          const totalHeight = lines.length * lineHeight;
          const startY = (p.height - totalHeight) / 2 + lineHeight;
          const leftMargin = 20; // 左边距

          let charIndex = 0;
          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              const x = leftMargin + i * charWidth; // 左对齐
              const y = startY + lineIndex * lineHeight;

              characters.push({
                char: char,
                originalX: x,
                originalY: y,
                x: x,
                y: y,
                isFloating: false,
                isVisible: true, // 字符是否可见
                isFadingIn: false, // 是否正在渐入
                fadeInStartTime: 0, // 渐入开始时间
                alpha: 255,
                index: charIndex,
                body: null, // Matter.js body will be created when falling starts
              });

              charIndex++;
            }
          }
        };

        const startFloating = (clickedIndex: number) => {
          // 找到"回忆"两个字的索引
          const memoryIndices: number[] = [];
          for (let i = 0; i < characters.length; i++) {
            if (characters[i].char === "回" || characters[i].char === "忆") {
              memoryIndices.push(i);
            }
          }

          // 从点击的字符开始，创建所有未飞走字符的队列（除了"回忆"）
          floatQueue = [];
          for (let i = 0; i < characters.length; i++) {
            if (!characters[i].isFloating && !memoryIndices.includes(i)) {
              floatQueue.push(i);
            }
          }

          // 打乱队列，让飞走顺序随机
          for (let i = floatQueue.length - 1; i > 0; i--) {
            const j = Math.floor(p.random() * (i + 1));
            [floatQueue[i], floatQueue[j]] = [floatQueue[j], floatQueue[i]];
          }

          // 确保点击的字符第一个飞走（如果不是"回忆"）
          if (!memoryIndices.includes(clickedIndex)) {
            const clickedPos = floatQueue.indexOf(clickedIndex);
            if (clickedPos > 0) {
              floatQueue[clickedPos] = floatQueue[0];
              floatQueue[0] = clickedIndex;
            }
          }

          // 将"回忆"添加到队列最后
          floatQueue.push(...memoryIndices);

          // floatStartTime = p.millis() // Removed unused assignment
          lastFloatTime = p.millis();
          isFloating = true;

          // 立即让第一个字符开始飞走
          if (floatQueue.length > 0) {
            triggerCharacterFloat(floatQueue[0]);
            floatQueue.shift();
          }
        };

        const triggerCharacterFloat = (charIndex: number) => {
          const char = characters[charIndex];
          if (!char || char.isFloating) return;

          char.isFloating = true;

          // 创建Matter.js物理体，用于风吹效果
          char.body = Bodies.rectangle(char.x, char.y, charWidth, charHeight, {
            restitution: 0, // 无弹性
            friction: 0, // 无摩擦力，让文字更容易飘动
            frictionAir: 0.1, // 增加空气阻力，让移动更缓慢
            density: 0.0001, // 很轻的密度，容易被风吹动
          });

          // 主要向右飞行，带一点随机性
          const rightwardBias = p.random(0.6, 1.0); // 向右的倾向
          const verticalVariation = p.random(-0.3, 0.3); // 垂直方向的变化
          char.windDirection = Math.atan2(verticalVariation, rightwardBias);
          char.windStrength = p.random(0.8, 1.2);
          char.floatStartTime = p.millis();

          World.add(world, char.body);
          floatingChars.push(char);
          char.isVisible = false; // 飞走时隐藏原位置的字符
        };

        const startReset = () => {
          // 清理所有飞走的字符
          for (const char of floatingChars) {
            if (char.body) {
              World.remove(world, char.body);
              char.body = null;
            }
          }
          floatingChars = [];

          // 创建重置队列，包含所有字符
          resetQueue = [];
          for (let i = 0; i < characters.length; i++) {
            resetQueue.push(i);
          }

          // 打乱重置顺序
          for (let i = resetQueue.length - 1; i > 0; i--) {
            const j = Math.floor(p.random() * (i + 1));
            [resetQueue[i], resetQueue[j]] = [resetQueue[j], resetQueue[i]];
          }

          isResetting = true;
          lastResetTime = p.millis();
        };

        const resetCharacter = (charIndex: number) => {
          const char = characters[charIndex];
          if (!char) return;

          // 重置字符状态，开始渐入动画
          char.isFloating = false;
          char.isVisible = true;
          char.isFadingIn = true;
          char.fadeInStartTime = p.millis();
          char.alpha = 0; // 从完全透明开始
          char.x = char.originalX;
          char.y = char.originalY;

          if (char.body) {
            World.remove(world, char.body);
            char.body = null;
          }
        };

        p.draw = () => {
          p.background(255);
          p.fill(0);
          p.noStroke();

          // 随机触发字符飞走
          if (isFloating && floatQueue.length > 0) {
            const currentTime = p.millis();
            const timeSinceLastFloat = currentTime - lastFloatTime;

            // 检查是否只剩下"回忆"两个字
            const remainingNonMemoryChars = floatQueue.filter((index) => {
              const char = characters[index].char;
              return char !== "回" && char !== "忆";
            });

            let nextFloatDelay: number;
            let numToFloat: number;

            if (remainingNonMemoryChars.length === 0) {
              // 只剩下"回忆"时，等待更长时间再让它们飞走
              nextFloatDelay = 3000; // 3秒延迟
              numToFloat = Math.min(floatQueue.length, 2); // 一次飞走两个
            } else {
              // 正常情况：随机间隔和数量，随时间递增
              nextFloatDelay = p.random(500, 2000);
              const baseCount = 2;
              const progressiveCount = Math.min(
                13,
                Math.floor(floatCount * 0.8)
              ); // 随时间增加，最多13个
              numToFloat = Math.min(
                remainingNonMemoryChars.length,
                baseCount + progressiveCount
              );
            }

            if (timeSinceLastFloat > nextFloatDelay) {
              for (let i = 0; i < numToFloat; i++) {
                if (floatQueue.length > 0) {
                  triggerCharacterFloat(floatQueue[0]);
                  floatQueue.shift();
                }
              }

              floatCount++;
              lastFloatTime = currentTime;
            }

            // 如果队列空了，记录所有字符飞走的时间
            if (floatQueue.length === 0) {
              isFloating = false;
              allFloatedTime = p.millis();
            }
          }

          // 检查是否需要开始重置
          if (!isFloating && !isResetting && allFloatedTime > 0) {
            const timeSinceAllFloated = p.millis() - allFloatedTime;
            if (timeSinceAllFloated > 2000) {
              // 2秒后开始重置
              startReset();
            }
          }

          // 处理重置过程
          if (isResetting && resetQueue.length > 0) {
            const currentTime = p.millis();
            const timeSinceLastReset = currentTime - lastResetTime;

            if (timeSinceLastReset > p.random(50, 200)) {
              // 随机间隔50-200毫秒
              const numToReset = Math.min(
                resetQueue.length,
                Math.floor(p.random(1, 4))
              ); // 1-3个字符

              for (let i = 0; i < numToReset; i++) {
                if (resetQueue.length > 0) {
                  const charIndex = resetQueue.shift();
                  if (charIndex !== undefined) {
                    resetCharacter(charIndex);
                  }
                }
              }

              lastResetTime = currentTime;
            }

            if (resetQueue.length === 0) {
              isResetting = false;
              // 重置完成后，清理所有状态，回到初始状态
              floatCount = 0;
              allFloatedTime = 0;
              lastFloatTime = 0;
            }
          }

          // Apply gentle wind effects to floating characters
          for (const char of floatingChars) {
            if (char.body && char.floatStartTime !== undefined && char.windDirection !== undefined && char.windStrength !== undefined) {
              const elapsed = p.millis() - char.floatStartTime;

              // 基础风力 - 主要向右，轻微向上或向下
              const baseWindForce = 0.00003;

              // 每个字符有自己的风向和强度（主要向右）
              const personalWindX =
                Math.cos(char.windDirection) *
                baseWindForce *
                char.windStrength;
              const personalWindY =
                Math.sin(char.windDirection) *
                baseWindForce *
                char.windStrength *
                0.5; // 垂直方向减半

              // 轻微的全局风力变化
              const globalWindX = p.sin(p.millis() * 0.001) * 0.000005;
              const globalWindY = p.cos(p.millis() * 0.0008) * 0.000003;

              // 很小的随机扰动
              const randomWindX =
                (p.noise(char.index * 0.1, p.millis() * 0.0002) - 0.5) *
                0.000002;
              const randomWindY =
                (p.noise(char.index * 0.1 + 100, p.millis() * 0.0002) - 0.5) *
                0.000002;

              // 总风力 - 主要向右飘
              const totalWindX = personalWindX + globalWindX + randomWindX;
              const totalWindY = personalWindY + globalWindY + randomWindY;

              // 施加风力
              Body.applyForce(char.body, char.body.position, {
                x: totalWindX,
                y: totalWindY,
              });

              // 缓慢淡出效果
              if (elapsed > 1500) {
                // 1.5秒后开始淡出
                const fadeProgress = Math.min(1, (elapsed - 1500) / 6000); // 6秒内完全淡出
                char.alpha = 255 * (1 - fadeProgress);
              }
            }
          }

          // Update physics engine
          Engine.update(engine);

          // Update and draw floating characters
          for (const char of floatingChars) {
            if (char.body) {
              // 更新字符位置为物理体位置
              char.x = char.body.position.x;
              char.y = char.body.position.y;
            }

            p.fill(0, char.alpha);
            p.text(char.char, char.x, char.y);
          }

          // Update fade-in animations and draw static characters
          for (const char of characters) {
            if (!char.isFloating && char.isVisible) {
              // 处理渐入动画
              if (char.isFadingIn) {
                const elapsed = p.millis() - char.fadeInStartTime;
                const fadeInDuration = 800; // 800毫秒渐入时间

                if (elapsed < fadeInDuration) {
                  // 使用缓动函数让渐入更自然
                  const progress = elapsed / fadeInDuration;
                  const easedProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
                  char.alpha = 255 * easedProgress;
                } else {
                  // 渐入完成，恢复到初始状态
                  char.alpha = 255;
                  char.isFadingIn = false;
                  char.fadeInStartTime = 0;
                }
              }

              // 只有在非渐入状态或渐入完成时才绘制稳定的文字
              if (!char.isFadingIn) {
                p.fill(0, 255); // 完全不透明
              } else {
                p.fill(0, char.alpha); // 渐入过程中使用动态透明度
              }
              p.text(char.char, char.x, char.y);
            }
          }

          // Characters float away and fade out
        };

        p.mousePressed = () => {
          // 只有在非重置状态下才能点击
          if (isResetting) return;

          // Find any character to trigger floating
          for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            if (
              !char.isFloating &&
              char.isVisible &&
              p.mouseX >= char.x - charWidth / 2 &&
              p.mouseX <= char.x + charWidth / 2 &&
              p.mouseY >= char.y - charHeight / 2 &&
              p.mouseY <= char.y + charHeight / 2
            ) {
              startFloating(i);
              break;
            }
          }
        };

        p.windowResized = () => {
          const container = containerRef.current;
          if (container) {
            const rect = container.getBoundingClientRect();
            p.resizeCanvas(rect.width, rect.height);

            // Recreate physics world without boundaries
            World.clear(world, false);
            Engine.clear(engine);

            initializeCharacters();
          }
        };
      };

      // Create p5 instance
      p5InstanceRef.current = new p5(sketch, containerRef.current);
    };

    loadLibraries();

    // Cleanup function
    return () => {
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
        p5InstanceRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <h1 className="text-sm font-mono font-bold mb-4">Memory Fade</h1>
      <div className="w-80 h-80 xl:w-100 xl:h-100  border border-black">
        <div ref={containerRef} className="w-full h-full" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs font-mono text-gray-600 max-w-md text-center">
          点击文字让记忆开始消散 / Click on text to start memory fade
        </p>
      </div>
    </>
  );
}
