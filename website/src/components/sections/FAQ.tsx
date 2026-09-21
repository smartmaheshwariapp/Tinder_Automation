import { useState, type SyntheticEvent } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AddRounded from '@mui/icons-material/AddRounded';
import { SectionContainer, SectionHeading } from '../common/Section';
import { RevealGroup, RevealItem } from '../common/Reveal';
import type { Faq } from '../../types';

interface FAQProps {
  items: Faq[];
  tone?: 'default' | 'subtle';
}

export default function FAQ({ items, tone = 'subtle' }: FAQProps) {
  const [expanded, setExpanded] = useState<number | false>(0);
  const handleChange = (index: number) => (_: SyntheticEvent, isExpanded: boolean) => setExpanded(isExpanded ? index : false);

  return (
    <SectionContainer id="faq" tone={tone} maxWidth="md" labelledBy="faq-heading">
      <SectionHeading id="faq-heading" eyebrow="FAQ" title="Questions," highlight="answered" description="How Flint works, what it needs from you and where its limits are." />
      <RevealGroup stagger={0.05} sx={{ display: 'grid', gap: 1.5 }}>
        {items.map((item, i) => (
          <RevealItem key={item.question}>
            <Accordion expanded={expanded === i} onChange={handleChange(i)} slotProps={{ heading: { component: 'h3' }, transition: { unmountOnExit: false } }}>
              <AccordionSummary
                id={`faq-${i}-header`}
                aria-controls={`faq-${i}-content`}
                expandIcon={
                  <Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'elevated', color: 'text.primary' }}>
                    <AddRounded fontSize="small" />
                  </Box>
                }
                sx={{ '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': { transform: 'rotate(45deg)' } }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: { xs: '1rem', md: '1.0625rem' }, pr: 2 }}>{item.question}</Typography>
              </AccordionSummary>
              <AccordionDetails id={`faq-${i}-content`}>
                <Typography variant="body1" color="text.secondary">
                  {item.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          </RevealItem>
        ))}
      </RevealGroup>
    </SectionContainer>
  );
}
