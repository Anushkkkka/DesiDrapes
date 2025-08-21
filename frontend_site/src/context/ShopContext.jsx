import { createContext } from "react";
import { product } from "../assets/assets";


/* To store common variables and state variables at one place */
export const ShopContext = createContext();

// context provider function 
const ShopContextProvider = (props) => {

    const currency = '$'; // all over pages it will show in dollars
    const delivery_charges = 10;

    const value = {
        product, currency, delivery_charges
    }

    return (
        <ShopContext.Provider value ={value}>
            {props.childern}
        </ShopContext.Provider>
    )
}

export default ShopContextProvider;