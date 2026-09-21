import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
//
// Keep this entry statically imported. Loading App through a runtime require() makes Metro
// split it out of the entry bundle ("1 module"), and any reload then fails with
// "main has not been registered" / missing native modules. The saved Appearance theme is
// applied from App.js instead, and applyTheme() rebuilds styles live (see src/theme).
registerRootComponent(App);
