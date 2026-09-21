import { siteConfig } from '../config/site';

export const absoluteUrl = (path: string) => `${siteConfig.siteUrl}${path === '/' ? '/' : path}`;

export const mailto = (email: string, subject?: string) =>
  `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
