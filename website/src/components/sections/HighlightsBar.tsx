import { fonts } from '../../theme/tokens';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import PhoneIphoneRounded from '@mui/icons-material/PhoneIphoneRounded';
import RecordVoiceOverRounded from '@mui/icons-material/RecordVoiceOverRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import { RevealGroup, RevealItem } from '../common/Reveal';

/** Factual product highlights taken from app.json and the app's settings. */
const HIGHLIGHTS = [
  { Icon: LocalFireDepartmentRounded, value: 'Tinder', label: 'Supported platform' },
  { Icon: PhoneIphoneRounded, value: 'iOS & Android', label: 'Built with Expo' },
  { Icon: RecordVoiceOverRounded, value: '10 tones', label: 'For openers & replies' },
  { Icon: ShieldRounded, value: 'Safety Mode', label: 'Hourly limits built in' },
];

export default function HighlightsBar() {
  return (
    <Box component="section" aria-label="Flint at a glance" sx={{ borderBlock: 1, borderColor: 'divider', bgcolor: 'background.subtle' }}>
      <Container>
        <RevealGroup
          component="ul"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          }}
        >
          {HIGHLIGHTS.map(({ Icon, value, label }, i) => (
            <RevealItem
              key={value}
              component="li"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 1.5, sm: 2 },
                py: { xs: 2.5, md: 3.5 },
                px: { xs: 1, sm: 2, md: 3 },
                borderLeft: { xs: i % 2 === 1 ? 1 : 0, md: i > 0 ? 1 : 0 },
                borderTop: { xs: i > 1 ? 1 : 0, md: 0 },
                borderColor: 'divider',
                minWidth: 0,
              }}
            >
              <Box sx={{ width: 40, height: 40, borderRadius: 3, display: { xs: 'none', sm: 'grid' }, placeItems: 'center', bgcolor: 'elevated', color: 'primary.main', flexShrink: 0 }}>
                <Icon fontSize="small" aria-hidden />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontFamily: fonts.heading, fontWeight: 800, fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' }, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                  {value}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8125rem', sm: '0.875rem' } }}>
                  {label}
                </Typography>
              </Box>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </Box>
  );
}
