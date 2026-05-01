import { createElement, PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import './app.scss'

const queryClient = new QueryClient()

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
  })

  return createElement(QueryClientProvider, { client: queryClient }, children)
}

export default App
