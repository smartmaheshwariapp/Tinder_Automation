import { useState, type MouseEvent } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { useColorScheme } from '@mui/material/styles';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import ContrastRounded from '@mui/icons-material/ContrastRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';

type Mode = 'light' | 'dark' | 'system';

const OPTIONS: { value: Mode; label: string; Icon: typeof DarkModeRounded }[] = [
  { value: 'system', label: 'System', Icon: ContrastRounded },
  { value: 'light', label: 'Light', Icon: LightModeRounded },
  { value: 'dark', label: 'Dark', Icon: DarkModeRounded },
];

/** Light / dark / system switcher. MUI persists the choice in localStorage ("flint-color-mode"). */
export default function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const resolved = mode === 'system' ? systemMode : mode;
  const CurrentIcon = mode === 'system' ? ContrastRounded : resolved === 'light' ? LightModeRounded : DarkModeRounded;

  const open = (e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget);
  const choose = (value: Mode) => {
    setMode(value);
    setAnchor(null);
  };

  return (
    <>
      <Tooltip title="Theme">
        <IconButton
          onClick={open}
          aria-label={`Colour theme: ${mode ?? 'system'}. Change theme`}
          aria-haspopup="menu"
          aria-expanded={anchor ? 'true' : undefined}
          aria-controls={anchor ? 'theme-menu' : undefined}
          sx={{ color: 'text.secondary', border: 1, borderColor: 'divider', '&:hover': { color: 'text.primary' } }}
        >
          <CurrentIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        id="theme-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 180, borderRadius: 3, border: 1, borderColor: 'divider' } } }}
      >
        {OPTIONS.map(({ value, label, Icon }) => (
          <MenuItem key={value} selected={mode === value} onClick={() => choose(value)} sx={{ minHeight: 44 }}>
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
            {mode === value && <CheckRounded fontSize="small" sx={{ ml: 2, color: 'primary.main' }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
