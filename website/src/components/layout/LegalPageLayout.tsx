import { Fragment, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import PageHero from './PageHero';
import OwnerNote, { Placeholder } from '../common/OwnerNote';
import type { LegalBlock, LegalDocument } from '../../types';
import { siteConfig } from '../../config/site';
import { mailto } from '../../utils/url';

/** Replaces {{tokens}} in legal copy with real values, email links, or visible placeholders. */
function renderText(text: string): ReactNode {
  const parts = text.split(/(\{\{\w+\}\})/g);
  return parts.map((part, i) => {
    switch (part) {
      case '{{operator}}':
        return siteConfig.legal.operatorName ?? <Placeholder key={i}>operator’s legal name</Placeholder>;
      case '{{governingLaw}}':
        return siteConfig.legal.governingLaw ?? <Placeholder key={i}>governing jurisdiction</Placeholder>;
      case '{{address}}':
        return siteConfig.legal.postalAddress ?? <Placeholder key={i}>postal address</Placeholder>;
      case '{{privacyEmail}}':
        return (
          <Link key={i} href={mailto(siteConfig.privacyEmail)}>
            {siteConfig.privacyEmail}
          </Link>
        );
      case '{{supportEmail}}':
        return (
          <Link key={i} href={mailto(siteConfig.supportEmail)}>
            {siteConfig.supportEmail}
          </Link>
        );
      default:
        return <Fragment key={i}>{part}</Fragment>;
    }
  });
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'owner') return <OwnerNote>{renderText(block.text)}</OwnerNote>;
  if (block.type === 'list')
    return (
      <Box component="ul" sx={{ pl: 3, my: 2, display: 'grid', gap: 1, '& li::marker': { color: 'primary.main' } }}>
        {block.items.map((item) => (
          <Typography component="li" key={item} sx={{ color: 'text.secondary', lineHeight: 1.75 }}>
            {renderText(item)}
          </Typography>
        ))}
      </Box>
    );
  return <Typography sx={{ color: 'text.secondary', lineHeight: 1.8, my: 2 }}>{renderText(block.text)}</Typography>;
}

function TableOfContents({ doc }: { doc: LegalDocument }) {
  const list = (
    <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 0.25, counterReset: 'toc' }}>
      {doc.sections.map((s) => (
        <li key={s.id}>
          <Link
            href={`#${s.id}`}
            underline="none"
            sx={{
              display: 'flex',
              gap: 1.25,
              py: 0.9,
              px: 1.5,
              borderRadius: 2,
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'text.secondary',
              lineHeight: 1.4,
              counterIncrement: 'toc',
              '&::before': { content: 'counter(toc, decimal-leading-zero)', color: 'text.disabled', fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
              '&:hover': { color: 'text.primary', bgcolor: 'elevated' },
            }}
          >
            {s.title}
          </Link>
        </li>
      ))}
    </Box>
  );

  return (
    <>
      {/* Collapsible on small screens so long documents stay easy to navigate. */}
      <Box
        component="details"
        sx={{
          display: { lg: 'none' },
          mb: 5,
          borderRadius: 4,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          '&[open] summary svg': { transform: 'rotate(180deg)' },
        }}
      >
        <Box
          component="summary"
          sx={{ listStyle: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, px: 2.5, fontWeight: 600, '&::-webkit-details-marker': { display: 'none' } }}
        >
          On this page
          <ExpandMoreRounded sx={{ transition: 'transform 200ms ease' }} aria-hidden />
        </Box>
        <Box sx={{ px: 1, pb: 1.5 }}>{list}</Box>
      </Box>

      <Box component="nav" aria-label="On this page" sx={{ display: { xs: 'none', lg: 'block' }, position: 'sticky', top: 100, maxHeight: 'calc(100dvh - 120px)', overflowY: 'auto' }}>
        <Typography variant="overline" component="p" sx={{ color: 'text.primary', px: 1.5, mb: 1 }}>
          On this page
        </Typography>
        {list}
      </Box>
    </>
  );
}

interface LegalPageLayoutProps {
  doc: LegalDocument;
  eyebrow: string;
}

export default function LegalPageLayout({ doc, eyebrow }: LegalPageLayoutProps) {
  const effective = siteConfig.legal.effectiveDate;
  return (
    <>
      <PageHero eyebrow={eyebrow} title={doc.title} description={doc.summary} align="left">
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Effective date:{' '}
          {effective ? (
            <time dateTime={effective}>{new Date(effective).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
          ) : (
            <Placeholder>to be set by the app owner</Placeholder>
          )}
        </Typography>
      </PageHero>

      <Container sx={{ pb: { xs: 10, md: 14 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '260px minmax(0, 1fr)' }, gap: { lg: 8 }, alignItems: 'start' }}>
          <TableOfContents doc={doc} />
          <Box component="article" sx={{ maxWidth: 760, minWidth: 0 }}>
            <OwnerNote>
              this document was drafted from the app’s current functionality. Placeholders marked like this must be completed, and the full text should be reviewed by
              qualified legal counsel before publication.
            </OwnerNote>
            {doc.sections.map((section, i) => (
              <Box component="section" key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} sx={{ scrollMarginTop: 96, pt: { xs: 4, md: 5 } }}>
                <Typography id={`${section.id}-title`} variant="h4" component="h2" sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                  <Box component="span" sx={{ color: 'primary.main', fontSize: '0.8em', fontVariantNumeric: 'tabular-nums' }}>
                    {String(i + 1).padStart(2, '0')}
                  </Box>
                  {section.title}
                </Typography>
                {section.blocks.map((block, j) => (
                  <Block key={j} block={block} />
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </>
  );
}
