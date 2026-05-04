import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lingopro.app',
  appName: 'LingoPro',
  webDir: 'public',
  server: {
    // URL của ứng dụng web đã deploy (ví dụ: https://lingopro.com)
    // Nếu chạy trên máy ảo cục bộ (simulator), bạn có thể dùng địa chỉ IP nội bộ, vd: 'http://192.168.1.100:3000'
    url: 'http://localhost:3000',
    cleartext: true
  }
};

export default config;
