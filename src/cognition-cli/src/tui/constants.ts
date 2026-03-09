export const SIGMA_LOGO = `   █████████     ███████      █████████  ██████   █████ █████ ███████████ █████    ███████    ██████   █████
  ███░░░░░███  ███░░░░░███   ███░░░░░███░░██████ ░░███ ░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
 ███     ░░░  ███     ░░███ ███     ░░░  ░███░███ ░███  ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
░███         ░███      ░███░███          ░███░░███░███  ░███     ░███     ░███ ░███      ░███ ░███░░███░███
░███         ░███      ░███░███    █████ ░███ ░░██████  ░███     ░███     ░███ ░███      ░███ ░███ ░░██████
░░███     ███░░███     ███ ░░███  ░░███  ░███  ░░█████  ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
 ░░█████████  ░░░███████░   ░░█████████  █████  ░░█████ █████    █████    █████ ░░░███████░   █████  ░░█████
  ░░░░░░░░░     ░░░░░░░      ░░░░░░░░░  ░░░░░    ░░░░░ ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░



  █████████  █████   █████████  ██████   ██████   █████████                    █████████  █████       █████
 ███░░░░░███░░███   ███░░░░░███░░██████ ██████   ███░░░░░███                  ███░░░░░███░░███       ░░███
░███    ░░░  ░███  ███     ░░░  ░███░█████░███  ░███    ░███                 ███     ░░░  ░███        ░███
░░█████████  ░███ ░███          ░███░░███ ░███  ░███████████                ░███          ░███        ░███
 ░░░░░░░░███ ░███ ░███    █████ ░███ ░░░  ░███  ░███░░░░░███                ░███          ░███        ░███
 ███    ░███ ░███ ░░███  ░░███  ░███      ░███  ░███    ░███                ░░███     ███ ░███      █ ░███
░░█████████  █████ ░░█████████  █████     █████ █████   █████                ░░█████████  ███████████ █████
 ░░░░░░░░░  ░░░░░   ░░░░░░░░░  ░░░░░     ░░░░░ ░░░░░   ░░░░░                  ░░░░░░░░░  ░░░░░░░░░░░ ░░░░░`;

/**
 * SIGGY_ANIMATIONS defines the frames and intervals for Siggy's animations.
 *
 * Each animation is an object with:
 * - frames: An array of strings representing the frames of the animation.
 *   CRITICAL: Each frame string MUST be exactly 12 characters long (including padding).
 *   This ensures consistent alignment and prevents terminal ghosting.
 * - interval: The time in milliseconds between frames.
 */
export const SIGGY_ANIMATIONS = {
  idle: {
    frames: [
      '( -_-)      ', // Closed
      '( •_•)      ', // Neutral
      '( o_o)      ', // Wide
      '( •_•)      ', // Neutral
    ],
    interval: 500,
  },
  processing: {
    frames: [
      '( -_-)      ', // Closed
      '( o_o)      ', // Half-open
      '( O_o)      ', // Left-wide
      '( O_O)      ', // Both-wide (Alert)
      '( o_O)      ', // Right-wide
      '( o_o)      ', // Half-open
      '( •_•)      ', // Neutral
    ],
    interval: 100,
  },
  executing: {
    frames: [
      '( •_•)      ', // Neutral
      '( •_•) ⌐■-■ ', // Lowered glasses
      '( •_•)⌐■-■  ', // Mid-level glasses
      '(⌐■_■)      ', // Glasses on
      '(⌐■_■) .    ',
      '(⌐■_■) ..   ',
      '(⌐■_■) ...  ',
      '(⌐■_■)✧     ', // Shine
    ],
    interval: 150,
  },
  success: {
    frames: [
      '( ^_^)      ', // Happy
      '/(^_^)\\     ', // Shoulders up
      '\\(^_^)/     ', // Hands up
      '/(^_^)\\     ', // Shoulders up
      '( ^_^)      ', // Happy
      '(•̀ω•́)✧      ', // Confident shine (start)
      '(•̀ω•́)✧      ', // Confident shine (hold)
      '(•̀ω•́)✧      ', // Confident shine (shine)
    ],
    interval: 150,
  },
  error: {
    frames: [
      '( ;_ ;)     ', // Crying
      '( >_< )     ', // Pained (Centered)
      ' ( >_< )    ', // Jitter right
      '( >_< )     ', // Jitter left
      '(╥﹏╥)      ', // Hard crying
      '( ;_ ;)     ', // Recovering
    ],
    interval: 150,
  },
  typing: {
    frames: [
      '( ._.)      ', // Down (typing start)
      '( <_.)      ', // Typing left
      '( ._.)      ', // Down
      '( ._>)      ', // Typing right
      '( ._.)      ', // Down (typing end)
      '( •_•)      ', // Looking up
    ],
    interval: 150,
  },
  waiting: {
    frames: [
      '( -_-)      ', // Sleepy
      '( -o-)      ', // Small yawn
      '( -O-)      ', // Large yawn
      '( >O<)      ', // Wide yawn (Squeezed eyes)
      '( -O-)      ', // Large yawn
      '( -o-)      ', // Small yawn
      '( -_-)      ', // Sleepy
      '( =_=)      ', // Drowsy
      '( •_-)      ', // One eye open
      '( -_-)      ', // Sleepy
    ],
    interval: 400,
  },
  confirming: {
    frames: [
      '( ?_?)      ', // Head tilt left
      '( •_•)?     ', // Neutral tilt
      '(?_? )      ', // Head tilt right
      '( •_•)?     ', // Neutral tilt
    ],
    interval: 400,
  },
};

/**
 * Timeout in milliseconds of inactivity before transitioning from TYPING to IDLE.
 */
export const TYPING_IDLE_TIMEOUT = 500;
