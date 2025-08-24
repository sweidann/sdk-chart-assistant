import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import SdkChartAssistant from './SdkChartAssistant'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <SdkChartAssistant />
    </>
  )
}

export default App
