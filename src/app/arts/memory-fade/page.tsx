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
  windDirection: number;
  windStrength: number;
  floatStartTime: number;
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
        // Constants
        const PHYSICS_CONSTANTS = {
          BASE_WIND_FORCE: 0.00003,
          GLOBAL_WIND_VARIATION: 0.000005,
          RANDOM_WIND_VARIATION: 0.000002,
          FRICTION_AIR: 0.1,
          DENSITY: 0.0001,
        } as const;

        const TIMING_CONSTANTS = {
          FADE_START_DELAY: 1500,
          FADE_DURATION: 6000,
          FADE_IN_DURATION: 800,
          RESET_DELAY: 2000,
          MEMORY_FLOAT_DELAY: 3000,
          MIN_FLOAT_INTERVAL: 500,
          MAX_FLOAT_INTERVAL: 2000,
          MIN_RESET_INTERVAL: 50,
          MAX_RESET_INTERVAL: 200,
        } as const;

        const WIND_CONSTANTS = {
          MIN_RIGHTWARD_BIAS: 0.6,
          MAX_RIGHTWARD_BIAS: 1.0,
          MIN_VERTICAL_VARIATION: -0.3,
          MAX_VERTICAL_VARIATION: 0.3,
          MIN_WIND_STRENGTH: 0.8,
          MAX_WIND_STRENGTH: 1.2,
          VERTICAL_REDUCTION_FACTOR: 0.5,
        } as const;

        // Text content
        const text =
          "因为不知死何时将至，我们仍将生命视为无穷无尽、取之不竭的源泉。然而，一生所遇之事也许就只发生那么几次。曾经左右过我们人生的童年回忆浮现在心头的时刻还能有多少次呢？也许还能有四五次。目睹满月升起的时刻又还能有多少次呢？或许最多还能有二十次。但人们总是深信这些机会将无穷无尽。";
        let characters: Character[] = [];
        let floatingChars: Character[] = [];

        let isFloating = false;
        let floatQueue: number[] = []; // Queue of character indices waiting to float away
        let lastFloatTime = 0;
        let floatCount = 0; // Count of batches that have floated away
        let allFloatedTime = 0; // Time when all characters have floated away
        let isResetting = false; // Whether currently resetting
        let resetQueue: number[] = []; // Queue for character appearance during reset
        let lastResetTime = 0;

        // Matter.js physics engine
        let engine: Matter.Engine;
        let world: Matter.World;

        // Layout parameters
        const lineHeight = 24;
        const charWidth = 16;
        const charHeight = 16;

        // Utility functions
        const shuffleArray = (array: number[]): void => {
          for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(p.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
          }
        };

        const findMemoryCharacterIndices = (): number[] => {
          const memoryIndices: number[] = [];
          for (let i = 0; i < characters.length; i++) {
            if (characters[i].char === "回" || characters[i].char === "忆") {
              memoryIndices.push(i);
            }
          }
          return memoryIndices;
        };

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
          engine.world.gravity.y = 0; // No gravity, only wind force

          p.textFont("sans");
          p.textSize(13);
          p.textAlign(p.LEFT, p.BASELINE); // Left-align text

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
          const leftMargin = 20; // Left margin

          let charIndex = 0;
          for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              const x = leftMargin + i * charWidth; // Left-aligned
              const y = startY + lineIndex * lineHeight;

              characters.push({
                char: char,
                originalX: x,
                originalY: y,
                x: x,
                y: y,
                isFloating: false,
                isVisible: true, // Whether character is visible
                isFadingIn: false, // Whether currently fading in
                fadeInStartTime: 0, // Fade-in start time
                alpha: 255,
                index: charIndex,
                body: null, // Matter.js body will be created when floating starts
                windDirection: 0, // Will be set when floating starts
                windStrength: 1, // Will be set when floating starts
                floatStartTime: 0, // Will be set when floating starts
              });

              charIndex++;
            }
          }
        };

        const startFloating = (clickedIndex: number) => {
          // Find indices of the characters "回忆" (memory)
          const memoryIndices = findMemoryCharacterIndices();

          // Create queue of all non-floating characters (except "回忆")
          floatQueue = [];
          for (let i = 0; i < characters.length; i++) {
            if (!characters[i].isFloating && !memoryIndices.includes(i)) {
              floatQueue.push(i);
            }
          }

          // Shuffle queue to randomize floating order
          shuffleArray(floatQueue);

          // Ensure clicked character floats first (if not "回忆")
          if (!memoryIndices.includes(clickedIndex)) {
            const clickedPos = floatQueue.indexOf(clickedIndex);
            if (clickedPos > 0) {
              floatQueue[clickedPos] = floatQueue[0];
              floatQueue[0] = clickedIndex;
            }
          }

          // Add "回忆" to the end of queue
          floatQueue.push(...memoryIndices);

          lastFloatTime = p.millis();
          isFloating = true;

          // Immediately start floating the first character
          if (floatQueue.length > 0) {
            triggerCharacterFloat(floatQueue[0]);
            floatQueue.shift();
          }
        };

        const triggerCharacterFloat = (charIndex: number) => {
          const char = characters[charIndex];
          if (!char || char.isFloating) return;

          char.isFloating = true;

          // Create Matter.js physics body for wind effects
          char.body = Bodies.rectangle(char.x, char.y, charWidth, charHeight, {
            restitution: 0, // No elasticity
            friction: 0, // No friction, makes text easier to drift
            frictionAir: PHYSICS_CONSTANTS.FRICTION_AIR, // Increase air resistance for slower movement
            density: PHYSICS_CONSTANTS.DENSITY, // Very light density, easily blown by wind
          });

          // Mainly fly rightward with some randomness
          const rightwardBias = p.random(WIND_CONSTANTS.MIN_RIGHTWARD_BIAS, WIND_CONSTANTS.MAX_RIGHTWARD_BIAS); // Rightward tendency
          const verticalVariation = p.random(WIND_CONSTANTS.MIN_VERTICAL_VARIATION, WIND_CONSTANTS.MAX_VERTICAL_VARIATION); // Vertical variation
          char.windDirection = Math.atan2(verticalVariation, rightwardBias);
          char.windStrength = p.random(WIND_CONSTANTS.MIN_WIND_STRENGTH, WIND_CONSTANTS.MAX_WIND_STRENGTH);
          char.floatStartTime = p.millis();

          World.add(world, char.body);
          floatingChars.push(char);
          char.isVisible = false; // Hide character at original position when floating
        };

        const startReset = () => {
          // Clean up all floating characters
          for (const char of floatingChars) {
            if (char.body) {
              World.remove(world, char.body);
              char.body = null;
            }
          }
          floatingChars = [];

          // Create reset queue containing all characters
          resetQueue = [];
          for (let i = 0; i < characters.length; i++) {
            resetQueue.push(i);
          }

          // Shuffle reset order
          shuffleArray(resetQueue);

          isResetting = true;
          lastResetTime = p.millis();
        };

        const resetCharacter = (charIndex: number) => {
          const char = characters[charIndex];
          if (!char) return;

          // Reset character state and start fade-in animation
          char.isFloating = false;
          char.isVisible = true;
          char.isFadingIn = true;
          char.fadeInStartTime = p.millis();
          char.alpha = 0; // Start from completely transparent
          char.x = char.originalX;
          char.y = char.originalY;

          if (char.body) {
            World.remove(world, char.body);
            char.body = null;
          }
        };

        const processFloatingQueue = (currentTime: number) => {
          if (!isFloating || floatQueue.length === 0) return;

          const timeSinceLastFloat = currentTime - lastFloatTime;

          // Check if only "回忆" characters remain
          const remainingNonMemoryChars = floatQueue.filter((index) => {
            const char = characters[index].char;
            return char !== "回" && char !== "忆";
          });

          let nextFloatDelay: number;
          let numToFloat: number;

          if (remainingNonMemoryChars.length === 0) {
            // When only "回忆" remains, wait longer before letting them float
            nextFloatDelay = TIMING_CONSTANTS.MEMORY_FLOAT_DELAY;
            numToFloat = Math.min(floatQueue.length, 2); // Float two at once
          } else {
            // Normal case: random intervals and quantities, increasing over time
            nextFloatDelay = p.random(TIMING_CONSTANTS.MIN_FLOAT_INTERVAL, TIMING_CONSTANTS.MAX_FLOAT_INTERVAL);
            const baseCount = 2;
            const progressiveCount = Math.min(
              13,
              Math.floor(floatCount * 0.8)
            ); // Increase over time, maximum 13
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

          // If queue is empty, record the time when all characters floated away
          if (floatQueue.length === 0) {
            isFloating = false;
            allFloatedTime = currentTime;
          }
        };

        const processReset = (currentTime: number) => {
          // Check if reset needs to start
          if (!isFloating && !isResetting && allFloatedTime > 0) {
            const timeSinceAllFloated = currentTime - allFloatedTime;
            if (timeSinceAllFloated > TIMING_CONSTANTS.RESET_DELAY) {
              startReset();
            }
          }

          // Handle reset process
          if (isResetting && resetQueue.length > 0) {
            const timeSinceLastReset = currentTime - lastResetTime;

            if (timeSinceLastReset > p.random(TIMING_CONSTANTS.MIN_RESET_INTERVAL, TIMING_CONSTANTS.MAX_RESET_INTERVAL)) {
              const numToReset = Math.min(
                resetQueue.length,
                Math.floor(p.random(1, 4))
              ); // 1-3 characters

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
              // After reset completion, clean all states and return to initial state
              floatCount = 0;
              allFloatedTime = 0;
              lastFloatTime = 0;
            }
          }
        };

        const applyWindEffects = (currentTime: number) => {
          for (const char of floatingChars) {
            if (char.body && char.floatStartTime > 0) {
              const elapsed = currentTime - char.floatStartTime;

              // Each character has its own wind direction and strength (mainly rightward)
              const personalWindX =
                Math.cos(char.windDirection) *
                PHYSICS_CONSTANTS.BASE_WIND_FORCE *
                char.windStrength;
              const personalWindY =
                Math.sin(char.windDirection) *
                PHYSICS_CONSTANTS.BASE_WIND_FORCE *
                char.windStrength *
                WIND_CONSTANTS.VERTICAL_REDUCTION_FACTOR; // Vertical direction halved

              // Slight global wind force variation
              const globalWindX = p.sin(currentTime * 0.001) * PHYSICS_CONSTANTS.GLOBAL_WIND_VARIATION;
              const globalWindY = p.cos(currentTime * 0.0008) * PHYSICS_CONSTANTS.GLOBAL_WIND_VARIATION * 0.6;

              // Very small random perturbation
              const randomWindX =
                (p.noise(char.index * 0.1, currentTime * 0.0002) - 0.5) *
                PHYSICS_CONSTANTS.RANDOM_WIND_VARIATION;
              const randomWindY =
                (p.noise(char.index * 0.1 + 100, currentTime * 0.0002) - 0.5) *
                PHYSICS_CONSTANTS.RANDOM_WIND_VARIATION;

              // Total wind force - mainly drifting rightward
              const totalWindX = personalWindX + globalWindX + randomWindX;
              const totalWindY = personalWindY + globalWindY + randomWindY;

              // Apply wind force
              Body.applyForce(char.body, char.body.position, {
                x: totalWindX,
                y: totalWindY,
              });

              // Slow fade-out effect
              if (elapsed > TIMING_CONSTANTS.FADE_START_DELAY) {
                const fadeProgress = Math.min(1, (elapsed - TIMING_CONSTANTS.FADE_START_DELAY) / TIMING_CONSTANTS.FADE_DURATION);
                char.alpha = 255 * (1 - fadeProgress);
              }
            }
          }
        };

        const renderStaticCharacters = (currentTime: number) => {
          for (const char of characters) {
            if (!char.isFloating && char.isVisible) {
              // Handle fade-in animation
              if (char.isFadingIn) {
                const elapsed = currentTime - char.fadeInStartTime;

                if (elapsed < TIMING_CONSTANTS.FADE_IN_DURATION) {
                  // Use easing function for more natural fade-in
                  const progress = elapsed / TIMING_CONSTANTS.FADE_IN_DURATION;
                  const easedProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
                  char.alpha = 255 * easedProgress;
                } else {
                  // Fade-in complete, restore to initial state
                  char.alpha = 255;
                  char.isFadingIn = false;
                  char.fadeInStartTime = 0;
                }
              }

              // Only draw stable text when not fading in or fade-in is complete
              if (!char.isFadingIn) {
                p.fill(0, 255); // Completely opaque
              } else {
                p.fill(0, char.alpha); // Use dynamic transparency during fade-in
              }
              p.text(char.char, char.x, char.y);
            }
          }
        };

        p.draw = () => {
          p.background(255);
          p.fill(0);
          p.noStroke();

          const currentTime = p.millis();

          // Process floating queue
          processFloatingQueue(currentTime);

          // Check if reset needs to start and handle reset process
          processReset(currentTime);

          // Apply gentle wind effects to floating characters
          applyWindEffects(currentTime);

          // Update physics engine
          Engine.update(engine);

          // Update and draw floating characters
          for (const char of floatingChars) {
            if (char.body) {
              // Update character position to physics body position
              char.x = char.body.position.x;
              char.y = char.body.position.y;
            }

            p.fill(0, char.alpha);
            p.text(char.char, char.x, char.y);
          }

          // Update fade-in animations and draw static characters
          renderStaticCharacters(currentTime);

        };

        p.mousePressed = () => {
          // Only allow clicks when not in reset state
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
      <p className="text-xs font-mono text-gray-600 max-w-md text-center">
        Click on text to start memory fade / 点击文字让记忆开始消散
      </p>
    </>
  );
}
