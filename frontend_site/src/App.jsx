import React from 'react'
import {Routes,Route} from 'react-router-dom'
import home_pg from './pages/home_pg'
import collection from './pages/collection'
import about from './pages/about'
import contact from './pages/contact'
import product from './pages/product'
import cart_pg from './pages/cart_pg'
import login_pg from './pages/login_pg'
import placeorder from './pages/placeorder'
import OrderPage from './pages/OrderPage'
import NavigationBar from './components/NavigationBar'

const App = () => {
  return (
    <div className= 'px-4 sm:px-[5vw] md:px-[7vw] lg:px-[9vw]'>
      <NavigationBar />
      <Routes>
            <Route path ='/' element={<home_pg/>}/>
            <Route path ='/collection' element={<collection/>}/>
            <Route path ='/about' element={<about/>}/>
            <Route path ='/contact' element={<contact/>}/>
            <Route path ='/product/:productId' element={<product/>}/>
            <Route path ='/cart' element={<cart_pg/>}/>
            <Route path ='/login' element={<login_pg/>}/>
            <Route path ='/place-order' element={<placeorder/>}/>
            <Route path ='/orders' element={<OrderPage/>}/>
      </Routes>
    </div>
  )
}

export default App
