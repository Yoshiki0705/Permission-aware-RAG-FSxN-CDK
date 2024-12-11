/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  compress: true,
  webpack: (config, { isServer, webpack, nextRuntime }) => {
    if (isServer && nextRuntime === "nodejs") {
      // AWS SDKの問題を回避するための設定
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^aws-sdk$/,
        })
      );

      // aws-crtの問題も同時に解決
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^aws-crt$/,
        })
      );
    }

    // OpenSearchのAWS SDK依存を外部モジュールとして扱う
    config.externals = [...(config.externals || []), "aws-sdk"];

    return config;
  },
};

export default nextConfig;
