import React from 'react';
import { View } from 'react-native';
import { registerRootComponent } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyTheme, theme, THEME_STORAGE_KEY } from './src/theme';

// Screens build their StyleSheets from the theme when their modules first load, so the saved
// Appearance choice is applied BEFORE App (and everything it imports) is required.
function Root() {
  const [App, setApp] = React.useState(null);

  React.useEffect(() => {
    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      setApp(() => require('./App').default);
    };
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((saved) => { if (saved) applyTheme(saved); })
      .catch(() => {})
      .finally(load);
    // Never block startup on storage.
    const timer = setTimeout(load, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!App) return React.createElement(View, { style: { flex: 1, backgroundColor: theme.colors.background } });
  return React.createElement(App);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
