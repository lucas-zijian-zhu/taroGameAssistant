import type { UserConfigExport } from "@tarojs/cli"

export default {
  defineConstants: {
    'process.env.TARO_APP_API_BASE_URL': JSON.stringify(process.env.TARO_APP_API_BASE_URL || 'http://10.0.0.128:3000/api'),
    'process.env.TARO_APP_WS_BASE_URL': JSON.stringify(process.env.TARO_APP_WS_BASE_URL || 'ws://10.0.0.128:3000/ws')
  },
  mini: {},
  h5: {}
} satisfies UserConfigExport<'vite'>
