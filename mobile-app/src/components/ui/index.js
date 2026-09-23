// Flint UI kit — shared primitives built on src/theme. Import from '../components/ui'.
import React from 'react';
import FeedbackState from '../common/FeedbackState';

export { default as AppLogo } from './AppLogo';
export { default as AppText } from './AppText';
export { default as AppButton } from './AppButton';
export { default as IconButton } from './IconButton';
export { default as IconWell } from './IconWell';
export { default as Card } from './Card';
export { default as Badge } from './Badge';
export { default as Chip } from './Chip';
export { default as ListRow } from './ListRow';
export { default as SectionHeader } from './SectionHeader';
export { default as ScreenHeader } from './ScreenHeader';
export { default as Screen } from './Screen';
export { default as Skeleton, SkeletonRow } from './Skeleton';
export { default as Divider } from './Divider';
export { default as CountUp } from './CountUp';
export { default as LiveDot } from './LiveDot';
export { default as BottomSheet } from './BottomSheet';
export { FeedbackState };
export { MotionTouchable, FocusInput, FadeIn, ContentTransition } from '../common/Motion';

export const LoadingState = props => <FeedbackState kind="loading" title="Loading…" {...props} />;
export const EmptyState = props => <FeedbackState kind="empty" {...props} />;
export const ErrorState = props => <FeedbackState kind="error" title="Something went wrong" {...props} />;
