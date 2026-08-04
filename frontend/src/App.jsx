import React from 'react'
import {Routes,Route} from 'react-router-dom'
import OrderPage from './pages/OrderPage'
import NavigationBar from './components/NavigationBar'
import Homepg from './pages/Homepg'
import Collectionpg from './pages/Collectionpg'
import Aboutpg from './pages/Aboutpg'
import Contactpg from './pages/Contactpg'
import Productspg from './pages/Productspg'
import Cartpg from './pages/Cartpg'
import Loginpg from './pages/Loginpg'
import Placeorderpg from './pages/Placeorderpg'

const App = () => {
  return (
    <div className= 'px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw]'>
      <NavigationBar />
      <Routes>
            <Route path ='/' element={<Homepg/>}/>
            <Route path ='/orders' element={<OrderPage/>}/>
            <Route path ='/collection' element={<Collectionpg/>}/>
            <Route path ='/about' element={<Aboutpg/>}/>
            <Route path ='/contact' element={<Contactpg/>}/>
            <Route path ='/product' element={<Productspg/>}/>
            <Route path ='/cart' element={<Cartpg/>}/>
            <Route path ='/login' element={<Loginpg/>}/>
            <Route path ='/placeorder'element={<Placeorderpg/>}/>
      </Routes>
    </div>
  )
}

export default App
