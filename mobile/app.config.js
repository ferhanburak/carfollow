module.exports = ({ config }) => {
  const androidMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;
  const iosMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY;
  const isLocalAndroidBuild = process.env.TRACKSNAP_LOCAL_ANDROID === "true";

  return {
    ...config,
    name: isLocalAndroidBuild ? `${config.name} Local` : config.name,
    scheme: isLocalAndroidBuild ? `${config.scheme}-local` : config.scheme,
    android: {
      ...config.android,
      package: isLocalAndroidBuild
        ? `${config.android?.package}.local`
        : config.android?.package,
      ...(androidMapsApiKey
        ? {
            config: {
              ...config.android?.config,
              googleMaps: {
                ...config.android?.config?.googleMaps,
                apiKey: androidMapsApiKey,
              },
            },
          }
        : {}),
    },
    ios: {
      ...config.ios,
      ...(iosMapsApiKey
        ? {
            config: {
              ...config.ios?.config,
              googleMapsApiKey: iosMapsApiKey,
            },
          }
        : {}),
    },
  };
};
