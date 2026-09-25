import type { ResponsiveStyleValue } from '@mui/system';
import type { MockupScreen } from '../../types';
import PhoneFrame from './PhoneFrame';
import HomeScreen from './screens/HomeScreen';
import PreviewDeckScreen from './screens/PreviewDeckScreen';
import AutomationScreen from './screens/AutomationScreen';
import ControlsScreen from './screens/ControlsScreen';
import ActivityScreen from './screens/ActivityScreen';
import ConnectionsScreen from './screens/ConnectionsScreen';
import PocketScreen from './screens/PocketScreen';
import SignUpScreen from './screens/SignUpScreen';
import LoginMethodScreen from './screens/LoginMethodScreen';

interface AppScreenProps {
  screen: MockupScreen;
  label: string;
  width?: ResponsiveStyleValue<number | string>;
}

/** Renders one of the recreated Flint app screens inside a phone frame. */
export default function AppScreen({ screen, label, width }: AppScreenProps) {
  const content = {
    home: <HomeScreen />,
    onboarding: <PreviewDeckScreen />,
    automation: <AutomationScreen />,
    controls: <ControlsScreen />,
    activity: <ActivityScreen />,
    connections: <ConnectionsScreen />,
    pocket: <PocketScreen />,
    signup: <SignUpScreen />,
    login: <LoginMethodScreen />,
  }[screen];

  return (
    <PhoneFrame label={label} width={width} bare={screen === 'pocket'}>
      {content}
    </PhoneFrame>
  );
}
