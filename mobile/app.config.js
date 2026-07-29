module.exports = ({ config }) => {
  const androidGoogleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;
  const iosGoogleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY;
  const mapsOptions = {};

  if (androidGoogleMapsApiKey) {
    mapsOptions.androidGoogleMapsApiKey = androidGoogleMapsApiKey;
  }

  if (iosGoogleMapsApiKey) {
    mapsOptions.iosGoogleMapsApiKey = iosGoogleMapsApiKey;
  }

  const plugins = (config.plugins ?? []).filter((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return pluginName !== 'react-native-maps';
  });

  if (Object.keys(mapsOptions).length > 0) {
    plugins.push(['react-native-maps', mapsOptions]);
  }

  return {
    ...config,
    plugins,
  };
};
