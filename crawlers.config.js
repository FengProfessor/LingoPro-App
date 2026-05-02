module.exports = {
  apps: [
    {
      name: "cào-siêu-tốc",
      script: "./scripts/auto-build-dict.js",
      args: "oxford-3000.txt vocab",
      watch: false,
      autorestart: false, // Không tự khởi động lại khi đã hoàn thành (DONE)
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
