import type { ComponentType, ElementType, ReactNode } from 'react';
import { m, type HTMLMotionProps, type Variants } from 'motion/react';
import type { SxProps, Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';

const EASE = [0.22, 1, 0.36, 1] as const;

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const groupVariants = (stagger: number, delay: number): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

type MotionBoxProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children?: ReactNode;
  component?: ElementType;
  sx?: SxProps<Theme>;
};

/** Box with motion props; keeps MUI's `sx` and `component` for semantic list/section elements. */
export const MotionBox = m.create(Box) as unknown as ComponentType<MotionBoxProps>;

interface RevealProps {
  children: ReactNode;
  delay?: number;
  /** Vertical travel in px. Use 0 for a pure fade. */
  y?: number;
  sx?: SxProps<Theme>;
  component?: 'div' | 'section' | 'li' | 'article' | 'header';
}

/**
 * Fades and slides content in the first time it scrolls into view.
 * MotionConfig reducedMotion="user" (App.tsx) turns the transform off for reduced-motion users.
 */
export function Reveal({ children, delay = 0, y = 24, sx, component = 'div' }: RevealProps) {
  return (
    <MotionBox
      component={component}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      sx={sx}
    >
      {children}
    </MotionBox>
  );
}

interface RevealGroupProps {
  children: ReactNode;
  stagger?: number;
  delay?: number;
  sx?: SxProps<Theme>;
  component?: 'div' | 'ul' | 'ol';
}

/** Parent for staggered entrances; direct children should be <RevealItem>. */
export function RevealGroup({ children, stagger = 0.08, delay = 0, sx, component = 'div' }: RevealGroupProps) {
  return (
    <MotionBox
      component={component}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={groupVariants(stagger, delay)}
      sx={sx}
    >
      {children}
    </MotionBox>
  );
}

interface RevealItemProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
  component?: 'div' | 'li' | 'article';
}

export function RevealItem({ children, sx, component = 'div' }: RevealItemProps) {
  return (
    <MotionBox component={component} variants={itemVariants} sx={sx}>
      {children}
    </MotionBox>
  );
}
