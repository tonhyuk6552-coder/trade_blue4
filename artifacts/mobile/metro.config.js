const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...(config.resolver.sourceExts || [])];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "xlsx") {
    return {
      filePath: require.resolve("xlsx/dist/xlsx.full.min.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
